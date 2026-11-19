/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Loader2, Share2 } from 'lucide-react';
import { DriveLibrary } from './components/DriveLibrary';
import { EpisodePlayerModal } from './components/EpisodePlayerModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { SeriesShowcase } from './components/SeriesShowcase';
import { buildWatchShareUrl, ShareModal } from './components/ShareModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import {
  clearCachedToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/auth';
import {
  loadPublicSeriesFromFolder,
  loadSeriesFromFolder,
  PublicFolderPrivateError,
} from './lib/drive';
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

function readUrlState(): {
  folderId: string | null;
  episodeId: string | null;
  isViewerLink: boolean;
  customization: SeriesCustomization;
} {
  const params = new URLSearchParams(window.location.search);
  const watchId = params.get('watch');
  const folderId = watchId || params.get('folder');

  return {
    folderId,
    episodeId: params.get('ep'),
    isViewerLink: Boolean(watchId),
    customization: {
      title: params.get('t') || undefined,
      description: params.get('d') || undefined,
      genre: params.get('g') || undefined,
      year: params.get('y') || undefined,
      coverUrl: params.get('c') || undefined,
    },
  };
}

function updateAddressBar(
  folderId: string | null,
  isViewerMode: boolean,
  customization: SeriesCustomization,
  episodeId?: string | null
) {
  if (!folderId) {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
    return;
  }

  if (isViewerMode) {
    const watchUrl = buildWatchShareUrl(folderId, customization, episodeId);
    window.history.replaceState({}, '', watchUrl);
    return;
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('folder', folderId);
  if (episodeId) url.searchParams.set('ep', episodeId);
  if (customization.title?.trim()) url.searchParams.set('t', customization.title.trim());
  if (customization.description?.trim()) url.searchParams.set('d', customization.description.trim());
  if (customization.genre?.trim()) url.searchParams.set('g', customization.genre.trim());
  if (customization.year?.trim()) url.searchParams.set('y', customization.year.trim());
  if (customization.coverUrl?.trim()) url.searchParams.set('c', customization.coverUrl.trim());
  window.history.replaceState({}, '', url.toString());
}

export default function App() {
  const initialState = readUrlState();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [pendingFolderId, setPendingFolderId] = useState<string | null>(
    initialState.folderId
  );
  const [pendingEpisodeId, setPendingEpisodeId] = useState<string | null>(
    initialState.episodeId
  );
  const [isViewerMode, setIsViewerMode] = useState<boolean>(
    initialState.isViewerLink
  );
  const [customization, setCustomization] = useState<SeriesCustomization>(
    initialState.customization
  );

  const [view, setView] = useState<'home' | 'library' | 'series'>(
    initialState.folderId ? 'series' : 'home'
  );
  const [libraryTab, setLibraryTab] = useState<'my-drive' | 'shared'>('my-drive');

  const [series, setSeries] = useState<SeriesData | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(Boolean(initialState.folderId));
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [requiresSignInForPrivateFolder, setRequiresSignInForPrivateFolder] =
    useState(false);

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

  const handleAuthExpired = useCallback(() => {
    clearCachedToken();
    setAccessToken(null);
    setAuthError('انتهت جلسة Google Drive. يرجى تسجيل الدخول مجدداً للمتابعة.');
  }, []);

  const openSeriesFolder = useCallback(
    async (
      folderId: string,
      options?: {
        tokenOverride?: string | null;
        targetEpisodeId?: string | null;
        viewerMode?: boolean;
        keepCustomization?: boolean;
      }
    ) => {
      const token = options?.tokenOverride !== undefined ? options.tokenOverride : accessToken;
      const nextViewer = options?.viewerMode ?? isViewerMode;
      const nextCustomization = options?.keepCustomization ? customization : {};

      if (!options?.keepCustomization) {
        setCustomization({});
      }
      setIsViewerMode(nextViewer);
      setView('series');
      setSeriesLoading(true);
      setSeriesError(null);
      setRequiresSignInForPrivateFolder(false);
      setPendingFolderId(folderId);
      updateAddressBar(folderId, nextViewer, nextCustomization, options?.targetEpisodeId || null);

      try {
        let loaded: SeriesData;

        if (token) {
          // Signed-in user gets full Drive API metadata (durations, exact resolutions, sharing status)
          try {
            loaded = await loadSeriesFromFolder(token, folderId);
          } catch (authErr: any) {
            if (authErr?.name === 'DriveAuthExpiredError') {
              // Fallback cleanly to public folder reader before forcing re-login
              clearCachedToken();
              setAccessToken(null);
              loaded = await loadPublicSeriesFromFolder(folderId);
            } else {
              throw authErr;
            }
          }
        } else {
          // Zero-login public Google Drive folder reader!
          loaded = await loadPublicSeriesFromFolder(folderId);
        }

        setSeries(loaded);
        setRecentSeries(
          recordRecentSeries({
            id: loaded.id,
            name: nextCustomization.title || loaded.name,
            totalEpisodes: loaded.totalEpisodes,
            seasonsCount: loaded.seasons.length,
            lastOpenedAt: Date.now(),
          })
        );

        if (options?.targetEpisodeId) {
          const matchedEp = loaded.seasons
            .flatMap((s) => s.episodes)
            .find((e) => e.id === options.targetEpisodeId);
          if (matchedEp) {
            setActiveEpisode(matchedEp);
          }
          setPendingEpisodeId(null);
        }
      } catch (err: any) {
        setSeries(null);
        if (err instanceof PublicFolderPrivateError) {
          setRequiresSignInForPrivateFolder(true);
          setSeriesError(err.message);
        } else {
          setSeriesError(
            err?.message || 'تعذّر فتح مجلد المسلسل من Google Drive.'
          );
        }
      } finally {
        setSeriesLoading(false);
      }
    },
    [accessToken, isViewerMode, customization]
  );

  // Auto-load initial ?watch=... or ?folder=... immediately with ZERO login!
  useEffect(() => {
    if (initialState.folderId) {
      openSeriesFolder(initialState.folderId, {
        tokenOverride: null,
        targetEpisodeId: initialState.episodeId,
        viewerMode: initialState.isViewerLink,
        keepCustomization: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        if (pendingFolderId && (requiresSignInForPrivateFolder || view === 'series')) {
          openSeriesFolder(pendingFolderId, {
            tokenOverride: result.accessToken,
            targetEpisodeId: pendingEpisodeId,
            viewerMode: isViewerMode,
            keepCustomization: true,
          });
        } else {
          setView('library');
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      } else {
        setAuthError(
          err?.message || 'تعذّر تسجيل الدخول بحساب Google. حاول مرة أخرى.'
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
    updateAddressBar(null, false, {});
  };

  const handlePlayEpisode = (episode: Episode) => {
    setActiveEpisode(episode);
    if (series) {
      updateAddressBar(series.id, isViewerMode, customization, episode.id);
    }
  };

  const handleClosePlayer = () => {
    setActiveEpisode(null);
    if (series) {
      updateAddressBar(series.id, isViewerMode, customization, null);
    }
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
      updateAddressBar(null, false, {});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setIsViewerMode(false);
    setSeries(null);
    setSeriesError(null);
    setPendingFolderId(null);
    setView('home');
    updateAddressBar(null, false, {});
  };

  const handleUpdateCustomization = (next: SeriesCustomization) => {
    setCustomization(next);
    if (series) {
      updateAddressBar(series.id, isViewerMode, next, activeEpisode?.id || null);
    }
  };

  if (view === 'home') {
    return (
      <WelcomeScreen
        onOpenPublicLink={(folderId) =>
          openSeriesFolder(folderId, { viewerMode: false, keepCustomization: false })
        }
        onSignIn={handleLogin}
        isSigningIn={isLoggingIn}
        errorMessage={authError}
        recentSeries={recentSeries}
        onRemoveRecent={(id) => setRecentSeries(removeRecentSeries(id))}
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
              <button
                type="button"
                onClick={() => setIsViewerMode(false)}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                تعديل الواجهة
              </button>
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
                رابط جديد
              </button>
              {accessToken ? (
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
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  تصفّح مجلداتي
                </button>
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
                <span>{isViewerMode ? 'مشاركة' : 'مشاركة الرابط'}</span>
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
                تحويل رابط جديد
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
                {requiresSignInForPrivateFolder
                  ? 'هذا المجلد خاص في Google Drive'
                  : 'تعذّر فتح هذا الرابط'}
              </h1>
              <p className="text-sm text-[#FCA5A5] leading-relaxed bg-[#E50914]/10 border border-[#E50914]/30 rounded-xl p-5">
                {seriesError}
              </p>

              {requiresSignInForPrivateFolder ? (
                <div className="space-y-4 pt-2">
                  <GoogleSignInButton
                    onClick={handleLogin}
                    loading={isLoggingIn}
                    label="تسجيل الدخول بحساب Google لفتح المجلد"
                  />
                  <div>
                    <button
                      type="button"
                      onClick={handleGoHome}
                      className="text-xs text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                    >
                      العودة لتجربة رابط آخر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {pendingFolderId && (
                    <button
                      type="button"
                      onClick={() =>
                        openSeriesFolder(pendingFolderId, { keepCustomization: true })
                      }
                      className="h-10 px-5 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm transition-colors cursor-pointer"
                    >
                      إعادة المحاولة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="h-10 px-5 rounded-md bg-[#1C1C22] hover:bg-[#27272F] text-white font-display font-semibold text-sm transition-colors cursor-pointer"
                  >
                    إدخال رابط آخر
                  </button>
                </div>
              )}
            </div>
          ) : series ? (
            <SeriesShowcase
              series={series}
              accessToken={accessToken}
              customization={customization}
              isViewerMode={isViewerMode}
              watchProgress={watchProgress}
              onPlayEpisode={handlePlayEpisode}
              onToggleWatched={handleToggleWatched}
              onOpenShare={(ep) =>
                setShareTarget({ open: true, episode: ep || null })
              }
              onToggleViewerMode={() => {
                setIsViewerMode(true);
                updateAddressBar(series.id, true, customization, null);
              }}
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
            onOpenSeries={(id) =>
              openSeriesFolder(id, { viewerMode: false, keepCustomization: false })
            }
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
                أنشئ صفحة عرض لمسلسلك
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  تحويل رابط جديد
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
          onSelectEpisode={(ep) => {
            setActiveEpisode(ep);
            updateAddressBar(series.id, isViewerMode, customization, ep.id);
          }}
          onUpdateProgress={handleUpdateProgress}
          onToggleWatched={handleToggleWatched}
          onOpenShare={(ep) => setShareTarget({ open: true, episode: ep })}
          onClose={handleClosePlayer}
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
          onUpdateCustomization={handleUpdateCustomization}
          onEnterViewerPreview={() => {
            setIsViewerMode(true);
            updateAddressBar(series.id, true, customization, null);
          }}
          onClose={() => setShareTarget({ open: false, episode: null })}
        />
      )}
    </div>
  );
}
