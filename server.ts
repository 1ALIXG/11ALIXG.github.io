import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface ParsedEntry {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  modifiedLabel: string;
}

interface PublicSubtitle {
  id: string;
  name: string;
  baseName: string;
  languageLabel: string;
}

interface PublicEpisode {
  id: string;
  rawName: string;
  title: string;
  episodeNumber: number;
  seasonIndex: number;
  seasonName: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  qualityLabel: string;
  modifiedTime?: string;
  thumbnailUrl: string;
  webViewLink: string;
  subtitles: PublicSubtitle[];
}

interface PublicSeason {
  id: string;
  name: string;
  index: number;
  episodes: PublicEpisode[];
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

function stripExtension(name: string): string {
  return name.replace(/\.[a-zA-Z0-9]{2,5}$/, '').trim();
}

function naturalSort<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, ['ar', 'en'], { numeric: true, sensitivity: 'base' })
  );
}

function isVideoEntry(entry: ParsedEntry): boolean {
  if (entry.isFolder) return false;
  if (entry.mimeType.startsWith('video/')) return true;
  return /\.(mp4|mkv|webm|mov|avi|m4v|ts|flv|wmv)$/i.test(entry.name);
}

function isImageEntry(entry: ParsedEntry): boolean {
  if (entry.isFolder) return false;
  if (entry.mimeType.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp)$/i.test(entry.name);
}

function isSubtitleEntry(entry: ParsedEntry): boolean {
  if (entry.isFolder) return false;
  return /\.(vtt|srt)$/i.test(entry.name);
}

function detectQualityFromName(name: string): string {
  if (/\b(2160p|4k|uhd)\b/i.test(name)) return '4K UHD';
  if (/\b(1440p|2k|qhd)\b/i.test(name)) return '2K QHD';
  if (/\b1080p\b/i.test(name)) return '1080p HD';
  if (/\b720p\b/i.test(name)) return '720p HD';
  if (/\b480p\b/i.test(name)) return '480p';
  return 'HD';
}

function detectSubtitleLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (
    lower.includes('.ar.') ||
    lower.includes('arabic') ||
    lower.includes('عربي') ||
    lower.includes('العربية')
  ) {
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

function parseEpisodeInfo(
  rawName: string,
  fallbackIndex: number
): { title: string; episodeNumber: number } {
  const withoutExt = stripExtension(rawName);

  const sxeMatch = withoutExt.match(
    /(?:S\d{1,2}\s*[._-]?\s*)?(?:E|EP|Episode)\s*[._-]?\s*(\d{1,3})/i
  );
  const arMatch = withoutExt.match(/(?:الحلقة|حلقة|ح)\s*[._:-]?\s*(\d{1,3})/);
  const leadMatch = withoutExt.match(/^(\d{1,3})\s*[._:-]+\s*(.+)$/);

  let epNum = fallbackIndex;
  if (sxeMatch?.[1]) epNum = parseInt(sxeMatch[1], 10);
  else if (arMatch?.[1]) epNum = parseInt(arMatch[1], 10);
  else if (leadMatch?.[1]) epNum = parseInt(leadMatch[1], 10);

  const cleaned = withoutExt
    .replace(
      /\b(1080p|720p|2160p|4K|WEB-DL|WEBRip|BluRay|HDRip|x264|x265|HEVC|AAC|H\.?264|H\.?265|10bit|DDP5\.1)\b/gi,
      ''
    )
    .replace(/[._]+/g, ' ')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    title: cleaned || `الحلقة ${epNum}`,
    episodeNumber: Number.isFinite(epNum) && epNum > 0 ? epNum : fallbackIndex,
  };
}

function matchSubtitlesForVideo(
  videoName: string,
  subtitles: PublicSubtitle[]
): PublicSubtitle[] {
  const videoBase = stripExtension(videoName).toLowerCase();
  return subtitles.filter(
    (sub) =>
      sub.baseName.toLowerCase() === videoBase ||
      sub.baseName.toLowerCase().startsWith(videoBase + '.') ||
      videoBase.startsWith(sub.baseName.toLowerCase())
  );
}

