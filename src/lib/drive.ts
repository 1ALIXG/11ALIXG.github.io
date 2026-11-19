import {
  DriveFileRaw,
  DriveFolderItem,
  Episode,
  Season,
  SeriesData,
  SubtitleFile,
} from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS =
  'id,name,mimeType,description,size,modifiedTime,createdTime,thumbnailLink,webViewLink,shared,owners(displayName,emailAddress,photoLink),permissions(id,type,role,emailAddress,displayName),videoMediaMetadata(width,height,durationMillis)';

export class DriveAuthExpiredError extends Error {
  constructor(message = 'انتهت جلسة الدخول إلى Google Drive، يرجى تسجيل الدخول مجدداً.') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

export class PublicFolderPrivateError extends Error {
  constructor(
    message = 'هذا المجلد خاص في Google Drive. فعّل خيار «أي شخص لديه الرابط» كعارض في Google Drive لفتحه بدون تسجيل دخول، أو سجّل الدخول بحساب Google.'
  ) {
    super(message);
    this.name = 'PublicFolderPrivateError';
  }
}

export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match /folders/<id>
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (foldersMatch?.[1]) return foldersMatch[1];

  // Match ?id=<id> or &id=<id> or ?watch=<id> or ?folder=<id>
  const queryIdMatch = trimmed.match(/[?&](?:id|watch|folder)=([a-zA-Z0-9_-]{10,})/);
  if (queryIdMatch?.[1]) return queryIdMatch[1];

  // Match raw Google Drive ID
  if (/^[a-zA-Z0-9_-]{15,80}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export async function loadPublicSeriesFromFolder(folderId: string): Promise<SeriesData> {
  const res = await fetch(`/api/public-series/${encodeURIComponent(folderId)}`);
  const data = await res.json().catch(() => ({}));

  if (res.status === 403 || data?.code === 'PRIVATE_FOLDER') {
    throw new PublicFolderPrivateError(data?.error);
  }

  if (!res.ok) {
    throw new Error(
      data?.error || 'تعذّر قراءة المجلد من Google Drive. تأكد من صحة الرابط ومن تفعيل المشاركة.'
    );
  }

  return data as SeriesData;
}

async function driveFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    throw new DriveAuthExpiredError();
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || '';
    } catch {
      // ignore json parse failure
    }
    if (res.status === 404) {
      throw new Error(
        'تعذّر العثور على المجلد. تأكد من صحة الرابط وأن المجلد تمت مشاركته مع حسابك في Google Drive.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        'ليس لديك صلاحية الوصول إلى هذا المجلد. اطلب من صاحب المجلد مشاركته معك بصلاحية «عارض».'
      );
    }
    throw new Error(detail || `حدث خطأ أثناء الاتصال بـ Google Drive (${res.status})`);
  }

  return (await res.json()) as T;
}

function naturalSort<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, ['ar', 'en'], { numeric: true, sensitivity: 'base' })
  );
}

function stripExtension(name: string): string {
  return name.replace(/\.[a-zA-Z0-9]{2,5}$/, '').trim();
}

function isVideoFile(file: DriveFileRaw): boolean {
  if (file.mimeType.startsWith('video/')) return true;
  return /\.(mp4|mkv|webm|mov|avi|m4v|ts|flv)$/i.test(file.name);
}

function isImageFile(file: DriveFileRaw): boolean {
  if (file.mimeType.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function isSubtitleFile(file: DriveFileRaw): boolean {
  return /\.(vtt|srt)$/i.test(file.name);
}

function getQualityLabel(width?: number, height?: number): string {
  const h = height || 0;
  const w = width || 0;
  if (h >= 2000 || w >= 3800) return '4K UHD';
  if (h >= 1400 || w >= 2500) return '2K QHD';
  if (h >= 1000 || w >= 1900) return '1080p HD';
  if (h >= 700 || w >= 1200) return '720p HD';
  if (h > 0) return `${h}p`;
  return 'HD';
}

function parseEpisodeInfo(
  rawName: string,
  fallbackIndex: number
): { title: string; episodeNumber: number } {
  const withoutExt = stripExtension(rawName);

  const sxeMatch = withoutExt.match(/(?:S\d{1,2}\s*[._-]?\s*)?(?:E|EP|Episode)\s*[._-]?\s*(\d{1,3})/i);
  const arMatch = withoutExt.match(/(?:الحلقة|حلقة|ح)\s*[._:-]?\s*(\d{1,3})/);
  const leadMatch = withoutExt.match(/^(\d{1,3})\s*[._:-]+\s*(.+)$/);

  let epNum = fallbackIndex;
  if (sxeMatch?.[1]) {
    epNum = parseInt(sxeMatch[1], 10);
  } else if (arMatch?.[1]) {
    epNum = parseInt(arMatch[1], 10);
  } else if (leadMatch?.[1]) {
    epNum = parseInt(leadMatch[1], 10);
  }

  const cleaned = withoutExt
    .replace(/\b(1080p|720p|2160p|4K|WEB-DL|WEBRip|BluRay|HDRip|x264|x265|HEVC|AAC|H\.?264|H\.?265|10bit|DDP5\.1)\b/gi, '')
    .replace(/[._]+/g, ' ')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    title: cleaned || `الحلقة ${epNum}`,
    episodeNumber: Number.isFinite(epNum) && epNum > 0 ? epNum : fallbackIndex,
  };
}

function detectSubtitleLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('.ar.') || lower.includes('arabic') || lower.includes('عربي') || lower.includes('العربية')) {
    return 'العربية';
  }
  if (lower.includes('.en.') || lower.includes('english') || lower.includes('إنجليزي')) {
    return 'English';
  }
  if (lower.includes('.fr.') || lower.includes('french')) {
    return 'Français';
  }
  return 'ترجمة';
}

function upgradeThumbnailUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/=s\d+.*$/, '=s960');
}

function matchSubtitlesForVideo(videoName: string, subtitles: SubtitleFile[]): SubtitleFile[] {
  const videoBase = stripExtension(videoName).toLowerCase();
  return subtitles.filter(
    (sub) =>
      sub.baseName.toLowerCase() === videoBase ||
      sub.baseName.toLowerCase().startsWith(videoBase + '.') ||
      videoBase.startsWith(sub.baseName.toLowerCase())
  );
}

function buildEpisodes(
  files: DriveFileRaw[],
  seasonIndex: number,
  seasonName: string
): Episode[] {
  const videos = naturalSort(files.filter(isVideoFile));
  const subtitleFiles: SubtitleFile[] = files.filter(isSubtitleFile).map((f) => ({
    id: f.id,
    name: f.name,
    baseName: stripExtension(f.name),
    languageLabel: detectSubtitleLanguage(f.name),
  }));

  return videos.map((file, idx) => {
    const parsed = parseEpisodeInfo(file.name, idx + 1);
    const durationMs = Number(file.videoMediaMetadata?.durationMillis || 0);
    const sizeBytes = Number(file.size || 0);
    const qualityLabel = getQualityLabel(
      file.videoMediaMetadata?.width,
      file.videoMediaMetadata?.height
    );

    return {
      id: file.id,
      rawName: file.name,
      title: parsed.title,
      episodeNumber: parsed.episodeNumber,
      seasonIndex,
      seasonName,
      description: file.description?.trim() || '',
      mimeType: file.mimeType,
      sizeBytes,
      durationMs,
      width: file.videoMediaMetadata?.width,
      height: file.videoMediaMetadata?.height,
      qualityLabel,
      modifiedTime: file.modifiedTime,
      thumbnailUrl: upgradeThumbnailUrl(file.thumbnailLink),
      webViewLink: file.webViewLink,
      subtitles: matchSubtitlesForVideo(file.name, subtitleFiles),
    };
  });
}

async function listFolderChildren(token: string, folderId: string): Promise<DriveFileRaw[]> {
  const allFiles: DriveFileRaw[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await driveFetch<{ files?: DriveFileRaw[]; nextPageToken?: string }>(
      `${DRIVE_API}/files?${params.toString()}`,
      token
    );
    if (data.files) allFiles.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken && allFiles.length < 600);

  return allFiles;
}

export async function listDriveFolders(
  token: string,
  options: {
    mode: 'my-drive' | 'shared' | 'search';
    parentId?: string;
    searchQuery?: string;
  }
): Promise<DriveFolderItem[]> {
  let q = `mimeType = '${FOLDER_MIME}' and trashed = false`;

  if (options.mode === 'shared') {
    q += ' and sharedWithMe = true';
  } else if (options.mode === 'search' && options.searchQuery?.trim()) {
    const safeQuery = options.searchQuery.trim().replace(/'/g, "\\'");
    q += ` and name contains '${safeQuery}'`;
  } else {
    const parent = options.parentId || 'root';
    q += ` and '${parent}' in parents`;
  }

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,modifiedTime,shared,owners(displayName,emailAddress),description)',
    orderBy: 'modifiedTime desc',
    pageSize: '60',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const data = await driveFetch<{ files?: DriveFolderItem[] }>(
    `${DRIVE_API}/files?${params.toString()}`,
    token
  );

  return data.files || [];
}

