import React, { useState } from 'react';
import { Link2, Play, Trash2 } from 'lucide-react';
import { extractDriveFolderId } from '../lib/drive';
import { RecentSeriesEntry } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

const HERO_BACKDROP_SRC = '/src/assets/images/cinema_hero_backdrop_1795110238692.jpg';

interface WelcomeScreenProps {
  onOpenPublicLink: (folderId: string) => void;
  onSignIn: () => void;
  isSigningIn: boolean;
  errorMessage: string | null;
  recentSeries: RecentSeriesEntry[];
  onRemoveRecent: (folderId: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenPublicLink,
  onSignIn,
  isSigningIn,
  errorMessage,
  recentSeries,
  onRemoveRecent,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleSubmitLink = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    const folderId = extractDriveFolderId(linkInput);
    if (!folderId) {
      setInputError(
        'الرابط غير صالح. الصق رابط مجلد Google Drive المشترك مثل: https://drive.google.com/drive/folders/...'
      );
      return;
    }
    onOpenPublicLink(folderId);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#F4F4F6] flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0A0A0C]/85 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-extrabold tracking-tight text-[#E50914] whitespace-nowrap shrink-0"
          >
            سينما درايف
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#A1A1AA]">
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              كيف يعمل
            </a>
            <a
              href="#features"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              المزايا
            </a>
            <a
              href="#privacy"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              طريقة المشاركة
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="px-4 py-2 text-sm font-display font-semibold text-white bg-[#1C1C24] hover:bg-[#272732] border border-white/[0.12] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              تصفّح مجلداتي
            </button>
          </div>
        </div>
      </header>

      {/* Full-Bleed Cinema Hero with Instant Link Converter */}
      <section
        id="top"
        className="relative flex-1 flex items-center min-h-[78vh] overflow-hidden"
      >
        <div className="absolute inset-0">
          {!heroImgFailed ? (
            <img
              src={HERO_BACKDROP_SRC}
              alt="خلفية عرض سينمائية لمسلسل درامي"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover object-center opacity-55"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#191215] via-[#0A0A0C] to-[#0D1018]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/65 to-[#0A0A0C]/35" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0C]/95 via-[#0A0A0C]/70 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 py-16">
          <div className="max-w-2xl space-y-6">
            <p className="text-sm font-medium text-[#A1A1AA]">
              بديل سينمائي لواجهة Google Drive · بدون تسجيل دخول للزوار
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.15] tracking-tight text-white [text-wrap:balance]">
              حوّل رابط Google Drive إلى واجهة عرض مثل نتفلكس
            </h1>

            <p className="text-base sm:text-lg text-[#D4D4D8] leading-relaxed max-w-xl">
              الصق رابط مجلد الحلقات المشترك من Google Drive، وسيظهر لأصدقائك بواجهة مسلسلات احترافية مع غلاف ومواسم ومشغّل حلقات — بدلاً من شكل Google Drive التقليدي.
            </p>

            {/* Primary Instant Link Paste Form — Zero Login Required */}
            <form
              onSubmit={handleSubmitLink}
              className="pt-2 flex flex-col sm:flex-row gap-3 max-w-xl"
            >
              <div className="relative flex-1">
                <Link2
                  className="w-4 h-4 text-[#71717A] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full h-13 pr-11 pl-4 rounded-lg bg-[#141418]/95 border border-white/[0.16] text-sm text-white placeholder:text-[#71717A] focus:outline-none focus:border-[#E50914] transition-colors text-left"
                />
              </div>
              <button
                type="submit"
                className="h-13 px-7 rounded-lg bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm sm:text-base transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                تحويل إلى واجهة نتفلكس
              </button>
            </form>

            {(inputError || errorMessage) && (
              <div
                role="alert"
                className="p-4 rounded-lg bg-[#E50914]/15 border border-[#E50914]/40 text-sm text-[#FCA5A5] max-w-xl"
              >
                {inputError || errorMessage}
              </div>
            )}

            {/* Secondary Option: Sign in with Google for private folders */}
            <div className="pt-3 flex flex-wrap items-center gap-4 border-t border-white/[0.08] max-w-xl">
              <span className="text-xs text-[#A1A1AA]">
                أو تصفّح مجلداتك الخاصة مباشرة:
              </span>
              <GoogleSignInButton
                onClick={onSignIn}
                loading={isSigningIn}
                size="md"
                label="تسجيل الدخول بحساب Google"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A1A1AA]">
              <span>الزائر يشاهد فوراً بدون تسجيل دخول</span>
              <span aria-hidden="true">·</span>
              <span>تخصيص الاسم والقصة والغلاف</span>
              <span aria-hidden="true">·</span>
              <span>يدعم المواسم والترجمة العربية</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recently Opened Series (if any) */}
      {recentSeries.length > 0 && (
        <section className="border-t border-white/[0.08] py-12 bg-[#0D0D11]">
          <div className="max-w-7xl mx-auto px-6 space-y-5">
            <h2 className="font-display text-xl font-bold text-white">
              روابط فتحتها مؤخراً
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentSeries.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-[#141418] border border-white/[0.08] hover:border-white/[0.2] transition-colors p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <h3 className="font-display font-bold text-base text-white truncate">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                      <span className="font-mono-num">
                        {item.seasonsCount > 1
                          ? `${item.seasonsCount} مواسم`
                          : 'موسم واحد'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{item.totalEpisodes} حلقة</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => onOpenPublicLink(item.id)}
                      className="inline-flex items-center gap-1.5 text-sm font-display font-bold text-white hover:text-[#E50914] transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span>فتح المسلسل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRecent(item.id)}
                      aria-label={`إزالة ${item.name} من السجل`}
                      className="p-1.5 text-[#71717A] hover:text-[#FCA5A5] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works — 3-step editorial row */}
      <section id="how-it-works" className="border-t border-white/[0.08] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 max-w-xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              كيف تشارك مسلسلك بواجهة نتفلكس بدلاً من Google Drive؟
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3 border-t border-white/[0.1] pt-6">
              <span className="font-mono-num text-sm font-semibold text-[#E50914]">01</span>
              <h3 className="font-display text-lg font-bold text-white">
                انسخ رابط المجلد من Google Drive
              </h3>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                في Google Drive اضغط «مشاركة» على مجلد المسلسل واختر «أي شخص لديه الرابط» بصلاحية عارض، ثم انسخ الرابط.
              </p>
            </div>

            <div className="space-y-3 border-t border-white/[0.1] pt-6">
              <span className="font-mono-num text-sm font-semibold text-[#E50914]">02</span>
              <h3 className="font-display text-lg font-bold text-white">
                الصقه هنا وخصّص الواجهة
              </h3>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                يتحوّل المجلد فوراً إلى صفحة عرض سينمائية بالمواسم والحلقات، ويمكنك تعديل الاسم والقصة والتصنيف والغلاف حسب ذوقك.
              </p>
            </div>

            <div className="space-y-3 border-t border-white/[0.1] pt-6">
              <span className="font-mono-num text-sm font-semibold text-[#E50914]">03</span>
              <h3 className="font-display text-lg font-bold text-white">
                أرسل الرابط الجديد لصديقك
              </h3>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                بدلاً من إرسال رابط Google Drive، أرسل رابط المشاهدة الجديد من هنا ليفتح عنده فوراً بواجهة نتفلكس دون تسجيل دخول.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Sharing */}
      <section id="features" className="border-t border-white/[0.08] py-16 bg-[#111115]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              تنظيم تلقائي للمواسم والغلاف والترجمة
            </h2>
            <p className="text-sm text-[#A1A1AA] leading-relaxed">
              ضع كل موسم في مجلد فرعي داخل مجلد المسلسل، وأضف صورة غلاف (مثل <span className="font-mono-num text-[#E4E4E7]">cover.jpg</span>) ليظهر بوستر المسلسل تلقائياً. كما تُكتشف ملفات الترجمة <span className="font-mono-num text-[#E4E4E7]">.SRT</span> و<span className="font-mono-num text-[#E4E4E7]">.VTT</span> تلقائياً.
            </p>
          </div>

          <div id="privacy" className="space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              تبقى ملفاتك آمنة في Google Drive
            </h2>
            <p className="text-sm text-[#A1A1AA] leading-relaxed">
              لا يتم رفع أو نسخ ملفات الفيديو إلى أي موقع آخر — التطبيق يعرض ملفات مجلدك المشترك فقط بشكل منسّق، ويمكنك إيقاف المشاركة في أي لحظة من Google Drive.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <span>سينما درايف — واجهة عرض سينمائية لمجلدات المسلسلات</span>
          <span>يعمل مباشرة مع روابط Google Drive المشتركة</span>
        </div>
      </footer>
    </div>
  );
};
