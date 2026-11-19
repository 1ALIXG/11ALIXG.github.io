import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Loader2,
  Share2,
  Subtitles,
  X,
} from 'lucide-react';
import {
  fetchDriveMediaBlobUrl,
  fetchSubtitleAsVttUrl,
  formatDurationAr,
} from '../lib/drive';
import { Episode, SeriesData, WatchProgressEntry } from '../types';

interface EpisodePlayerModalProps {
  series: SeriesData;
  seriesDisplayTitle: string;
  episode: Episode;
  accessToken: string | null;
  watchProgress: Record<string, WatchProgressEntry>;
  onSelectEpisode: (episode: Episode) => void;
  onUpdateProgress: (
    episodeId: string,
    currentTimeSec: number,
    durationSec: number,
    watched: boolean
  ) => void;
  onToggleWatched: (episodeId: string, watched: boolean) => void;
  onOpenShare: (episode: Episode) => void;
  onClose: () => void;
  onAuthExpired: () => void;
}

export const EpisodePlayerModal: React.FC<EpisodePlayerModalProps> = ({
  series,
  seriesDisplayTitle,
  episode,
  accessToken,
  watchProgress,
  onSelectEpisode,
  onUpdateProgress,
  onToggleWatched,
  onOpenShare,
  onClose,
  onAuthExpired,
}) => {
  const canUseDirectMode = Boolean(accessToken && !series.isPublicSource);
  const [playerMode, setPlayerMode] = useState<'adaptive' | 'direct'>('adaptive');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [directVideoUrl, setDirectVideoUrl] = useState<string | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<
    Array<{ id: string; label: string; url: string }>
  >([]);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

  const allEpisodes = useMemo(
    () => series.seasons.flatMap((s) => s.episodes),
    [series.seasons]
  );

  const currentIndex = useMemo(
    () => allEpisodes.findIndex((e) => e.id === episode.id),
    [allEpisodes, episode.id]
  );

  const prevEpisode = currentIndex > 0 ? allEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < allEpisodes.length - 1
      ? allEpisodes[currentIndex + 1]
      : null;

  const isWatched = Boolean(watchProgress[episode.id]?.watched);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, onClose]);

  useEffect(() => {
    setDirectVideoUrl(null);
    setDirectError(null);
    setSubtitleTracks([]);
    lastSavedTimeRef.current = 0;
    if (!canUseDirectMode) {
      setPlayerMode('adaptive');
    }
  }, [episode.id, canUseDirectMode]);

  useEffect(() => {
    if (playerMode !== 'direct' || !accessToken) return;

    let cancelled = false;
    const urlsToRevoke: string[] = [];

    const loadDirect = async () => {
      setDirectLoading(true);
      setDirectError(null);
      try {
        const videoBlobUrl = await fetchDriveMediaBlobUrl(accessToken, episode.id);
        if (cancelled) {
          URL.revokeObjectURL(videoBlobUrl);
          return;
        }
        urlsToRevoke.push(videoBlobUrl);
        setDirectVideoUrl(videoBlobUrl);

        if (episode.subtitles.length > 0) {
          const loadedSubs = await Promise.all(
            episode.subtitles.map(async (sub) => {
              try {
                const vttUrl = await fetchSubtitleAsVttUrl(accessToken, sub.id, sub.name);
                urlsToRevoke.push(vttUrl);
                return { id: sub.id, label: sub.languageLabel, url: vttUrl };
              } catch {
                return null;
              }
            })
          );
          if (!cancelled) {
            setSubtitleTracks(
              loadedSubs.filter(
                (t): t is { id: string; label: string; url: string } => t !== null
              )
            );
          }
        }
      } catch (err: any) {
        if (err?.name === 'DriveAuthExpiredError') {
          onAuthExpired();
          return;
        }
        if (!cancelled) {
          setDirectError(
            'تعذّر تشغيل هذا الملف بالمُشغّل المباشر. بدّل إلى «المشغل السريع» للبث الفوري.'
          );
        }
      } finally {
        if (!cancelled) setDirectLoading(false);
      }
    };

    loadDirect();

    return () => {
      cancelled = true;
      urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [playerMode, episode.id, episode.subtitles, accessToken, onAuthExpired]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleVideoLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
    const saved = watchProgress[episode.id];
    if (
      saved &&
      saved.currentTimeSec > 5 &&
      !saved.watched &&
      saved.currentTimeSec < el.duration - 15
    ) {
      el.currentTime = saved.currentTimeSec;
    }
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const now = el.currentTime;
    if (Math.abs(now - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = now;
      const reachedEnd = now / el.duration >= 0.92;
      onUpdateProgress(episode.id, now, el.duration, isWatched || reachedEnd);
    }
  };

  const handleVideoEnded = () => {
    const el = videoRef.current;
    const dur = el?.duration || 0;
    onUpdateProgress(episode.id, dur, dur, true);
    if (nextEpisode) {
      onSelectEpisode(nextEpisode);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تشغيل ${episode.title}`}
      className="fixed inset-0 z-50 bg-[#050507] flex flex-col"
    >
      {/* Top Cinema Control Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-white/[0.08] bg-[#0A0A0C]/95 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المشغل"
            className="h-10 w-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-white inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="font-display font-bold text-sm sm:text-base text-white truncate">
              {episode.title}
            </h2>
            <p className="text-xs text-[#A1A1AA] truncate">
              {seriesDisplayTitle} · {episode.seasonName} · الحلقة{' '}
              <span className="font-mono-num">{episode.episodeNumber}</span>
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {canUseDirectMode && (
            <div className="hidden md:inline-flex items-center p-1 rounded-lg bg-[#141418] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setPlayerMode('adaptive')}
                className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  playerMode === 'adaptive'
                    ? 'bg-white text-[#0A0A0C]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                المشغل السريع
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('direct')}
                className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  playerMode === 'direct'
                    ? 'bg-white text-[#0A0A0C]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                {episode.subtitles.length > 0 && (
                  <Subtitles className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>مشغل مباشر {episode.subtitles.length > 0 ? '+ ترجمة' : ''}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className={`h-10 px-3.5 rounded-lg border text-xs font-display font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              drawerOpen
                ? 'bg-white text-[#0A0A0C] border-white'
                : 'bg-[#141418] text-white border-white/[0.1] hover:border-white/25'
            }`}
          >
            <ListVideo className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">الحلقات</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenShare(episode)}
            className="h-10 px-3.5 rounded-lg bg-[#141418] border border-white/[0.1] hover:border-white/25 text-xs font-display font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">مشاركة</span>
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {playerMode === 'adaptive' ? (
          <div className="relative w-full h-full">
            <iframe
              key={episode.id}
              src={`https://drive.google.com/file/d/${encodeURIComponent(episode.id)}/preview`}
              title={episode.title}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
            />
            <div
              className="absolute top-0 right-0 w-16 h-16 bg-transparent z-10"
              aria-hidden="true"
            />
          </div>
        ) : directLoading ? (
          <div className="flex flex-col items-center gap-3 text-[#D4D4D8] px-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#E50914]" />
            <p className="font-display font-semibold text-sm">
              جاري تجهيز البث المباشر...
            </p>
          </div>
        ) : directError ? (
          <div className="max-w-md mx-auto p-6 rounded-xl bg-[#141418] border border-white/[0.1] text-center space-y-4">
            <p className="text-sm text-[#FCA5A5] leading-relaxed">{directError}</p>
            <button
              type="button"
              onClick={() => setPlayerMode('adaptive')}
              className="px-5 py-2.5 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm transition-colors cursor-pointer"
            >
              التبديل إلى المشغل السريع
            </button>
          </div>
        ) : directVideoUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <video
              ref={videoRef}
              key={directVideoUrl}
              src={directVideoUrl}
              controls
              autoPlay
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={() =>
                setDirectError(
                  'المتصفح لا يدعم تشغيل هذا الملف مباشرة. بدّل إلى «المشغل السريع» للمشاهدة فوراً.'
                )
              }
              className="w-full h-full max-h-full bg-black"
            >
              {subtitleTracks.map((track, i) => (
                <track
                  key={track.id}
                  kind="subtitles"
                  src={track.url}
                  label={track.label}
                  default={i === 0}
                />
              ))}
            </video>

            <div className="absolute top-4 left-4 flex items-center gap-1 p-1 rounded-lg bg-black/75 border border-white/[0.12] backdrop-blur-sm">
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2 py-1 rounded text-xs font-mono-num transition-colors cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-[#E50914] text-white font-semibold'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Slide-out Episodes Drawer */}
        {drawerOpen && (
          <aside className="absolute top-0 bottom-0 left-0 w-full max-w-sm bg-[#0E0E12]/98 border-r border-white/[0.1] backdrop-blur-lg z-20 flex flex-col">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white truncate">
                حلقات {seriesDisplayTitle}
              </h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="إغلاق قائمة الحلقات"
                className="p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-5">
              {series.seasons.map((season) => (
                <div key={season.id} className="space-y-2">
                  {series.seasons.length > 1 && (
                    <h4 className="px-2 font-display text-xs font-bold text-[#A1A1AA]">
                      {season.name}
                    </h4>
                  )}
                  <div className="space-y-1">
                    {season.episodes.map((ep) => {
                      const active = ep.id === episode.id;
                      const epWatched = Boolean(watchProgress[ep.id]?.watched);
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => {
                            onSelectEpisode(ep);
                            setDrawerOpen(false);
                          }}
                          className={`w-full text-right p-3 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                            active
                              ? 'bg-[#E50914]/20 border border-[#E50914]/50 text-white'
                              : 'hover:bg-white/[0.06] text-[#D4D4D8]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`font-mono-num text-xs font-semibold shrink-0 ${
                                active ? 'text-[#E50914]' : 'text-[#71717A]'
                              }`}
                            >
                              {String(ep.episodeNumber).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {ep.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-[#71717A]">
                            {ep.durationMs > 0 && (
                              <span className="font-mono-num">
                                {formatDurationAr(ep.durationMs)}
                              </span>
                            )}
                            {epWatched && (
                              <Check className="w-3.5 h-3.5 text-white" aria-label="تمت المشاهدة" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Cinema Controls */}
      <footer className="px-4 sm:px-6 py-3.5 border-t border-white/[0.08] bg-[#0A0A0C] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleWatched(episode.id, !isWatched)}
            className={`h-9 px-3.5 rounded-md border text-xs font-display font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              isWatched
                ? 'bg-white text-[#0A0A0C] border-white'
                : 'bg-[#141418] text-[#D4D4D8] border-white/[0.1] hover:text-white'
            }`}
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isWatched ? 'تمت المشاهدة' : 'تحديد كمشاهدة'}</span>
          </button>

          {canUseDirectMode && (
            <button
              type="button"
              onClick={() =>
                setPlayerMode((prev) => (prev === 'adaptive' ? 'direct' : 'adaptive'))
              }
              className="md:hidden h-9 px-3 rounded-md bg-[#141418] border border-white/[0.1] text-xs font-medium text-[#D4D4D8] cursor-pointer"
            >
              {playerMode === 'adaptive' ? 'مشغل مباشر' : 'المشغل السريع'}
            </button>
          )}
        </div>

        {/* Prev / Next Episode Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevEpisode}
            onClick={() => prevEpisode && onSelectEpisode(prevEpisode)}
            className="h-9 px-3.5 rounded-md bg-[#141418] border border-white/[0.1] hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-display font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
            <span>السابقة</span>
          </button>

          <button
            type="button"
            disabled={!nextEpisode}
            onClick={() => {
              if (!nextEpisode) return;
              onToggleWatched(episode.id, true);
              onSelectEpisode(nextEpisode);
            }}
            className="h-9 px-4 rounded-md bg-[#E50914] hover:bg-[#F41924] disabled:bg-[#27272F] disabled:text-[#71717A] disabled:cursor-not-allowed text-xs font-display font-bold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>
              {nextEpisode
                ? `التالية (ح ${nextEpisode.episodeNumber})`
                : 'آخر حلقة'}
            </span>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
};
