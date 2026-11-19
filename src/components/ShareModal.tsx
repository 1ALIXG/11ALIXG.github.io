import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  X,
} from 'lucide-react';
import {
  buildCompactPayload,
  encodeSeriesToHashToken,
  PublishedSeriesFile,
} from '../lib/shareCodec';
import { Episode, SeriesCustomization, SeriesData } from '../types';

interface ShareModalProps {
  series: SeriesData;
  customization: SeriesCustomization;
  isViewerMode: boolean;
  initialEpisode?: Episode | null;
  onUpdateCustomization: (next: SeriesCustomization) => void;
  onEnterViewerPreview?: () => void;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  series,
  customization,
  isViewerMode,
  initialEpisode = null,
  onUpdateCustomization,
  onEnterViewerPreview,
  onClose,
}) => {
  const [shareScope, setShareScope] = useState<'series' | 'episode'>(
    initialEpisode ? 'episode' : 'series'
  );
  const [copied, setCopied] = useState(false);
  const [downloadedJson, setDownloadedJson] = useState(false);

  const [title, setTitle] = useState(customization.title || series.name);
  const [description, setDescription] = useState(
    customization.description || series.description || ''
  );
  const [genre, setGenre] = useState(customization.genre || '');
  const [year, setYear] = useState(customization.year || '');
  const [coverUrl, setCoverUrl] = useState(customization.coverUrl || '');
  const [customDomainBase, setCustomDomainBase] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const effectiveCustomization = useMemo<SeriesCustomization>(() => {
    return {
      title: title.trim() && title.trim() !== series.name ? title.trim() : undefined,
      description: description.trim() || undefined,
      genre: genre.trim() || undefined,
      year: year.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
    };
  }, [title, description, genre, year, coverUrl, series.name]);

  useEffect(() => {
    if (!isViewerMode) {
      onUpdateCustomization(effectiveCustomization);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCustomization]);

  // Generate self-contained compressed #watch= hash link (works 100% statically on GitHub Pages!)
  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      const payload = buildCompactPayload(
        series,
        isViewerMode ? customization : effectiveCustomization,
        shareScope === 'episode' && initialEpisode ? initialEpisode.id : null
      );
      const token = await encodeSeriesToHashToken(payload);

      let base = `${window.location.origin}${window.location.pathname}`;
      if (customDomainBase.trim()) {
        const cleaned = customDomainBase.trim().replace(/\/+$/, '');
        base = cleaned.startsWith('http://') || cleaned.startsWith('https://')
          ? `${cleaned}/`
          : `https://${cleaned}/`;
      }

      if (!cancelled) {
        setShareUrl(`${base}#watch=${token}`);
      }
    };

    generate();
    return () => {
      cancelled = true;
    };
  }, [
    series,
    isViewerMode,
    customization,
    effectiveCustomization,
    shareScope,
    initialEpisode,
    customDomainBase,
  ]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement('textarea');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadSeriesJson = () => {
    const payload = buildCompactPayload(
      series,
      isViewerMode ? customization : effectiveCustomization,
      null
    );
    const fileData: PublishedSeriesFile = {
      published: true,
      series: payload,
    };
    const blob = new Blob([JSON.stringify(fileData, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'series.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedJson(true);
    setTimeout(() => setDownloadedJson(false), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تخصيص ونشر رابط المسلسل"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-[#141418] border border-white/[0.1] shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-white truncate">
              {isViewerMode ? 'مشاركة رابط المشاهدة' : 'تخصيص ونشر على GitHub / دومينك'}
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              يعمل بدون خادم وبدون تسجيل دخول للشخص الذي يفتح الرابط
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المشاركة"
            className="p-2 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {!isViewerMode && (
            <div className="space-y-4 pb-5 border-b border-white/[0.08]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-[#D4D4D8] block">
                    اسم المسلسل الظاهر للزائر
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setCopied(false);
                    }}
                    placeholder={series.name}
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#E50914]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#D4D4D8] block">
                    التصنيف (اختياري)
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => {
                      setGenre(e.target.value);
                      setCopied(false);
                    }}
                    placeholder="دراما · غموض · تشويق"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#E50914]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#D4D4D8] block">
                    سنة الإنتاج (اختياري)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={year}
                    onChange={(e) => {
                      setYear(e.target.value);
                      setCopied(false);
                    }}
                    placeholder="2026"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-sm font-mono-num text-white placeholder:text-[#52525B] text-left focus:outline-none focus:border-[#E50914]"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-[#D4D4D8] block">
                    قصة المسلسل / النبذة (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setCopied(false);
                    }}
                    placeholder="نبذة قصيرة تظهر في الواجهة الرئيسية للمسلسل..."
                    className="w-full p-3 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#E50914] resize-none"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-[#D4D4D8] block">
                    رابط صورة الغلاف (اختياري)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={coverUrl}
                    onChange={(e) => {
                      setCoverUrl(e.target.value);
                      setCopied(false);
                    }}
                    placeholder="اتركه فارغاً لاستخدام صورة الغلاف من المجلد تلقائياً"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-xs text-white placeholder:text-[#52525B] text-left focus:outline-none focus:border-[#E50914]"
                  />
                  {series.coverOptions && series.coverOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {series.coverOptions.slice(0, 4).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCoverUrl(opt.url);
                            setCopied(false);
                          }}
                          className="text-xs px-2.5 py-1 rounded bg-[#1C1C24] hover:bg-[#272732] text-[#D4D4D8] hover:text-white transition-colors cursor-pointer truncate max-w-[180px]"
                        >
                          استخدام: {opt.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Switch between Series Link and Episode Link */}
          {initialEpisode && (
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0A0A0C] border border-white/[0.08] w-full">
              <button
                type="button"
                onClick={() => {
                  setShareScope('episode');
                  setCopied(false);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-display font-semibold transition-colors cursor-pointer ${
                  shareScope === 'episode'
                    ? 'bg-white text-[#0A0A0C]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                رابط الحلقة {initialEpisode.episodeNumber} مباشرة
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareScope('series');
                  setCopied(false);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-display font-semibold transition-colors cursor-pointer ${
                  shareScope === 'series'
                    ? 'bg-white text-[#0A0A0C]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                رابط المسلسل كاملاً
              </button>
            </div>
          )}

          {/* Optional Custom Domain Base */}
          {!isViewerMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#D4D4D8] block">
                دومينك على GitHub Pages (اختياري لتوليد الرابط على دومينك مباشرة)
              </label>
              <div className="relative">
                <Globe
                  className="w-4 h-4 text-[#71717A] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={customDomainBase}
                  onChange={(e) => {
                    setCustomDomainBase(e.target.value);
                    setCopied(false);
                  }}
                  placeholder="https://yourdomain.com أو username.github.io/repo"
                  className="w-full h-10 pr-10 pl-3 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-xs font-mono-num text-white placeholder:text-[#52525B] text-left focus:outline-none focus:border-[#E50914]"
                />
              </div>
            </div>
          )}

          {/* Share URL Copy Box */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#D4D4D8] block">
              رابط المشاهدة الذاتي (يفتح مباشرة بدون تسجيل دخول)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Link2
                  className="w-4 h-4 text-[#71717A] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="w-full h-11 pr-10 pl-3 rounded-lg bg-[#0A0A0C] border border-white/[0.1] text-xs font-mono-num text-[#E4E4E7] text-left focus:outline-none focus:border-[#E50914]"
                />
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="h-11 px-5 rounded-lg bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Publish permanently to Domain Root via public/series.json */}
          {!isViewerMode && (
            <div className="rounded-xl bg-[#0E0E12] border border-white/[0.08] p-4 space-y-3">
              <div className="space-y-1">
                <p className="font-display font-bold text-sm text-white">
                  تريد أن يفتح دومينك الرئيسي مباشرة على المسلسل بدون رابط طويل؟
                </p>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  حمّل ملف <span className="font-mono-num text-white">series.json</span> واستبدل به الملف الموجود داخل <span className="font-mono-num text-white">docs/series.json</span> في مستودع GitHub — بعدها أي شخص يزور دومينك سيدخل للمسلسل مباشرة!
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSeriesJson}
                className="w-full h-10 px-4 rounded-lg bg-white text-[#0A0A0C] hover:bg-[#E4E4E7] text-xs font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {downloadedJson ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>تم تحميل ملف series.json</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>تحميل series.json للنشر على GitHub Pages</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Preview as Viewer Button */}
          {!isViewerMode && onEnterViewerPreview && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEnterViewerPreview();
              }}
              className="w-full h-10 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-display font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>معاينة الصفحة كما ستظهر للزائر</span>
            </button>
          )}

          {/* Drive Public Access Reminder */}
          {!isViewerMode && series.id !== 'manual-series' && (
            <div className="rounded-xl bg-[#0E0E12] border border-white/[0.08] p-4 space-y-3">
              <div className="flex items-start gap-3">
                {series.isPublicLink ? (
                  <CheckCircle2
                    className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertCircle
                    className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <div className="space-y-1">
                  <p className="font-display font-bold text-sm text-white">
                    {series.isPublicLink
                      ? 'المجلد مضبوط للمشاهدة العامة في Google Drive'
                      : 'تأكد من تفعيل المشاركة في Google Drive'}
                  </p>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    {series.isPublicLink
                      ? 'ملفات الفيديو متاحة لأي شخص لديه الرابط، لذلك ستعمل الحلقات فوراً لدى أصدقائك.'
                      : 'لكي تعمل الحلقات عند الزوار بدون تسجيل دخول، افتح المجلد في Google Drive واجعل صلاحية المشاركة «أي شخص لديه الرابط — عارض».'}
                  </p>
                </div>
              </div>

              {!series.isPublicLink && (
                <a
                  href={series.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-9 px-4 rounded-lg bg-[#1C1C24] hover:bg-[#272732] text-white text-xs font-display font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>فتح إعدادات المشاركة في Google Drive</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