export async function loadSeriesFromFolder(
  token: string,
  folderId: string
): Promise<SeriesData> {
  const folderMeta = await driveFetch<DriveFileRaw>(
    `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=${encodeURIComponent(
      FILE_FIELDS
    )}&supportsAllDrives=true`,
    token
  );

  if (folderMeta.mimeType !== FOLDER_MIME) {
    throw new Error('الرابط المحدد ليس مجلداً في Google Drive. يرجى اختيار مجلد يحتوي على الحلقات.');
  }

  const rootChildren = await listFolderChildren(token, folderId);

  const images = rootChildren.filter(isImageFile);
  const preferredCover =
    images.find((img) => /(cover|poster|backdrop|banner|hero|غلاف)/i.test(img.name)) || images[0];

  const coverOptions = images.map((img) => ({
    id: img.id,
    name: img.name,
    url: `https://lh3.googleusercontent.com/d/${encodeURIComponent(img.id)}=w1600`,
  }));

  const rootVideos = rootChildren.filter(isVideoFile);
  const subFolders = naturalSort(
    rootChildren.filter((item) => item.mimeType === FOLDER_MIME)
  );

  const seasons: Season[] = [];

  if (rootVideos.length > 0) {
    const rootEpisodes = buildEpisodes(
      rootChildren,
      1,
      subFolders.length > 0 ? 'الحلقات الرئيسية' : 'الموسم الأول'
    );
    seasons.push({
      id: `${folderId}-root`,
      name: subFolders.length > 0 ? 'الحلقات الرئيسية' : 'الموسم الأول',
      index: 1,
      episodes: rootEpisodes,
    });
  }

  if (subFolders.length > 0) {
    const subResults = await Promise.all(
      subFolders.map(async (sub, idx) => {
        const children = await listFolderChildren(token, sub.id);
        const episodes = buildEpisodes(children, seasons.length + idx + 1, sub.name);
        return {
          id: sub.id,
          name: sub.name,
          index: seasons.length + idx + 1,
          episodes,
        };
      })
    );

    subResults.forEach((season) => {
      if (season.episodes.length > 0) {
        seasons.push(season);
      }
    });
  }

  const allEpisodes = seasons.flatMap((s) => s.episodes);
  const totalDurationMs = allEpisodes.reduce((acc, ep) => acc + ep.durationMs, 0);

  let highestQuality = 'HD';
  if (allEpisodes.some((e) => e.qualityLabel.startsWith('4K'))) highestQuality = '4K UHD';
  else if (allEpisodes.some((e) => e.qualityLabel.startsWith('2K'))) highestQuality = '2K QHD';
  else if (allEpisodes.some((e) => e.qualityLabel.startsWith('1080p'))) highestQuality = '1080p HD';
  else if (allEpisodes.some((e) => e.qualityLabel.startsWith('720p'))) highestQuality = '720p HD';

  const permissions = folderMeta.permissions || [];
  const isPublicLink = permissions.some((p) => p.type === 'anyone');

  return {
    id: folderMeta.id,
    name: folderMeta.name,
    description: folderMeta.description?.trim() || '',
    shared: Boolean(folderMeta.shared || permissions.length > 1 || isPublicLink),
    isPublicLink,
    permissionsCount: permissions.length,
    ownerName: folderMeta.owners?.[0]?.displayName || folderMeta.owners?.[0]?.emailAddress || '',
    webViewLink:
      folderMeta.webViewLink || `https://drive.google.com/drive/folders/${folderMeta.id}`,
    modifiedTime: folderMeta.modifiedTime,
    coverImageId: preferredCover?.id,
    coverImageUrl: upgradeThumbnailUrl(preferredCover?.thumbnailLink),
    coverOptions,
    seasons,
    totalEpisodes: allEpisodes.length,
    totalDurationMs,
    highestQuality,
    isPublicSource: false,
  };
}

export async function fetchDriveMediaBlobUrl(token: string, fileId: string): Promise<string> {
  const res = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (res.status === 401) throw new DriveAuthExpiredError();
  if (!res.ok) throw new Error('تعذّر تحميل الملف من Google Drive.');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchSubtitleAsVttUrl(
  token: string,
  fileId: string,
  fileName: string
): Promise<string> {
  const res = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (res.status === 401) throw new DriveAuthExpiredError();
  if (!res.ok) throw new Error('تعذّر تحميل ملف الترجمة.');

  let text = await res.text();
  if (fileName.toLowerCase().endsWith('.srt')) {
    text = convertSrtToVtt(text);
  }
  const blob = new Blob([text], { type: 'text/vtt;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function convertSrtToVtt(srt: string): string {
  const normalized = srt.replace(/\r+/g, '').trim();
  const converted = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );
  return `WEBVTT\n\n${converted}\n`;
}

export function formatDurationAr(ms: number): string {
  if (!ms || ms <= 0) return '';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) {
    const secs = Math.max(1, Math.round(ms / 1000));
    return `${secs} ثانية`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} دقيقة`;
  if (mins === 0) return hours === 1 ? 'ساعة' : `${hours} ساعات`;
  return `${hours} س ${mins} د`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

export function formatArabicDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
