/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Loader2, Share2 } from 'lucide-react';
import { DriveLibrary } from './components/DriveLibrary';
import { EpisodePlayerModal } from './components/EpisodePlayerModal';
import { SeriesShowcase } from './components/SeriesShowcase';
import { ShareModal } from './components/ShareModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import {
  clearCachedToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/auth';
import { loadSeriesFromFolder } from './lib/drive';
import {
  decodeSeriesFromHashToken,
  expandCompactPayload,
  fetchPublishedSeriesJson,
} from './lib/shareCodec';
import {
  getAllWatchProgress,
  getRecentSeries,
  recordRecentSeries,
  removeRecentSeries,
  saveWatchProgress,
  toggleEpisodeWatched,
} from './lib/storage';
import {
  Episode,
  RecentSeriesEntry,
  SeriesCustomization,
  SeriesData,
  WatchProgressEntry,
} from './types';

function extractWatchTokenFromHash(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[#&]watch=([^&]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [isViewerMode, setIsViewerMode] = useState(false);
  const [customization, setCustomization] = useState<SeriesCustomization>({});
  const [view, setView] = useState<'home' | 'library' | 'series'>('home');
  const [libraryTab, setLibraryTab] = useState<'my-drive' | 'shared'>('my-drive');

  const [series, setSeries] = useState<SeriesData | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);

  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    open: boolean;
    episode: Episode | null;
  }>({ open: false, episode: null });

  const [watchProgress, setWatchProgress] = useState<
    Record<string, WatchProgressEntry>
  >(() => getAllWatchProgress());
  const [recentSeries, setRecentSeries] = useState<RecentSeriesEntry[]>(() =>
    getRecentSeries()
  );

  // 1. Initialize Firebase Auth listener (for optional Google Drive folder import)
  useEffect(() => {
    const unsubscribe = initAuth(
      (signedInUser, token) => {
        setUser(signedInUser);
        setAccessToken(token);
      },
      () => {
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Load self-contained #watch= link OR published ./series.json on GitHub Pages
  const loadFromHashOrPublishedJson = useCallback(async () => {
    const hashToken = extractWatchTokenFromHash();
    if (hashToken) {
      const payload = await decodeSeriesFromHashToken(hashToken);
      if (payload) {
        const expanded = expandCompactPayload(payload);
        setSeries(expanded.series);
        setCustomization(expanded.customization);
        setIsViewerMode(true);
        setView('series');
        setSeriesError(null);
        if (expanded.initialEpisodeId) {
          const ep = expanded.series.seasons
            .flatMap((s) => s.episodes)
            .find((e) => e.id === expanded.initialEpisodeId);
          if (ep) setActiveEpisode(ep);
        }
        setBooting(false);
        return;
      }
    }

    // Check if the owner published a permanent public/series.json on their GitHub Pages domain
    const published = await fetchPublishedSeriesJson();
    if (published?.published && published.series) {
      const expanded = expandCompactPayload(published.series);
      setSeries(expanded.series);
      setCustomization(expanded.customization);
      setIsViewerMode(true);
      setView('series');
      setSeriesError(null);
      setBooting(false);
      return;
    }

    setBooting(false);
  }, []);

  useEffect(() => {
    loadFromHashOrPublishedJson();
    const onHashChange = () => {
      if (extractWatchTokenFromHash()) {
        loadFromHashOrPublishedJson();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [loadFromHashOrPublishedJson]);

  const handleAuthExpired = useCallback(() => {
    clearCachedToken();
    setAccessToken(null);
    setAuthError('انتهت جلسة Google Drive. يرجى تسجيل الدخول مجدداً للمتابعة.');
  }, []);

  const openDriveFolder = useCallback(
    async (folderId: string, tokenOverride?: string) => {
      const token = tokenOverride || accessToken;
      if (!token) {
        setPendingFolderId(folderId);
        return;
      }

      setIsViewerMode(false);
      setCustomization({});
      setView('series');
      setSeriesLoading(true);
      setSeriesError(null);
      setPendingFolderId(folderId);

      try {
        const loaded = await loadSeriesFromFolder(token, folderId);
        setSeries(loaded);
        setRecentSeries(
          recordRecentSeries({
            id: loaded.id,
            name: loaded.name,
            totalEpisodes: loaded.totalEpisodes,
            seasonsCount: loaded.seasons.length,
            lastOpenedAt: Date.now(),
          })
        );
      } catch (err: any) {
        if (err?.name === 'DriveAuthExpiredError') {
          handleAuthExpired();
          setView('home');
          return;
        }
        setSeries(null);
        setSeriesError(
          err?.message || 'تعذّر فتح مجلد المسلسل من Google Drive.'
        );
      } finally {
        setSeriesLoading(false);
      }
    },
    [accessToken, handleAuthExpired]
  );

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        if (pendingFolderId) {
          openDriveFolder(pendingFolderId, result.accessToken);
        } else {
          setIsViewerMode(false);
          setView('library');
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError(
          'هذا الدومين غير مضاف بعد في Firebase Authorized Domains. يمكنك استخدام تبويب «لصق روابط الحلقات» مباشرة بدون تسجيل دخول!'
        );
      } else {
        setAuthError(
          err?.message || 'تعذّر تسجيل الدخول بحساب Google. يمكنك استخدام لصق روابط الحلقات بدون تسجيل دخول.'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setSeries(null);
    setActiveEpisode(null);
    setIsViewerMode(false);
    setView('home');
    if (window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleCreateManualSeries = (
    builtSeries: SeriesData,
    builtCustomization: SeriesCustomization
  ) => {
    setSeries(builtSeries);
    setCustomization(builtCustomization);
    setIsViewerMode(false);
    setSeriesError(null);
    setView('series');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProgress = (
    episodeId: string,
    currentTimeSec: number,
    durationSec: number,
    watched: boolean
  ) => {
    if (!series) return;
    setWatchProgress(
      saveWatchProgress({
        episodeId,
        seriesId: series.id,
        currentTimeSec,
        durationSec,
        watched,
        updatedAt: Date.now(),
      })
    );
  };

  const handleToggleWatched = (episodeId: string, watched: boolean) => {
    if (!series) return;
    setWatchProgress(toggleEpisodeWatched(series.id, episodeId, watched));
  };

  const handleSwitchToLibrary = (tab: 'my-drive' | 'shared') => {
    setIsViewerMode(false);
    setLibraryTab(tab);
    setSeriesError(null);
    if (accessToken) {
      setView('library');
    } else {
      setView('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setIsViewerMode(false);
    setSeries(null);
    setSeriesError(null);
    setPendingFolderId(null);
    setView('home');
    if (window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#E50914]" />
      </div>
    );
  }

  if (view === 'home') {
    return (
      <WelcomeScreen
        onSignIn={handleLogin}
        isSigningIn={isLoggingIn}
        errorMessage={authError}
        onCreateManualSeries={handleCreateManualSeries}
      />
    );
  }

  const displayTitle = customization.title?.trim() || series?.name || 'سينما درايف';

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#F4F4F6] flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0A0A0C]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (isViewerMode) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else if (series) {
                setView('series');
              } else {
                handleGoHome();
              }
            }}
            className="font-display text-xl font-extrabold tracking-tight text-[#E50914] whitespace-nowrap shrink-0 cursor-pointer"
          >
            سينما درايف
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          {isViewerMode ? (
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A1A1AA]">
              <a
                href="#series-hero"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                المسلسل
              </a>
              <a
                href="#episodes-section"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                الحلقات
              </a>
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A1A1AA]">
              {series && (
                <button
                  type="button"
                  onClick={() => setView('series')}
                  className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    view === 'series' ? 'text-white font-semibold' : 'hover:text-white'
                  }`}
                >
                  المسلسل
                </button>
              )}
              <button
                type="button"
                onClick={handleGoHome}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                مسلسل جديد
              </button>
              {accessToken && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSwitchToLibrary('my-drive')}
                    className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      view === 'library' && libraryTab === 'my-drive'
                        ? 'text-white font-semibold'
                        : 'hover:text-white'
                    }`}
                  >
                    مجلداتي
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchToLibrary('shared')}
                    className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      view === 'library' && libraryTab === 'shared'
                        ? 'text-white font-semibold'
                        : 'hover:text-white'
                    }`}
                  >
                    المشتركة معي
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            {series ? (
              <button
                type="button"
                onClick={() => setShareTarget({ open: true, episode: null })}
                className="h-10 px-4 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                <span>{isViewerMode ? 'مشاركة' : 'نشر ومشاركة'}</span>
              </button>
            ) : accessToken ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="h-10 px-4 rounded-md bg-[#1C1C22] hover:bg-[#27272F] text-white font-display font-semibold text-xs sm:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                تسجيل الخروج
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoHome}
                className="h-10 px-4 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-xs sm:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                إنشاء مسلسل
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {view === 'series' ? (
          seriesLoading ? (
            <div className="min-h-[65vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Loader2 className="w-9 h-9 animate-spin text-[#E50914]" />
              <div className="space-y-1">
                <p className="font-display font-bold text-lg text-white">
                  جاري تجهيز واجهة المسلسل...
                </p>
                <p className="text-sm text-[#A1A1AA]">
                  تحميل المواسم والحلقات والصور المصغّرة
                </p>
              </div>
            </div>
          ) : seriesError ? (
            <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-6">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                تعذّر فتح هذا المجلد
              </h1>
              <p className="text-sm text-[#FCA5A5] leading-relaxed bg-[#E50914]/10 border border-[#E50914]/30 rounded-xl p-5">
                {seriesError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {pendingFolderId && accessToken && (
                  <button
                    type="button"
                    onClick={() => openDriveFolder(pendingFolderId)}
                    className="h-10 px-5 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm transition-colors cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    accessToken ? handleSwitchToLibrary('my-drive') : handleGoHome()
                  }
                  className="h-10 px-5 rounded-md bg-[#1C1C22] hover:bg-[#27272F] text-white font-display font-semibold text-sm transition-colors cursor-pointer"
                >
                  العودة
                </button>
              </div>
            </div>
          ) : series ? (
            <SeriesShowcase
              series={series}
              accessToken={accessToken}
              customization={customization}
              isViewerMode={isViewerMode}
              watchProgress={watchProgress}
              onPlayEpisode={(ep) => setActiveEpisode(ep)}
              onToggleWatched={handleToggleWatched}
              onOpenShare={(ep) =>
                setShareTarget({ open: true, episode: ep || null })
              }
              onToggleViewerMode={() => setIsViewerMode(true)}
              onChangeFolder={() => {
                if (accessToken) handleSwitchToLibrary('my-drive');
                else handleGoHome();
              }}
            />
          ) : null
        ) : accessToken ? (
          <DriveLibrary
            accessToken={accessToken}
            initialMode={libraryTab}
            recentSeries={recentSeries}
            onOpenSeries={(id) => openDriveFolder(id)}
            onRemoveRecent={(id) => setRecentSeries(removeRecentSeries(id))}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.06] py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#71717A]">
          <span>
            سينما درايف{!isViewerMode && user?.email ? ` · ${user.email}` : ''}
          </span>
          <div className="flex items-center gap-5">
            {isViewerMode ? (
              <button
                type="button"
                onClick={handleGoHome}
                className="hover:text-white transition-colors cursor-pointer"
              >
                أنشئ صفحتك الخاصة
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  إنشاء مسلسل جديد
                </button>
                {accessToken && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    تسجيل الخروج
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Fullscreen Video Player Modal */}
      {series && activeEpisode && (
        <EpisodePlayerModal
          series={series}
          seriesDisplayTitle={displayTitle}
          episode={activeEpisode}
          accessToken={accessToken}
          watchProgress={watchProgress}
          onSelectEpisode={(ep) => setActiveEpisode(ep)}
          onUpdateProgress={handleUpdateProgress}
          onToggleWatched={handleToggleWatched}
          onOpenShare={(ep) => setShareTarget({ open: true, episode: ep })}
          onClose={() => setActiveEpisode(null)}
          onAuthExpired={handleAuthExpired}
        />
      )}

      {/* Customize & Share Modal */}
      {series && shareTarget.open && (
        <ShareModal
          series={series}
          customization={customization}
          isViewerMode={isViewerMode}
          initialEpisode={shareTarget.episode}
          onUpdateCustomization={setCustomization}
          onEnterViewerPreview={() => setIsViewerMode(true)}
          onClose={() => setShareTarget({ open: false, episode: null })}
        />
      )}
    </div>
  );
}