function parseEmbeddedFolderHtml(html: string): {
  title: string;
  entries: ParsedEntry[];
  isAuthGate: boolean;
} {
  const lower = html.toLowerCase();
  if (
    lower.includes('accounts.google.com/servicelogin') ||
    lower.includes('sign in - google accounts') ||
    lower.includes('you need access')
  ) {
    return { title: '', entries: [], isAuthGate: true };
  }

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
  const cleanTitle = rawTitle.replace(/\s*-\s*Google Drive\s*$/i, '').trim();

  const entries: ParsedEntry[] = [];
  const entryRegex = /<div class="flip-entry" id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?(?=<div class="flip-entry" id="entry-|<\/div>\s*<\/div>\s*<script|<\/body>)/g;

  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(html)) !== null) {
    const id = match[1];
    const block = match[0];

    const nameMatch = block.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/i);
    const name = nameMatch ? decodeHtmlEntities(nameMatch[1].replace(/<[^>]+>/g, '')) : '';
    if (!name) continue;

    const isFolder =
      block.includes('/drive/folders/') ||
      block.includes('application/vnd.google-apps.folder') ||
      block.includes('alt="Folder"');

    const mimeMatch = block.match(/\/type\/([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)/);
    const mimeType = isFolder
      ? 'application/vnd.google-apps.folder'
      : mimeMatch?.[1] || 'application/octet-stream';

    const modMatch = block.match(
      /<div class="flip-entry-last-modified"><div>([\s\S]*?)<\/div><\/div>/i
    );
    const modifiedLabel = modMatch ? decodeHtmlEntities(modMatch[1]) : '';

    entries.push({
      id,
      name,
      isFolder,
      mimeType,
      modifiedLabel,
    });
  }

  return { title: cleanTitle, entries, isAuthGate: false };
}

async function fetchPublicFolderPage(folderId: string): Promise<{
  title: string;
  entries: ParsedEntry[];
  status: number;
  isAuthGate: boolean;
}> {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });

  if (res.url.includes('accounts.google.com')) {
    return { title: '', entries: [], status: 403, isAuthGate: true };
  }

  if (!res.ok) {
    return { title: '', entries: [], status: res.status, isAuthGate: false };
  }

  const html = await res.text();
  const parsed = parseEmbeddedFolderHtml(html);
  return { ...parsed, status: 200 };
}

