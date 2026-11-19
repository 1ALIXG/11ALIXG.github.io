import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  Eye,
  FolderOpen,
  LayoutGrid,
  List,
  Play,
  Search,
  Share2,
  SlidersHorizontal,
  Subtitles,
} from 'lucide-react';
import heroFallbackImg from '../assets/images/cinema_hero_backdrop_1795110238692.jpg';
import episodeFallbackImg from '../assets/images/episode_fallback_poster_1795110239049.jpg';
import {
  fetchDriveMediaBlobUrl,
  formatArabicDate,
  formatDurationAr,
  formatFileSize,
} from '../lib/drive';
import {
  Episode,
  SeriesCustomization,
  SeriesData,
  WatchProgressEntry,
} from '../types';

interface SeriesShowcaseProps {
  series: SeriesData;
  accessToken: string | null;
  customization: SeriesCustomization;
  isViewerMode: boolean;
  watchProgress: Record<string, WatchProgressEntry>;
  onPlayEpisode: (episode: Episode) => void;
  onToggleWatched: (episodeId: string, watched: boolean) => void;
  onOpenShare: (episode?: Episode) => void;
  onToggleViewerMode?: () => void;
  onChangeFolder?: () => void;
}

interface EpisodeThumbProps {
  episode: Episode;
  progressPercent: number;
  isWatched: boolean;
  onPlay: () => void;
}

const EpisodeThumb: React.FC<EpisodeThumbProps> = ({
  episode,
  progressPercent,
  isWatched,
  onPlay,
}) => {
  const [srcStage, setSrcStage] = useState<'drive' | 'fallback' | 'css'>(
    episode.thumbnailUrl ? 'drive' : 'fallback'
  );

  useEffect(() => {
    setSrcStage(episode.thumbnailUrl ? 'drive' : 'fallback');
  }, [episode.thumbnailUrl, episode.id]);

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group/thumb relative aspect-video w-full overflow-hidden rounded-lg bg-[#18181F] block text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E50914] cursor-pointer"
      aria-label={`تشغيل ${episode.title}`}
    >
      {srcStage === 'drive' && episode.thumbnailUrl ? (
        <img
          src={episode.thumbnailUrl}
          alt={episode.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setSrcStage('fallback')}
          className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-[1.04]"
        />
      ) : srcStage === 'fallback' ? (
        <img
          src={episodeFallbackImg}
          alt={episode.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setSrcStage('css')}
          className="w-full h-full object-cover opacity-80 transition-transform duration-200 group-hover/thumb:scale-[1.04]"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#23191B] via-[#141418] to-[#0E1118] flex items-center justify-center p-4">
          <span className="font-display text-sm text-[#A1A1AA] text-center line-clamp-2">
            {episode.title}
          </span>
        </div>
      )}

      {/* Hover play scrim */}
      <div className="absolute inset-0 bg-black/35 group-hover/thumb:bg-black/50 transition-colors duration-150 flex items-center justify-center">
        <span className="w-12 h-12 rounded-full bg-black/70 border border-white/60 text-white flex items-center justify-center opacity-90 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 group-hover/thumb:bg-[#E50914] group-hover/thumb:border-[#E50914] transition-all duration-150">
          <Play className="w-5 h-5 fill-current mr-0.5" aria-hidden="true" />
        </span>
      </div>

      {/* Bottom Watch Progress Bar */}
      {(progressPercent > 0 || isWatched) && (
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
          <div
            className="h-full bg-[#E50914]"
            style={{
              width: `${isWatched ? 100 : Math.min(100, Math.max(4, progressPercent))}%`,
            }}
          />
        </div>
      )}
    </button>
  );
};

