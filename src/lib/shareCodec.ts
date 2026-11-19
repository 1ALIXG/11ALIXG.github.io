import { Episode, Season, SeriesCustomization, SeriesData } from '../types';

export interface CompactEpisode {
  i: string; // Google Drive file ID
  t: string; // Title
  n: number; // Episode number
  d?: number; // Duration in minutes (rounded)
  q?: string; // Quality label
  x?: string; // Optional short description
}

export interface CompactSeason {
  n: string; // Season name
  e: CompactEpisode[];
}

export interface CompactSeriesPayload {
  v: 1;
  id: string;
  n: string; // Title
  d?: string; // Description
  g?: string; // Genre
  y?: string; // Year
  c?: string; // Cover image URL or Drive file ID
  s: CompactSeason[];
  ep?: string; // Optional initial episode ID
}

export interface PublishedSeriesFile {
  published: boolean;
  series?: CompactSeriesPayload;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function compressBytes(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(new Uint8Array(input));
    writer.close();
    const res = new Response(cs.readable);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function decompressBytes(input: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(input));
  writer.close();
  const res = new Response(ds.readable);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export function buildCompactPayload(
  series: SeriesData,
  customization: SeriesCustomization,
  initialEpisodeId?: string | null
): CompactSeriesPayload {
  const title = customization.title?.trim() || series.name;
  const desc = customization.description?.trim() || series.description || undefined;
  const cover =
    customization.coverUrl?.trim() ||
    (series.coverImageId ? `drive:${series.coverImageId}` : series.coverImageUrl || undefined);

  const seasons: CompactSeason[] = series.seasons.map((season) => ({
    n: season.name,
    e: season.episodes.map((ep) => {
      const compact: CompactEpisode = {
        i: ep.id,
        t: ep.title,
        n: ep.episodeNumber,
      };
      if (ep.durationMs > 0) compact.d = Math.max(1, Math.round(ep.durationMs / 60000));
      if (ep.qualityLabel && ep.qualityLabel !== 'HD') compact.q = ep.qualityLabel;
      if (ep.description) compact.x = ep.description.slice(0, 180);
      return compact;
    }),
  }));

  return {
    v: 1,
    id: series.id,
    n: title,
    d: desc,
    g: customization.genre?.trim() || undefined,
    y: customization.year?.trim() || undefined,
    c: cover,
    s: seasons,
    ep: initialEpisodeId || undefined,
  };
}

export function expandCompactPayload(payload: CompactSeriesPayload): {
  series: SeriesData;
  customization: SeriesCustomization;
  initialEpisodeId: string | null;
} {
  let coverImageId: string | undefined;
  let coverImageUrl: string | undefined;
  let customCoverUrl: string | undefined;

  if (payload.c) {
    if (payload.c.startsWith('drive:')) {
      coverImageId = payload.c.slice(6);
      coverImageUrl = `https://lh3.googleusercontent.com/d/${encodeURIComponent(coverImageId)}=w1600`;
    } else {
      customCoverUrl = payload.c;
      coverImageUrl = payload.c;
    }
  }

  const seasons: Season[] = (payload.s || []).map((s, sIdx) => {
    const episodes: Episode[] = (s.e || []).map((ep, eIdx) => ({
      id: ep.i,
      rawName: ep.t,
      title: ep.t || `الحلقة ${ep.n || eIdx + 1}`,
      episodeNumber: ep.n || eIdx + 1,
      seasonIndex: sIdx + 1,
      seasonName: s.n || `الموسم ${sIdx + 1}`,
      description: ep.x || '',
      mimeType: 'video/mp4',
      sizeBytes: 0,
      durationMs: ep.d ? ep.d * 60000 : 0,
      qualityLabel: ep.q || 'HD',
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(ep.i)}&sz=w960`,
      webViewLink: `https://drive.google.com/file/d/${encodeURIComponent(ep.i)}/view`,
      subtitles: [],
    }));

    return {
      id: `${payload.id}-s${sIdx + 1}`,
      name: s.n || `الموسم ${sIdx + 1}`,
      index: sIdx + 1,
      episodes,
    };
  });

  const allEpisodes = seasons.flatMap((s) => s.episodes);
  const totalDurationMs = allEpisodes.reduce((acc, ep) => acc + ep.durationMs, 0);

  let highestQuality = 'HD';
  if (allEpisodes.some((e) => e.qualityLabel.startsWith('4K'))) highestQuality = '4K UHD';
  else if (allEpisodes.some((e) => e.qualityLabel.startsWith('2K'))) highestQuality = '2K QHD';
  else if (allEpisodes.some((e) => e.qualityLabel.startsWith('1080p'))) highestQuality = '1080p HD';
  else if (allEpisodes.some((e) => e.qualityLabel.startsWith('720p'))) highestQuality = '720p HD';

  const series: SeriesData = {
    id: payload.id || 'shared-series',
    name: payload.n || 'مسلسل',
    description: payload.d || '',
    shared: true,
    isPublicLink: true,
    permissionsCount: 1,
    ownerName: '',
    webViewLink:
      payload.id && payload.id !== 'manual-series'
        ? `https://drive.google.com/drive/folders/${encodeURIComponent(payload.id)}`
        : 'https://drive.google.com',
    coverImageId,
    coverImageUrl,
    seasons,
    totalEpisodes: allEpisodes.length,
    totalDurationMs,
    highestQuality,
    isPublicSource: true,
  };

  const customization: SeriesCustomization = {
    title: payload.n,
    description: payload.d,
    genre: payload.g,
    year: payload.y,
    coverUrl: customCoverUrl,
  };

  return {
    series,
    customization,
    initialEpisodeId: payload.ep || null,
  };
}

export async function encodeSeriesToHashToken(
  payload: CompactSeriesPayload
): Promise<string> {
  const json = JSON.stringify(payload);
  const rawBytes = new TextEncoder().encode(json);
  const compressed = await compressBytes(rawBytes);
  if (compressed && compressed.length < rawBytes.length) {
    return `z.${bytesToBase64Url(compressed)}`;
  }
  return `r.${bytesToBase64Url(rawBytes)}`;
}

export async function decodeSeriesFromHashToken(
  token: string
): Promise<CompactSeriesPayload | null> {
  try {
    const trimmed = token.trim();
    if (!trimmed) return null;

    let bytes: Uint8Array;
    if (trimmed.startsWith('z.')) {
      bytes = await decompressBytes(base64UrlToBytes(trimmed.slice(2)));
    } else if (trimmed.startsWith('r.')) {
      bytes = base64UrlToBytes(trimmed.slice(2));
    } else {
      bytes = base64UrlToBytes(trimmed);
    }

    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as CompactSeriesPayload;
    if (!parsed || !Array.isArray(parsed.s)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extractDriveFileIdsFromText(text: string): Array<{
  id: string;
  customTitle?: string;
}> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: Array<{ id: string; customTitle?: string }> = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Allow optional "Title | https://drive.google.com/file/d/ID/view" format
    const parts = line.split('|').map((p) => p.trim());
    const linkPart = parts.length > 1 ? parts[parts.length - 1] : line;
    const titlePart = parts.length > 1 ? parts.slice(0, -1).join(' | ').trim() : undefined;

    const fileMatch = linkPart.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
    const queryMatch = linkPart.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    const rawIdMatch = /^[a-zA-Z0-9_-]{20,80}$/.test(linkPart) ? [linkPart, linkPart] : null;

    const id = fileMatch?.[1] || queryMatch?.[1] || rawIdMatch?.[1];
    if (id && !seen.has(id)) {
      seen.add(id);
      results.push({ id, customTitle: titlePart });
    }
  }

  return results;
}

export function buildManualSeries(params: {
  title: string;
  description?: string;
  genre?: string;
  year?: string;
  coverInput?: string;
  seasonName?: string;
  linksText: string;
}): { series: SeriesData; customization: SeriesCustomization } | null {
  const items = extractDriveFileIdsFromText(params.linksText);
  if (items.length === 0) return null;

  // Support either direct image URL or a Google Drive image link as cover
  let coverUrl = params.coverInput?.trim() || undefined;
  if (coverUrl) {
    const driveImg = coverUrl.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/) || coverUrl.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if (driveImg?.[1]) {
      coverUrl = `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveImg[1])}=w1600`;
    }
  }

  const seasonTitle = params.seasonName?.trim() || 'الموسم الأول';
  const episodes: Episode[] = items.map((item, idx) => ({
    id: item.id,
    rawName: item.customTitle || `الحلقة ${idx + 1}`,
    title: item.customTitle || `الحلقة ${idx + 1}`,
    episodeNumber: idx + 1,
    seasonIndex: 1,
    seasonName: seasonTitle,
    description: '',
    mimeType: 'video/mp4',
    sizeBytes: 0,
    durationMs: 0,
    qualityLabel: 'HD',
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w960`,
    webViewLink: `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/view`,
    subtitles: [],
  }));

  const series: SeriesData = {
    id: 'manual-series',
    name: params.title.trim() || 'مسلسل جديد',
    description: params.description?.trim() || '',
    shared: true,
    isPublicLink: true,
    permissionsCount: 1,
    ownerName: '',
    webViewLink: 'https://drive.google.com',
    coverImageUrl: coverUrl,
    seasons: [
      {
        id: 'manual-s1',
        name: seasonTitle,
        index: 1,
        episodes,
      },
    ],
    totalEpisodes: episodes.length,
    totalDurationMs: 0,
    highestQuality: 'HD',
    isPublicSource: true,
  };

  return {
    series,
    customization: {
      title: params.title.trim() || 'مسلسل جديد',
      description: params.description?.trim() || undefined,
      genre: params.genre?.trim() || undefined,
      year: params.year?.trim() || undefined,
      coverUrl,
    },
  };
}

export async function fetchPublishedSeriesJson(): Promise<PublishedSeriesFile | null> {
  try {
    const res = await fetch('./series.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as PublishedSeriesFile;
    if (data && data.published && data.series) return data;
    return null;
  } catch {
    return null;
  }
}
