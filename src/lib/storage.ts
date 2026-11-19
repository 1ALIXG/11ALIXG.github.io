import { RecentSeriesEntry, WatchProgressEntry } from '../types';

const PROGRESS_KEY = 'cinemadrive_watch_progress_v1';
const RECENTS_KEY = 'cinemadrive_recent_series_v1';

export function getAllWatchProgress(): Record<string, WatchProgressEntry> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WatchProgressEntry>) : {};
  } catch {
    return {};
  }
}

export function saveWatchProgress(entry: WatchProgressEntry): Record<string, WatchProgressEntry> {
  const all = getAllWatchProgress();
  all[entry.episodeId] = entry;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
  return all;
}

export function toggleEpisodeWatched(
  seriesId: string,
  episodeId: string,
  watched: boolean
): Record<string, WatchProgressEntry> {
  const all = getAllWatchProgress();
  const prev = all[episodeId];
  all[episodeId] = {
    episodeId,
    seriesId,
    watched,
    currentTimeSec: watched ? prev?.durationSec || 0 : 0,
    durationSec: prev?.durationSec || 0,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
  return all;
}

export function getRecentSeries(): RecentSeriesEntry[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as RecentSeriesEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordRecentSeries(entry: RecentSeriesEntry): RecentSeriesEntry[] {
  const list = getRecentSeries().filter((item) => item.id !== entry.id);
  const next = [entry, ...list].slice(0, 8);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function removeRecentSeries(folderId: string): RecentSeriesEntry[] {
  const next = getRecentSeries().filter((item) => item.id !== folderId);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
