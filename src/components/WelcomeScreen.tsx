import React, { useState } from 'react';
import { FileVideo, FolderOpen, Play } from 'lucide-react';
import heroBackdropImg from '../assets/images/cinema_hero_backdrop_1795110238692.jpg';
import { buildManualSeries } from '../lib/shareCodec';
import { SeriesCustomization, SeriesData } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface WelcomeScreenProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  errorMessage: string | null;
  onCreateManualSeries: (
    series: SeriesData,
    customization: SeriesCustomization
  ) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSignIn,
  isSigningIn,
  errorMessage,
  onCreateManualSeries,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [builderTab, setBuilderTab] = useState<'manual' | 'drive'>('manual');

  // Manual zero-login episode links builder state
  const [manualTitle, setManualTitle] = useState('');
  const [manualGenre, setManualGenre] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCover, setManualCover] = useState('');
  const [manualLinks, setManualLinks] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const built = buildManualSeries({
      title: manualTitle || 'مسلسلي',
      description: manualDesc,
      genre: manualGenre,
      year: manualYear,
      coverInput: manualCover,
      linksText: manualLinks,
    });

    if (!built) {
      setManualError(
        'الصق رابط حلقة واحدة على الأقل من Google Drive (مثال: https://drive.google.com/file/d/.../view).'
      );
      return;
    }

    onCreateManualSeries(built.series, built.customization);
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
              href="#builder"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              إنشاء صفحة مسلسل
            </a>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              كيف يعمل
            </a>
            <a
              href="#github-publish"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              النشر على GitHub
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="px-4 py-2 text-sm font-display font-semibold text-white bg-[#1C1C24] hover:bg-[#272732] border border-white/[0.12] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              استيراد من Drive
            </button>
          </div>
        </div>
      </header>

      {/* Full-Bleed Cinema Hero */}
      <section
        id="top"
        className="relative flex-1 flex items-center py-14 lg:py-20 overflow-hidden"
      >
        <div className="absolute inset-0">
          {!heroImgFailed ? (
            <img
              src={heroBackdropImg}
              alt="خلفية عرض سينمائية لمسلسل درامي"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover object-center opacity-50"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#191215] via-[#0A0A0C] to-[#0D1018]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/70 to-[#0A0A0C]/40" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0C]/95 via-[#0A0A0C]/75 to-[#0A0A0C]/35" />
        </div>

        <div
          id="builder"
          className="relative z-10 max-w-7xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Left/Right RTL Headline Column */}
          <div className="lg:col-span-6 space-y-6">
            <p className="text-sm font-medium text-[#A1A1AA]">
              يعمل 100% على GitHub Pages · بدون خادم وبدون تسجيل دخول للزوار
            </p>

            <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-[1.15] tracking-tight text-white [text-wrap:balance]">
              حوّل حلقاتك في Google Drive إلى موقع عرض مثل نتفلكس
            </h1>

            <p className="text-base text-[#D4D4D8] leading-relaxed max-w-xl">
              أنشئ صفحة مسلسلك خلال ثوانٍ، وشارك رابط المشاهدة أو انشر ملف الإعداد على دومينك في GitHub Pages — ليشاهد أصدقاؤك الحلقات بواجهة سينمائية كاملة بدلاً من واجهة Google Drive.
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A1A1AA]">
              <span>رابط مشاركة ذاتي بدون سيرفر</span>
              <span aria-hidden="true">·</span>
              <span>يدعم النشر المباشر على الدومين</span>
              <span aria-hidden="true">·</span>
              <span>المشاهد لا يحتاج تسجيل دخول</span>
            </div>
          </div>

          {/* Interactive Builder Card */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-[#141418]/95 border border-white/[0.1] backdrop-blur-md p-6 space-y-5">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0A0A0C] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setBuilderTab('manual')}
                  className={`py-2.5 px-3 rounded-md text-xs sm:text-sm font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    builderTab === 'manual'
                      ? 'bg-white text-[#0A0A0C]'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  <FileVideo className="w-4 h-4" aria-hidden="true" />
                  <span>لصق روابط الحلقات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderTab('drive')}
                  className={`py-2.5 px-3 rounded-md text-xs sm:text-sm font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    builderTab === 'drive'
                      ? 'bg-white text-[#0A0A0C]'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  <FolderOpen className="w-4 h-4" aria-hidden="true" />
                  <span>استيراد مجلد Drive</span>
                </button>
              </div>

              {builderTab === 'manual' ? (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    بدون تسجيل دخول: الصق روابط ملفات الحلقات من Google Drive (رابط في كل سطر)، وتأكد أن كل ملف مضبوط على «أي شخص لديه الرابط».
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-[#D4D4D8] block">
                        اسم المسلسل
                      </label>
                      <input
                        type="text"
                        required
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="مثال: اسم المسلسل"
                        className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.12] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#D4D4D8] block">
                        السنة (اختياري)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={manualYear}
                        onChange={(e) => setManualYear(e.target.value)}
                        placeholder="2026"
                        className="w-full h-10 px-3 rounded-lg bg-[#0A0A0C] border border-white/[0.12] text-sm font-mono-num text-white placeholder:text-[#52525B] text-left focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#D4D4D8] block">
                        التصنيف (اختياري)
                      </label>
                      <input
                        type="text"
                        value={manualGenre}
                        onChange={(e) => setManualGenre(e.target.value)}
                        placeholder="دراما · تشويق"
                        className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.12] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#D4D4D8] block">
                        رابط صورة الغلاف (اختياري)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={manualCover}
                        onChange={(e) => setManualCover(e.target.value)}
                        placeholder="رابط صورة أو ملف صورة في Drive"
                        className="w-full h-10 px-3 rounded-lg bg-[#0A0A0C] border border-white/[0.12] text-xs text-white placeholder:text-[#52525B] text-left focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#D4D4D8] block">
                      قصة المسلسل (اختياري)
                    </label>
                    <input
                      type="text"
                      value={manualDesc}
                      onChange={(e) => setManualDesc(e.target.value)}
                      placeholder="نبذة قصيرة تظهر أسفل اسم المسلسل..."
                      className="w-full h-10 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/[0.12] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#E50914]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#D4D4D8] block">
                      روابط الحلقات من Google Drive (حلقة في كل سطر)
                    </label>
                    <textarea
                      rows={4}
                      dir="ltr"
                      required
                      value={manualLinks}
                      onChange={(e) => {
                        setManualLinks(e.target.value);
                        if (manualError) setManualError(null);
                      }}
                      placeholder={
                        'الحلقة 1 | https://drive.google.com/file/d/FILE_ID_1/view\nالحلقة 2 | https://drive.google.com/file/d/FILE_ID_2/view'
                      }
                      className="w-full p-3 rounded-lg bg-[#0A0A0C] border border-white/[0.12] text-xs font-mono-num text-white placeholder:text-[#52525B] text-left focus:outline-none focus:border-[#E50914] resize-y"
                    />
                  </div>

                  {manualError && (
                    <p
                      role="alert"
                      className="text-xs text-[#FCA5A5] bg-[#E50914]/15 border border-[#E50914]/40 rounded-lg p-3"
                    >
                      {manualError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full h-11 rounded-lg bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>إنشاء واجهة المسلسل الآن</span>
                  </button>
                </form>
              ) : (
                <div className="py-4 space-y-5">
                  <div className="space-y-2">
                    <h2 className="font-display font-bold text-lg text-white">
                      استيراد مجلد كامل بضغطة واحدة
                    </h2>
                    <p className="text-sm text-[#A1A1AA] leading-relaxed">
                      سجّل الدخول بحسابك في Google مرة واحدة فقط ليقرأ التطبيق جميع المواسم والحلقات والصور المصغّرة والمدد تلقائياً من مجلدك، ثم ينشئ لك رابط مشاهدة عاماً أو ملف <span className="font-mono-num text-white">series.json</span> يعمل بدون تسجيل دخول للزوار.
                    </p>
                  </div>

                  {errorMessage && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-lg bg-[#E50914]/15 border border-[#E50914]/40 text-xs text-[#FCA5A5]"
                    >
                      {errorMessage}
                    </div>
                  )}

                  <GoogleSignInButton
                    onClick={onSignIn}
                    loading={isSigningIn}
                    label="تسجيل الدخول بحساب Google لاستيراد المجلد"
                  />

                  <p className="text-xs text-[#71717A] leading-relaxed">
                    ملاحظة: إذا كنت تستخدم دوميناً جديداً ولم تضفه بعد في Firebase Authorized Domains، يمكنك استخدام تبويب «لصق روابط الحلقات» بالأعلى مباشرة بدون تسجيل دخول.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-white/[0.08] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-10">
            طريقتان لمشاركة المسلسل على دومينك في GitHub Pages
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3 border-t border-white/[0.1] pt-6">
              <span className="font-mono-num text-sm font-semibold text-[#E50914]">01</span>
              <h3 className="font-display text-lg font-bold text-white">
                رابط مشاركة فوري (<span className="font-mono-num">#watch=...</span>)
              </h3>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                بعد تجهيز المسلسل اضغط «تخصيص ومشاركة الرابط». ينتج التطبيق رابطاً مشفّراً يحتوي على قائمة الحلقات والغلاف يعمل على أي دومين GitHub Pages بدون سيرفر وبدون تسجيل دخول للشخص الذي يستلم الرابط.
              </p>
            </div>

            <div id="github-publish" className="space-y-3 border-t border-white/[0.1] pt-6">
              <span className="font-mono-num text-sm font-semibold text-[#E50914]">02</span>
              <h3 className="font-display text-lg font-bold text-white">
                نشر دائم على الدومين الرئيسي (<span className="font-mono-num">public/series.json</span>)
              </h3>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                اضغط «تحميل ملف series.json» من نافذة المشاركة وضعه داخل مجلد <span className="font-mono-num text-[#E4E4E7]">public/</span> في مستودع GitHub. بمجرد الرفع سيعمل GitHub Actions تلقائياً ويفتح دومينك الرئيسي مباشرة على واجهة المسلسل!
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <span>سينما درايف — واجهة عرض سينمائية متوافقة مع GitHub Pages</span>
          <span>يعمل بالكامل من المتصفح بدون خادم خارجي</span>
        </div>
      </footer>
    </div>
  );
};