export const SeriesShowcase: React.FC<SeriesShowcaseProps> = ({
  series,
  accessToken,
  customization,
  isViewerMode,
  watchProgress,
  onPlayEpisode,
  onToggleWatched,
  onOpenShare,
  onToggleViewerMode,
  onChangeFolder,
}) => {
  const [activeSeasonId, setActiveSeasonId] = useState<string>(
    series.seasons[0]?.id || ''
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');

  const [customCoverBlobUrl, setCustomCoverBlobUrl] = useState<string | null>(null);
  const [heroStage, setHeroStage] = useState<
    'override' | 'blob' | 'publicCover' | 'thumb' | 'fallback' | 'css'
  >('fallback');

  const displayTitle = customization.title?.trim() || series.name;
  const displayDescription = customization.description?.trim() || series.description;
  const displayGenre = customization.genre?.trim() || '';
  const displayYear = customization.year?.trim() || '';

  useEffect(() => {
    setActiveSeasonId(series.seasons[0]?.id || '');
    setSearchTerm('');
  }, [series.id, series.seasons]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    const firstEpisodeThumb = series.seasons[0]?.episodes[0]?.thumbnailUrl;

    if (customization.coverUrl?.trim()) {
      setCustomCoverBlobUrl(null);
      setHeroStage('override');
      return;
    }

    if (series.isPublicSource && series.coverImageUrl) {
      setCustomCoverBlobUrl(null);
      setHeroStage('publicCover');
      return;
    }

    if (series.coverImageId && accessToken) {
      fetchDriveMediaBlobUrl(accessToken, series.coverImageId)
        .then((url) => {
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          revokedUrl = url;
          setCustomCoverBlobUrl(url);
          setHeroStage('blob');
        })
        .catch(() => {
          if (!cancelled) {
            setHeroStage(
              series.coverImageUrl
                ? 'publicCover'
                : firstEpisodeThumb
                ? 'thumb'
                : 'fallback'
            );
          }
        });
    } else if (series.coverImageUrl) {
      setCustomCoverBlobUrl(null);
      setHeroStage('publicCover');
    } else if (firstEpisodeThumb) {
      setCustomCoverBlobUrl(null);
      setHeroStage('thumb');
    } else {
      setCustomCoverBlobUrl(null);
      setHeroStage('fallback');
    }

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [
    series.id,
    series.coverImageId,
    series.coverImageUrl,
    series.isPublicSource,
    series.seasons,
    accessToken,
    customization.coverUrl,
  ]);

  const allEpisodes = useMemo(
    () => series.seasons.flatMap((s) => s.episodes),
    [series.seasons]
  );

  const resumeEpisode = useMemo(() => {
    if (allEpisodes.length === 0) return null;

    let latestEntry: WatchProgressEntry | null = null;
    for (const ep of allEpisodes) {
      const p = watchProgress[ep.id];
      if (p && (!latestEntry || p.updatedAt > latestEntry.updatedAt)) {
        latestEntry = p;
      }
    }

    if (!latestEntry) return { episode: allEpisodes[0], isResume: false };

    const lastIdx = allEpisodes.findIndex((e) => e.id === latestEntry!.episodeId);
    if (lastIdx === -1) return { episode: allEpisodes[0], isResume: false };

    if (latestEntry.watched && lastIdx + 1 < allEpisodes.length) {
      return { episode: allEpisodes[lastIdx + 1], isResume: true };
    }
    return { episode: allEpisodes[lastIdx], isResume: true };
  }, [allEpisodes, watchProgress]);

  const activeSeason = useMemo(
    () => series.seasons.find((s) => s.id === activeSeasonId) || series.seasons[0],
    [series.seasons, activeSeasonId]
  );

  const visibleEpisodes = useMemo(() => {
    const base = activeSeason?.episodes || [];
    const filtered = searchTerm.trim()
      ? base.filter(
          (ep) =>
            ep.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
            ep.rawName.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
            String(ep.episodeNumber).includes(searchTerm.trim())
        )
      : base;

    return sortAsc ? filtered : [...filtered].reverse();
  }, [activeSeason, searchTerm, sortAsc]);

  const watchedCount = useMemo(
    () => allEpisodes.filter((ep) => watchProgress[ep.id]?.watched).length,
    [allEpisodes, watchProgress]
  );

  const firstEpisodeThumb = series.seasons[0]?.episodes[0]?.thumbnailUrl;

  const renderHeroBackground = () => {
    if (heroStage === 'override' && customization.coverUrl?.trim()) {
      return (
        <img
          src={customization.coverUrl.trim()}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={() =>
            setHeroStage(
              series.coverImageUrl
                ? 'publicCover'
                : firstEpisodeThumb
                ? 'thumb'
                : 'fallback'
            )
          }
          className="w-full h-full object-cover object-center opacity-70"
        />
      );
    }
    if (heroStage === 'blob' && customCoverBlobUrl) {
      return (
        <img
          src={customCoverBlobUrl}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={() => setHeroStage(firstEpisodeThumb ? 'thumb' : 'fallback')}
          className="w-full h-full object-cover object-center opacity-70"
        />
      );
    }
    if (heroStage === 'publicCover' && series.coverImageUrl) {
      return (
        <img
          src={series.coverImageUrl}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={() => setHeroStage(firstEpisodeThumb ? 'thumb' : 'fallback')}
          className="w-full h-full object-cover object-center opacity-70"
        />
      );
    }
    if (heroStage === 'thumb' && firstEpisodeThumb) {
      return (
        <img
          src={firstEpisodeThumb}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={() => setHeroStage('fallback')}
          className="w-full h-full object-cover object-center opacity-55 scale-[1.02]"
        />
      );
    }
    if (heroStage === 'fallback') {
      return (
        <img
          src={heroFallbackImg}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={() => setHeroStage('css')}
          className="w-full h-full object-cover object-center opacity-60"
        />
      );
    }
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#201114] via-[#0A0A0C] to-[#11131B]" />
    );
  };

  return (
    <div className="pb-20">
      {/* Cinematic Netflix Hero Billboard */}
      <section
        id="series-hero"
        className="relative min-h-[64vh] lg:min-h-[72vh] flex items-end overflow-hidden border-b border-white/[0.06]"
      >
        <div className="absolute inset-0">
          {renderHeroBackground()}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/55 to-[#0A0A0C]/25" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0C]/95 via-[#0A0A0C]/55 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 py-12 lg:py-16">
          <div className="max-w-2xl space-y-5">
            {/* Unboxed Clean Metadata */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#D4D4D8]">
              <span className="font-display font-bold text-[#E50914]">
                {displayGenre || 'مسلسل'}
              </span>
              {displayYear && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{displayYear}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">
                {series.seasons.length > 1
                  ? `${series.seasons.length} مواسم`
                  : 'موسم واحد'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{series.totalEpisodes} حلقة</span>
              {series.totalEpisodes > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{series.highestQuality}</span>
                </>
              )}
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.12] tracking-tight [text-wrap:balance]">
              {displayTitle}
            </h1>

            <p className="text-sm sm:text-base text-[#D4D4D8] leading-relaxed max-w-xl">
              {displayDescription ||
                (series.totalEpisodes > 0
                  ? `${series.totalEpisodes} حلقة متاحة للمشاهدة المباشرة${
                      series.totalDurationMs > 0
                        ? ` بمدة إجمالية ${formatDurationAr(series.totalDurationMs)}`
                        : ''
                    }.${
                      watchedCount > 0
                        ? ` شاهدت حتى الآن ${watchedCount} من ${series.totalEpisodes} حلقة.`
                        : ''
                    }`
                  : 'لم يتم العثور على ملفات فيديو داخل هذا المجلد بعد.')}
            </p>

            {/* Primary Action Row */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {resumeEpisode && (
                <button
                  type="button"
                  onClick={() => onPlayEpisode(resumeEpisode.episode)}
                  className="h-12 px-7 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-base inline-flex items-center gap-2.5 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                  <span>
                    {resumeEpisode.isResume
                      ? `متابعة الحلقة ${resumeEpisode.episode.episodeNumber}`
                      : `تشغيل الحلقة ${resumeEpisode.episode.episodeNumber}`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenShare()}
                className="h-12 px-6 rounded-md bg-white/15 hover:bg-white/25 text-white font-display font-semibold text-sm inline-flex items-center gap-2 backdrop-blur-sm transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                {isViewerMode ? (
                  <>
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    <span>مشاركة الرابط</span>
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                    <span>تخصيص ونشر الرابط</span>
                  </>
                )}
              </button>

              {!isViewerMode && onToggleViewerMode && (
                <button
                  type="button"
                  onClick={onToggleViewerMode}
                  className="h-12 px-5 rounded-md bg-[#141418]/80 hover:bg-[#1E1E24] border border-white/[0.12] text-[#E4E4E7] hover:text-white font-display font-medium text-sm inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>معاينة كزائر</span>
                </button>
              )}

              {!isViewerMode && onChangeFolder && (
                <button
                  type="button"
                  onClick={onChangeFolder}
                  className="h-12 px-5 rounded-md bg-[#141418]/80 hover:bg-[#1E1E24] border border-white/[0.12] text-[#A1A1AA] hover:text-white font-display font-medium text-sm inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" aria-hidden="true" />
                  <span>تغيير المسلسل</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Seasons & Episodes Section */}
      <section id="episodes-section" className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        {series.totalEpisodes === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#141418] p-10 text-center space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              لا توجد حلقات فيديو في هذا المجلد
            </h2>
            <p className="text-sm text-[#A1A1AA] max-w-lg mx-auto leading-relaxed">
              تأكد من اختيار المجلد الذي يحتوي على ملفات فيديو (MP4 أو MKV أو WebM) أو مجلدات فرعية للمواسم.
            </p>
            {onChangeFolder && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onChangeFolder}
                  className="px-6 py-2.5 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm transition-colors cursor-pointer"
                >
                  اختيار مجلد آخر
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="font-display text-2xl font-bold text-white whitespace-nowrap">
                  الحلقات
                </h2>

                {series.seasons.length > 1 && (
                  <div
                    role="tablist"
                    aria-label="المواسم"
                    className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#141418] border border-white/[0.08]"
                  >
                    {series.seasons.map((season) => {
                      const active = season.id === activeSeason?.id;
                      return (
                        <button
                          key={season.id}
                          role="tab"
                          aria-selected={active}
                          type="button"
                          onClick={() => setActiveSeasonId(season.id)}
                          className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-display font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-white text-[#0A0A0C]'
                              : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {season.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:flex-none sm:w-56">
                  <Search
                    className="w-4 h-4 text-[#71717A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن حلقة..."
                    className="w-full h-10 pr-9 pl-3 rounded-lg bg-[#141418] border border-white/[0.1] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-white/30"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSortAsc((prev) => !prev)}
                  className="h-10 px-3.5 rounded-lg bg-[#141418] border border-white/[0.1] hover:border-white/25 text-xs font-medium text-[#D4D4D8] hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ArrowDownUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{sortAsc ? 'من الأولى للأخيرة' : 'من الأخيرة للأولى'}</span>
                </button>

                <div className="inline-flex items-center p-1 rounded-lg bg-[#141418] border border-white/[0.1]">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('list')}
                    aria-label="عرض قائمة"
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      layoutMode === 'list'
                        ? 'bg-white text-[#0A0A0C]'
                        : 'text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('grid')}
                    aria-label="عرض شبكي"
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      layoutMode === 'grid'
                        ? 'bg-white text-[#0A0A0C]'
                        : 'text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Episodes List or Grid */}
            {visibleEpisodes.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#A1A1AA]">
                لا توجد حلقات مطابقة للبحث «{searchTerm}».
              </p>
            ) : layoutMode === 'list' ? (
              <div className="divide-y divide-white/[0.07]">
                {visibleEpisodes.map((episode) => {
                  const prog = watchProgress[episode.id];
                  const isWatched = Boolean(prog?.watched);
                  const progressPct =
                    prog && prog.durationSec > 0
                      ? (prog.currentTimeSec / prog.durationSec) * 100
                      : 0;

                  return (
                    <article
                      key={episode.id}
                      className="py-5 first:pt-2 flex flex-col sm:flex-row sm:items-center gap-5 hover:bg-white/[0.025] px-3 -mx-3 rounded-xl transition-colors duration-150"
                    >
                      <span className="hidden sm:block w-8 text-center font-mono-num text-xl font-semibold text-[#71717A] shrink-0">
                        {String(episode.episodeNumber).padStart(2, '0')}
                      </span>

                      <div className="w-full sm:w-56 md:w-64 shrink-0">
                        <EpisodeThumb
                          episode={episode}
                          progressPercent={progressPct}
                          isWatched={isWatched}
                          onPlay={() => onPlayEpisode(episode)}
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onPlayEpisode(episode)}
                            className="text-right group cursor-pointer"
                          >
                            <h3 className="font-display font-bold text-base sm:text-lg text-white group-hover:text-[#E50914] transition-colors">
                              <span className="sm:hidden font-mono-num text-[#71717A] ml-2">
                                {String(episode.episodeNumber).padStart(2, '0')}
                              </span>
                              {episode.title}
                            </h3>
                          </button>

                          {episode.durationMs > 0 && (
                            <span className="font-mono-num text-xs text-[#A1A1AA] whitespace-nowrap shrink-0 pt-1">
                              {formatDurationAr(episode.durationMs)}
                            </span>
                          )}
                        </div>

                        {episode.description && (
                          <p className="text-sm text-[#A1A1AA] line-clamp-2 leading-relaxed">
                            {episode.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#71717A]">
                          <span className="font-mono-num">{episode.qualityLabel}</span>
                          {episode.sizeBytes > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">
                                {formatFileSize(episode.sizeBytes)}
                              </span>
                            </>
                          )}
                          {episode.modifiedTime && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{formatArabicDate(episode.modifiedTime)}</span>
                            </>
                          )}
                          {episode.subtitles.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-[#D4D4D8]">
                                <Subtitles className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>ترجمة متوفرة</span>
                              </span>
                            </>
                          )}
                          {isWatched && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#E4E4E7]">تمت المشاهدة</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleWatched(episode.id, !isWatched)}
                          className={`h-9 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                            isWatched
                              ? 'bg-white text-[#0A0A0C] border-white'
                              : 'bg-transparent text-[#A1A1AA] border-white/[0.12] hover:text-white hover:border-white/30'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isWatched ? 'شاهدتها' : 'تمت المشاهدة'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenShare(episode)}
                          className="h-9 px-3 rounded-md border border-white/[0.12] hover:border-white/30 text-xs font-medium text-[#A1A1AA] hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>مشاركة</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleEpisodes.map((episode) => {
                  const prog = watchProgress[episode.id];
                  const isWatched = Boolean(prog?.watched);
                  const progressPct =
                    prog && prog.durationSec > 0
                      ? (prog.currentTimeSec / prog.durationSec) * 100
                      : 0;

                  return (
                    <article
                      key={episode.id}
                      className="rounded-xl bg-[#141418] border border-white/[0.08] hover:border-white/[0.2] transition-colors overflow-hidden flex flex-col"
                    >
                      <div className="p-2.5 pb-0">
                        <EpisodeThumb
                          episode={episode}
                          progressPercent={progressPct}
                          isWatched={isWatched}
                          onPlay={() => onPlayEpisode(episode)}
                        />
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#71717A]">
                            <span className="font-mono-num">
                              الحلقة {String(episode.episodeNumber).padStart(2, '0')}
                            </span>
                            {episode.durationMs > 0 && (
                              <span className="font-mono-num">
                                {formatDurationAr(episode.durationMs)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onPlayEpisode(episode)}
                            className="text-right cursor-pointer"
                          >
                            <h3 className="font-display font-bold text-base text-white hover:text-[#E50914] transition-colors line-clamp-2">
                              {episode.title}
                            </h3>
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs text-[#A1A1AA]">
                          <span className="font-mono-num">{episode.qualityLabel}</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onToggleWatched(episode.id, !isWatched)}
                              className={`hover:text-white transition-colors cursor-pointer ${
                                isWatched ? 'text-white font-semibold' : ''
                              }`}
                            >
                              {isWatched ? 'شاهدتها' : 'تحديد كمشاهدة'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenShare(episode)}
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              مشاركة
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
