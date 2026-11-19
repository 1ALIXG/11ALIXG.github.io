import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Folder,
  FolderOpen,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import {
  extractDriveFolderId,
  formatArabicDate,
  listDriveFolders,
} from '../lib/drive';
import { DriveFolderItem, RecentSeriesEntry } from '../types';

interface DriveLibraryProps {
  accessToken: string;
  initialMode?: 'my-drive' | 'shared';
  recentSeries: RecentSeriesEntry[];
  onOpenSeries: (folderId: string) => void;
  onRemoveRecent: (folderId: string) => void;
  onAuthExpired: () => void;
}

interface BreadcrumbNode {
  id: string;
  name: string;
}

export const DriveLibrary: React.FC<DriveLibraryProps> = ({
  accessToken,
  initialMode = 'my-drive',
  recentSeries,
  onOpenSeries,
  onRemoveRecent,
  onAuthExpired,
}) => {
  const [mode, setMode] = useState<'my-drive' | 'shared' | 'search'>(initialMode);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbNode[]>([
    { id: 'root', name: 'ملفاتي' },
  ]);
  const [folders, setFolders] = useState<DriveFolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pasteInput, setPasteInput] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const currentParentId = breadcrumbs[breadcrumbs.length - 1]?.id || 'root';

  const fetchFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listDriveFolders(accessToken, {
        mode,
        parentId: mode === 'my-drive' ? currentParentId : undefined,
        searchQuery: mode === 'search' ? submittedSearch : undefined,
      });
      setFolders(items);
    } catch (err: any) {
      if (err?.name === 'DriveAuthExpiredError') {
        onAuthExpired();
        return;
      }
      setError(err?.message || 'تعذّر تحميل المجلدات من Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'search' && !submittedSearch.trim()) {
      setFolders([]);
      setLoading(false);
      return;
    }
    fetchFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, mode, currentParentId, submittedSearch]);

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError(null);
    const extracted = extractDriveFolderId(pasteInput);
    if (!extracted) {
      setPasteError(
        'الرابط غير صالح. الصق رابط مجلد من Google Drive مثل drive.google.com/drive/folders/...'
      );
      return;
    }
    onOpenSeries(extracted);
  };

  const handleEnterFolder = (folder: DriveFolderItem) => {
    setMode('my-drive');
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setMode('my-drive');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setMode('search');
    setSubmittedSearch(searchQuery.trim());
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
      {/* Header & Direct Link Input */}
      <section className="space-y-6">
        <div className="space-y-2 max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            اختر مجلد المسلسل من Google Drive
          </h1>
          <p className="text-sm sm:text-base text-[#A1A1AA]">
            الصق رابط أي مجلد يحتوي على حلقاتك، أو تصفّح مجلداتك والمجلدات المشتركة معك لفتحه بواجهة العرض السينمائية.
          </p>
        </div>

        <form
          onSubmit={handlePasteSubmit}
          className="flex flex-col sm:flex-row gap-3 max-w-3xl"
        >
          <div className="relative flex-1">
            <Link2
              className="w-4 h-4 text-[#71717A] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              dir="ltr"
              value={pasteInput}
              onChange={(e) => {
                setPasteInput(e.target.value);
                if (pasteError) setPasteError(null);
              }}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full h-12 pr-11 pl-4 rounded-lg bg-[#141418] border border-white/[0.1] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#E50914] transition-colors text-left"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-6 rounded-lg bg-[#E50914] hover:bg-[#F41924] text-white font-display font-bold text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            فتح المسلسل
          </button>
        </form>

        {pasteError && (
          <p role="alert" className="text-sm text-[#FCA5A5]">
            {pasteError}
          </p>
        )}
      </section>

      {/* Recently Opened Series */}
      {recentSeries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              مسلسلات فتحتها مؤخراً
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentSeries.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl bg-[#141418] border border-white/[0.08] hover:border-white/[0.2] transition-colors p-5 flex flex-col justify-between gap-4"
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
                    onClick={() => onOpenSeries(item.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-display font-bold text-white hover:text-[#E50914] transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>فتح العرض</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRecent(item.id)}
                    title="إزالة من السجل"
                    aria-label={`إزالة ${item.name} من السجل`}
                    className="p-1.5 text-[#71717A] hover:text-[#FCA5A5] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Drive Browser Section */}
      <section className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          {/* Interactive Segmented Control */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#141418] border border-white/[0.08] self-start">
            <button
              type="button"
              onClick={() => {
                setMode('my-drive');
                setBreadcrumbs([{ id: 'root', name: 'ملفاتي' }]);
              }}
              className={`px-4 py-2 text-sm font-display font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'my-drive'
                  ? 'bg-white text-[#0A0A0C]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              مجلداتي
            </button>
            <button
              type="button"
              onClick={() => setMode('shared')}
              className={`px-4 py-2 text-sm font-display font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'shared'
                  ? 'bg-white text-[#0A0A0C]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              المشتركة معي
            </button>
          </div>

          {/* Search Drive folders */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-80">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#71717A] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن اسم مجلد..."
                className="w-full h-10 pr-10 pl-3 rounded-lg bg-[#141418] border border-white/[0.1] text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-white/30"
              />
            </div>
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-[#1C1C22] hover:bg-[#27272F] text-sm font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              بحث
            </button>
            <button
              type="button"
              onClick={fetchFolders}
              title="تحديث القائمة"
              aria-label="تحديث القائمة"
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-[#1C1C22] hover:bg-[#27272F] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </form>
        </div>

        {/* Breadcrumbs for My Drive */}
        {mode === 'my-drive' && (
          <nav aria-label="مسار المجلد" className="flex items-center flex-wrap gap-1.5 text-sm">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && (
                    <ChevronLeft className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(idx)}
                    className={`transition-colors cursor-pointer ${
                      isLast
                        ? 'text-white font-semibold'
                        : 'text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
            {breadcrumbs.length > 1 && (
              <button
                type="button"
                onClick={() => onOpenSeries(currentParentId)}
                className="mr-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white text-xs font-display font-bold transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>فتح هذا المجلد كمسلسل</span>
              </button>
            )}
          </nav>
        )}

        {/* Loading / Error / Empty / Folder Grid */}
        {error ? (
          <div className="p-6 rounded-xl bg-[#E50914]/10 border border-[#E50914]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm text-[#FCA5A5]">{error}</p>
            <button
              type="button"
              onClick={fetchFolders}
              className="px-4 py-2 rounded-md bg-white text-[#0A0A0C] text-xs font-display font-bold whitespace-nowrap cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#A1A1AA]">
            <Loader2 className="w-7 h-7 animate-spin text-[#E50914]" />
            <span className="text-sm">جاري جلب المجلدات من Google Drive...</span>
          </div>
        ) : folders.length === 0 ? (
          <div className="py-16 text-center space-y-3 border border-white/[0.06] rounded-xl bg-[#111115]">
            <FolderOpen className="w-10 h-10 text-[#52525B] mx-auto" />
            <p className="font-display font-semibold text-white">
              لا توجد مجلدات فرعية هنا
            </p>
            <p className="text-sm text-[#A1A1AA] max-w-md mx-auto">
              {mode === 'my-drive' && breadcrumbs.length > 1
                ? 'إذا كان هذا المجلد يحتوي مباشرة على حلقات الفيديو، اضغط «فتح هذا المجلد كمسلسل» بالأعلى.'
                : 'جرّب لصق رابط مجلد المسلسل مباشرة في الخانة بالأعلى أو التبديل إلى «المشتركة معي».'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group rounded-xl bg-[#141418] border border-white/[0.08] hover:border-white/[0.2] transition-colors p-5 flex flex-col justify-between gap-5"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#1E1E26] flex items-center justify-center text-[#E4E4E7] shrink-0">
                    <Folder className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-display font-bold text-base text-white truncate">
                      {folder.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#A1A1AA]">
                      {folder.modifiedTime && (
                        <span>{formatArabicDate(folder.modifiedTime)}</span>
                      )}
                      {folder.shared && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" aria-hidden="true" />
                            <span>مشترك</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => onOpenSeries(folder.id)}
                    className="flex-1 h-9 px-3 rounded-md bg-[#E50914] hover:bg-[#F41924] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    <span>فتح كمسلسل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnterFolder(folder)}
                    className="h-9 px-3 rounded-md bg-[#1C1C22] hover:bg-[#27272F] text-[#D4D4D8] hover:text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    استعراض
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
