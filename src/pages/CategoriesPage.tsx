import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSearchParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase-setup';
import { 
  FolderTree, 
  File, 
  Video, 
  Image as ImageIcon, 
  AlignLeft, 
  Link as LinkIcon, 
  Home, 
  Lock, 
  Search, 
  ArrowLeft, 
  Calendar, 
  Layers, 
  FileText, 
  Check, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { CIRCULAR_CATEGORIES } from '../constants/categories';

interface UploadedFile {
  id: string;
  name: string;
  fileType: string;
  category?: string;
  driveLink: string;
  createdAt: number;
}

interface CategoryMeta {
  name: string;
  count: number;
  latestTimestamp: number;
  recentFiles: UploadedFile[];
}

export default function CategoriesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategoryParam = searchParams.get('cat') || '';

  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'uploaded_files'),
      where('isPublic', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fileData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
        };
      }) as UploadedFile[];
      
      fileData.sort((a, b) => b.createdAt - a.createdAt);
      setFiles(fileData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'uploaded_files');
    });

    return () => unsubscribe();
  }, []);

  // Compute category metadata
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryMeta>();
    
    // Seed with all 15 official categories
    CIRCULAR_CATEGORIES.forEach(cat => {
      map.set(cat.toUpperCase(), {
        name: cat,
        count: 0,
        latestTimestamp: 0,
        recentFiles: []
      });
    });

    files.forEach(f => {
      const rawCat = (f.category && f.category.trim()) ? f.category.trim() : 'Others';
      const key = rawCat.toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (f.createdAt > existing.latestTimestamp) {
          existing.latestTimestamp = f.createdAt;
        }
        if (existing.recentFiles.length < 3) {
          existing.recentFiles.push(f);
        }
      } else {
        map.set(key, {
          name: rawCat,
          count: 1,
          latestTimestamp: f.createdAt,
          recentFiles: [f]
        });
      }
    });

    return map;
  }, [files]);

  const categoriesList = useMemo(() => {
    const list = Array.from(categoryMap.values());
    // Show categories with files first (sorted by count desc), then by name
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return list;
  }, [categoryMap]);

  // Filtered categories for card search
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoriesList;
    const q = categorySearchQuery.toLowerCase();
    return categoriesList.filter(cat => 
      cat.name.toLowerCase().includes(q) ||
      cat.recentFiles.some(f => f.name.toLowerCase().includes(q))
    );
  }, [categoriesList, categorySearchQuery]);

  // Selected Category Files
  const activeCategory = selectedCategoryParam.trim();
  const selectedCategoryFiles = useMemo(() => {
    if (!activeCategory) return [];
    const activeUpper = activeCategory.toUpperCase();
    return files.filter(f => {
      const cat = (f.category && f.category.trim()) ? f.category.trim().toUpperCase() : 'OTHERS';
      if (cat !== activeUpper) return false;
      if (!fileSearchQuery.trim()) return true;
      return f.name.toLowerCase().includes(fileSearchQuery.toLowerCase());
    });
  }, [files, activeCategory, fileSearchQuery]);

  const selectCategory = (categoryName: string) => {
    setSearchParams({ cat: categoryName });
    setFileSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSelectedCategory = () => {
    setSearchParams({});
    setFileSearchQuery('');
  };

  const copyToClipboard = (fileId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(fileId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getDay = (ts: number) => {
    const d = new Date(ts);
    return d.getDate().toString().padStart(2, '0');
  };
  
  const getMonthYear = (ts: number) => {
    const d = new Date(ts);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const year = d.getFullYear().toString().slice(-2);
    return `${months[d.getMonth()]} '${year}`;
  };

  const getTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateShort = (ts: number) => {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getFileIconInfo = (fileType: string) => {
    const t = (fileType || '').toLowerCase();
    if (t.includes('video')) {
      return { icon: <Video className="w-4 h-4 mr-2" />, label: 'Watch Video', bg: 'bg-[#e2edff]', text: 'text-[#3b82f6]' };
    }
    if (t.includes('pdf')) {
      return { icon: <File className="w-4 h-4 mr-2" />, label: 'View PDF', bg: 'bg-[#ffe4e6]', text: 'text-[#e11d48]' };
    }
    if (t.includes('image')) {
      return { icon: <ImageIcon className="w-4 h-4 mr-2" />, label: 'View Image', bg: 'bg-[#ffe4e6]', text: 'text-[#e11d48]' };
    }
    return { icon: <AlignLeft className="w-4 h-4 mr-2" />, label: 'Read Document', bg: 'bg-[#f4e8ff]', text: 'text-[#9333ea]' };
  };

  // Color schemes for category cards to make them visually distinguishable and professional
  const getCategoryPalette = (index: number) => {
    const palettes = [
      { bg: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800', iconBg: 'bg-amber-600 text-white' },
      { bg: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800', iconBg: 'bg-blue-600 text-white' },
      { bg: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-800', iconBg: 'bg-emerald-600 text-white' },
      { bg: 'from-rose-500/10 to-red-500/5', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-800', iconBg: 'bg-rose-600 text-white' },
      { bg: 'from-purple-500/10 to-violet-500/5', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-800', iconBg: 'bg-purple-600 text-white' },
      { bg: 'from-cyan-500/10 to-sky-500/5', border: 'border-cyan-200', text: 'text-cyan-800', badge: 'bg-cyan-100 text-cyan-800', iconBg: 'bg-cyan-600 text-white' },
    ];
    return palettes[index % palettes.length];
  };

  return (
    <div className="min-h-screen bg-[#f7f5ed] font-sans text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-[#4d161a] border-b border-[#3b1114] text-white">
        <div 
          className="px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{
            backgroundImage: `radial-gradient(#ffffff15 1px, transparent 1px)`,
            backgroundSize: `20px 20px`
          }}
        >
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-1 shrink-0 shadow-sm">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/3/32/India_Post.svg" 
                alt="India Post" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-0.5">Department of Posts</h1>
              <p className="text-sm text-white/80 font-medium">Dhenkanal RS SO - Updates & Circulars Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 self-end md:self-center w-full md:w-auto justify-end flex-wrap">
            <Link 
              to="/" 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-3.5 py-2 rounded-lg text-sm font-medium"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>

            <Link 
              to="/categories" 
              className="flex items-center gap-2 bg-white/25 border border-white/30 text-white transition-colors px-3.5 py-2 rounded-lg text-sm font-semibold shadow-inner"
            >
              <FolderTree className="w-4 h-4 text-amber-300" />
              <span>Categories</span>
            </Link>

            <Link 
              to="/admin" 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-3.5 py-2 rounded-lg text-sm font-medium"
            >
              <Lock className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        
        {/* Breadcrumb & Title Bar */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/" className="hover:text-[#4d161a] transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> Portal Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            {activeCategory ? (
              <>
                <button 
                  onClick={clearSelectedCategory} 
                  className="hover:text-[#4d161a] transition-colors"
                >
                  Categories
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-semibold text-[#4d161a]">{activeCategory}</span>
              </>
            ) : (
              <span className="font-semibold text-gray-800">Categories</span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#4d161a] flex items-center gap-2.5">
                <FolderTree className="w-7 h-7 text-[#cc2128]" />
                {activeCategory ? `Category: ${activeCategory}` : 'Circular Categories Directory'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {activeCategory 
                  ? `Showing all circulars, orders, and files filed under "${activeCategory}"`
                  : 'Click on any category card below to inspect all circulars and files belonging to that section.'}
              </p>
            </div>

            {/* Quick stats badge */}
            <div className="flex items-center gap-3">
              <div className="bg-white border border-gray-200 px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 shadow-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#cc2128]" />
                <span><strong className="text-gray-900">{categoriesList.length}</strong> Categories</span>
              </div>
              <div className="bg-white border border-gray-200 px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 shadow-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span><strong className="text-gray-900">{files.length}</strong> Total Files</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4d161a]"></div>
            <p className="mt-4 text-sm text-gray-500 font-medium">Loading categories and circulars...</p>
          </div>
        )}

        {/* VIEW 1: CATEGORY CARDS GRID (When no category is selected) */}
        {!loading && !activeCategory && (
          <div>
            {/* Search Input for categories */}
            <div className="mb-6 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search categories or circular titles..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2128] focus:border-transparent shadow-sm"
                />
              </div>
              {categorySearchQuery && (
                <button 
                  onClick={() => setCategorySearchQuery('')}
                  className="text-xs text-gray-500 hover:text-gray-800 bg-gray-200 px-3 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>

            {filteredCategories.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
                <FolderTree className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-800 mb-1">No Categories Found</h3>
                <p className="text-sm text-gray-500">
                  {categorySearchQuery ? `No category matching "${categorySearchQuery}" was found.` : 'No categories or uploaded files yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCategories.map((cat, idx) => {
                  const palette = getCategoryPalette(idx);
                  return (
                    <div 
                      key={cat.name}
                      onClick={() => selectCategory(cat.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectCategory(cat.name); }}
                      className={`group cursor-pointer bg-white rounded-2xl border ${palette.border} p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between relative overflow-hidden`}
                    >
                      {/* Top decorative accent */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${palette.bg}`} />

                      <div>
                        {/* Header: Icon, Name, and Badge */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl ${palette.iconBg} flex items-center justify-center shadow-sm shrink-0 font-bold text-base`}>
                              <FolderTree className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#4d161a] transition-colors">
                                {cat.name}
                              </h3>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                {cat.count > 0 ? `Updated ${formatDateShort(cat.latestTimestamp)}` : 'No circulars yet'}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${palette.badge} shrink-0`}>
                            {cat.count} {cat.count === 1 ? 'file' : 'files'}
                          </span>
                        </div>

                        {/* Recent Files Preview */}
                        <div className="mt-4 mb-4 bg-[#fbfaf6] rounded-xl p-3 border border-gray-100 min-h-[72px] flex flex-col justify-center">
                          {cat.count > 0 ? (
                            <>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                                Recent Circulars
                              </p>
                              <ul className="space-y-1.5 text-xs text-gray-700">
                                {cat.recentFiles.map(rf => (
                                  <li key={rf.id} className="truncate flex items-center gap-1.5 hover:text-[#4d161a]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                                    <span className="truncate">{rf.name}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400 italic text-center py-2">
                              No circulars uploaded yet in this section
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Call-To-Action */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-[#4d161a] group-hover:text-[#cc2128] transition-colors">
                        <span>{cat.count > 0 ? `View ${cat.count} ${cat.count === 1 ? 'circular' : 'circulars'}` : 'Open category section'}</span>
                        <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Browse Files <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: CATEGORY FILES LIST (When a category is active) */}
        {!loading && activeCategory && (
          <div>
            {/* Top Bar for Selected Category */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={clearSelectedCategory}
                  className="flex items-center gap-2 bg-[#f7f5ed] hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Categories</span>
                </button>
                <div className="h-6 w-[1px] bg-gray-200 hidden sm:block"></div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>{activeCategory}</span>
                    <span className="text-xs bg-[#ffe4e6] text-[#cc2128] font-bold px-2 py-0.5 rounded-full">
                      {selectedCategoryFiles.length} {selectedCategoryFiles.length === 1 ? 'circular' : 'circulars'}
                    </span>
                  </h3>
                </div>
              </div>

              {/* In-category search */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder={`Search in ${activeCategory}...`}
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2128] focus:bg-white"
                />
              </div>
            </div>

            {/* Quick-switch Category Pill Bar */}
            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                onClick={clearSelectedCategory}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                All Categories ({categoriesList.length})
              </button>
              {categoriesList.map(cat => {
                const isCurrent = cat.name === activeCategory;
                return (
                  <button
                    key={cat.name}
                    onClick={() => selectCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isCurrent 
                        ? 'bg-[#4d161a] text-white shadow-sm' 
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isCurrent ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Files List in this category */}
            {selectedCategoryFiles.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="text-lg font-bold text-gray-800 mb-1">No Files Found</h4>
                <p className="text-sm text-gray-500 mb-4">
                  {fileSearchQuery 
                    ? `No circulars matching "${fileSearchQuery}" in ${activeCategory}.` 
                    : `No circulars are currently uploaded under ${activeCategory}.`}
                </p>
                {fileSearchQuery && (
                  <button 
                    onClick={() => setFileSearchQuery('')}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedCategoryFiles.map((file) => {
                  const iconInfo = getFileIconInfo(file.fileType);
                  return (
                    <div 
                      key={file.id} 
                      className="bg-white rounded-[16px] p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                    >
                      {/* Left Side: Date Box & Info */}
                      <div className="flex items-start gap-4">
                        {/* Date badge */}
                        <div className="bg-[#4d161a] text-white rounded-[12px] p-2 flex flex-col items-center justify-center w-[72px] h-[72px] shrink-0 shadow-sm">
                          <span className="text-2xl font-black leading-none">{getDay(file.createdAt)}</span>
                          <span className="text-[11px] font-medium opacity-90 mt-1 leading-none">{getMonthYear(file.createdAt)}</span>
                          <span className="text-[9px] opacity-75 mt-1 leading-none">{getTime(file.createdAt)}</span>
                        </div>

                        {/* Title & metadata */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="inline-block bg-[#ffe4e6] text-[#cc2128] font-bold text-[11px] px-2.5 py-0.5 rounded-md">
                              {file.category || 'GENERAL'}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-gray-900 text-base leading-snug hover:text-[#4d161a] transition-colors">
                            {file.name}
                          </h4>
                          
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Uploaded: {new Date(file.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Action Buttons */}
                      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0">
                        {/* Main File Action (Google Drive link) */}
                        <a 
                          href={file.driveLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center font-bold text-xs px-4 py-2.5 rounded-[8px] transition-colors shadow-sm ${iconInfo.bg} ${iconInfo.text} hover:opacity-90`}
                        >
                          {iconInfo.icon}
                          <span>{iconInfo.label}</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-70" />
                        </a>

                        {/* WhatsApp Share */}
                        <button 
                          title="Share on WhatsApp"
                          className="flex items-center justify-center rounded-[8px] bg-[#dcfce7] text-[#16a34a] p-2.5 hover:bg-green-200 transition-colors"
                          onClick={() => {
                            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(file.name + ' - ' + file.driveLink)}`, '_blank');
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                          </svg>
                        </button>
                        
                        {/* Copy Link */}
                        <button 
                          title="Copy Link to Clipboard"
                          onClick={() => copyToClipboard(file.id, file.driveLink)}
                          className="flex items-center justify-center rounded-[8px] bg-[#e2f0fe] text-[#0284c7] p-2.5 hover:bg-blue-100 transition-colors"
                        >
                          {copiedId === file.id ? (
                            <Check className="w-[18px] h-[18px] text-green-600" />
                          ) : (
                            <LinkIcon className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#4d161a] text-white/80 py-6 text-center text-sm mt-auto border-t border-[#3b1114]">
        <p>Prepared by Kalandi Charan Sahoo, PA, Dhenkanal RS SO.</p>
      </footer>
    </div>
  );
}