function buildPublicEpisodes(
  entries: ParsedEntry[],
  seasonIndex: number,
  seasonName: string
): PublicEpisode[] {
  const videos = naturalSort(entries.filter(isVideoEntry));
  const subtitles: PublicSubtitle[] = entries.filter(isSubtitleEntry).map((f) => ({
    id: f.id,
    name: f.name,
    baseName: stripExtension(f.name),
    languageLabel: detectSubtitleLanguage(f.name),
  }));

  return videos.map((file, idx) => {
    const parsed = parseEpisodeInfo(file.name, idx + 1);
    return {
      id: file.id,
      rawName: file.name,
      title: parsed.title,
      episodeNumber: parsed.episodeNumber,
      seasonIndex,
      seasonName,
      description: '',
      mimeType: file.mimeType,
      sizeBytes: 0,
      durationMs: 0,
      qualityLabel: detectQualityFromName(file.name),
      modifiedTime: undefined,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w960`,
      webViewLink: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
      subtitles: matchSubtitlesForVideo(file.name, subtitles),
    };
  });
}

function convertSrtToVtt(srt: string): string {
  const normalized = srt.replace(/\r+/g, '').trim();
  const converted = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );
  return `WEBVTT\n\n${converted}\n`;
}

async function createApp() {
  const app = express();
  app.use(express.json());

  // 1. Fetch publicly shared Google Drive folder (no login needed!)
  app.get('/api/public-series/:folderId', async (req: Request, res: Response) => {
    const folderId = String(req.params.folderId || '').trim();
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(folderId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        error: 'معرّف المجلد غير صالح. يرجى لصق رابط مجلد Google Drive صحيح.',
      });
      return;
    }

    try {
      const root = await fetchPublicFolderPage(folderId);
      if (root.isAuthGate || root.status === 403 || root.status === 401) {
        res.status(403).json({
          code: 'PRIVATE_FOLDER',
          error:
            'هذا المجلد غير متاح للعامة في Google Drive. فعّل خيار «أي شخص لديه الرابط» كعارض في Google Drive، أو سجّل الدخول بحسابك لفتحه.',
        });
        return;
      }

      if (root.status === 404) {
        res.status(404).json({
          code: 'NOT_FOUND',
          error:
            'تعذّر العثور على المجلد. تأكد من صحة رابط Google Drive ومن تفعيل المشاركة العامة للمجلد.',
        });
        return;
      }

      const images = root.entries.filter(isImageEntry);
      const preferredCover =
        images.find((img) => /(cover|poster|backdrop|banner|hero|غلاف)/i.test(img.name)) ||
        images[0];

      const coverOptions = images.map((img) => ({
        id: img.id,
        name: img.name,
        url: `https://lh3.googleusercontent.com/d/${encodeURIComponent(img.id)}=w1600`,
      }));

      const rootVideos = root.entries.filter(isVideoEntry);
      const subFolders = naturalSort(root.entries.filter((e) => e.isFolder)).slice(0, 15);

      const seasons: PublicSeason[] = [];

      if (rootVideos.length > 0) {
        const name = subFolders.length > 0 ? 'الحلقات الرئيسية' : 'الموسم الأول';
        seasons.push({
          id: `${folderId}-root`,
          name,
          index: 1,
          episodes: buildPublicEpisodes(root.entries, 1, name),
        });
      }

      if (subFolders.length > 0) {
        const subResults = await Promise.all(
          subFolders.map(async (sub, idx) => {
            try {
              const subPage = await fetchPublicFolderPage(sub.id);
              if (subPage.status !== 200 || subPage.isAuthGate) return null;
              const episodes = buildPublicEpisodes(
                subPage.entries,
                seasons.length + idx + 1,
                sub.name
              );
              if (episodes.length === 0) return null;
              return {
                id: sub.id,
                name: sub.name,
                index: seasons.length + idx + 1,
                episodes,
              };
            } catch {
              return null;
            }
          })
        );

        for (const s of subResults) {
          if (s) seasons.push(s);
        }
      }

      const allEpisodes = seasons.flatMap((s) => s.episodes);
      let highestQuality = 'HD';
      if (allEpisodes.some((e) => e.qualityLabel.startsWith('4K'))) highestQuality = '4K UHD';
      else if (allEpisodes.some((e) => e.qualityLabel.startsWith('2K'))) highestQuality = '2K QHD';
      else if (allEpisodes.some((e) => e.qualityLabel.startsWith('1080p'))) highestQuality = '1080p HD';
      else if (allEpisodes.some((e) => e.qualityLabel.startsWith('720p'))) highestQuality = '720p HD';

      res.json({
        id: folderId,
        name: root.title || 'مسلسل مشترك',
        description: '',
        shared: true,
        isPublicLink: true,
        permissionsCount: 1,
        ownerName: '',
        webViewLink: `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`,
        coverImageId: preferredCover?.id,
        coverImageUrl: preferredCover
          ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(preferredCover.id)}=w1600`
          : undefined,
        coverOptions,
        seasons,
        totalEpisodes: allEpisodes.length,
        totalDurationMs: 0,
        highestQuality,
        isPublicSource: true,
      });
    } catch (err) {
      console.error('Public folder fetch error:', err);
      res.status(500).json({
        code: 'FETCH_ERROR',
        error: 'حدث خطأ أثناء قراءة المجلد من Google Drive. حاول مرة أخرى.',
      });
    }
  });

  // 2. Fetch and convert public SRT/VTT subtitle to WebVTT
  app.get('/api/public-subtitle/:fileId', async (req: Request, res: Response) => {
    const fileId = String(req.params.fileId || '').trim();
    const fileName = String(req.query.name || '');
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(fileId)) {
      res.status(400).send('Invalid file ID');
      return;
    }

    try {
      const upstream = await fetch(
        `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
        {
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'follow',
        }
      );

      if (!upstream.ok) {
        res.status(upstream.status).send('Failed to fetch subtitle');
        return;
      }

      let text = await upstream.text();
      if (fileName.toLowerCase().endsWith('.srt') || !text.trimStart().startsWith('WEBVTT')) {
        text = convertSrtToVtt(text);
      }

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(text);
    } catch {
      res.status(500).send('Subtitle error');
    }
  });

  // 3. Stream public Google Drive video with Range support (for custom HTML5 player + subtitles)
  app.get('/api/public-stream/:fileId', async (req: Request, res: Response) => {
    const fileId = String(req.params.fileId || '').trim();
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(fileId)) {
      res.status(400).send('Invalid file ID');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
      };
      if (req.headers.range) {
        headers.Range = String(req.headers.range);
      }

      const upstream = await fetch(
        `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
        { headers, redirect: 'follow' }
      );

      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || contentType.includes('text/html')) {
        res.status(415).json({
          error: 'UNSUPPORTED_DIRECT_STREAM',
        });
        return;
      }

      res.status(upstream.status);
      const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(value)) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
      res.end();
    } catch {
      if (!res.headersSent) {
        res.status(502).send('Stream proxy failed');
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CinemaDrive server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
