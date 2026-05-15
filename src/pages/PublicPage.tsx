import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase-setup';
import { File, Video, Image as ImageIcon, AlignLeft, Link as LinkIcon, Home, Moon, Lock, Bell, Mailbox, Send, X, Megaphone, Search, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UploadedFile {
  id: string;
  name: string;
  fileType: string;
  category?: string;
  driveLink: string;
  createdAt: number;
}

export default function PublicPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');

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
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()
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

  const categories = useMemo(() => {
    const cats = new Set<string>();
    files.forEach(f => {
      if (f.category) cats.add(f.category.toUpperCase());
    });
    return ['All Categories', ...Array.from(cats)].sort();
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (f.category && f.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategory === 'All Categories' || (f.category && f.category.toUpperCase() === selectedCategory);
      return matchesSearch && matchesCat;
    });
  }, [files, searchQuery, selectedCategory]);

  const getDay = (ts: number) => {
    const d = new Date(ts);
    return d.getDate().toString().padStart(2, '0');
  };
  const getMonthYear = (ts: number) => {
    const d = new Date(ts);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const year = d.getFullYear().toString().slice(-2);
    return `${months[d.getMonth()]} '${year}`;
  }
  const getTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getFileIconInfo = (fileType: string) => {
    const t = fileType.toLowerCase();
    if (t.includes('video')) {
      return { icon: <Video className="w-4 h-4 mr-2" />, label: 'Watch Video', bg: 'bg-[#e2edff]', text: 'text-[#3b82f6]' };
    }
    if (t.includes('pdf')) {
      return { icon: <File className="w-4 h-4 mr-2" />, label: 'View PDF', bg: 'bg-[#ffe4e6]', text: 'text-[#e11d48]' };
    }
    if (t.includes('image')) {
      return { icon: <ImageIcon className="w-4 h-4 mr-2" />, label: 'View Image', bg: 'bg-[#ffe4e6]', text: 'text-[#e11d48]' };
    }
    // Default message
    return { icon: <AlignLeft className="w-4 h-4 mr-2" />, label: 'Read Message', bg: 'bg-[#f4e8ff]', text: 'text-[#9333ea]' };
  };

  return (
    <div className="min-h-screen bg-[#f7f5ed] font-sans text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-[#4d161a] border-b border-[#3b1114] text-white">
        {/* We use a subtle CSS pattern for the background texture */}
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
              <p className="text-sm text-white/80 font-medium">Dhenkanal Postal Division - Updates & Circulars Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-center w-full md:w-auto justify-end">
            <Link 
              to="/ask-ai" 
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 transition-colors px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
            >
              <span className="text-base">✨</span>
              <span>Ask AI</span>
            </Link>
            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-medium">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
            <button className="flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors p-2 rounded-lg w-9 h-9">
              <Moon className="w-4 h-4" />
            </button>
            <Link 
              to="/admin" 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Lock className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Subscription Banner */}
      {showBanner && (
        <div className="bg-[#cc2128] text-white px-4 py-3 flex items-center justify-center gap-4 flex-wrap relative shadow-sm z-10">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Bell className="w-4 h-4" />
            <span className="text-lg">📬</span>
            <span>Get daily postal updates at 6 AM</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs ml-1 uppercase font-bold tracking-wide">Free</span>
          </div>
          
          <div className="flex items-center gap-2 w-full max-w-sm ml-0 md:ml-4">
            <input 
              type="email" 
              placeholder="your@email.com" 
              className="bg-black/20 text-white placeholder:text-white/60 border border-white/20 rounded-full px-4 py-1.5 text-sm w-full outline-none focus:bg-black/30 transition-colors"
            />
            <button className="bg-white text-[#cc2128] hover:bg-gray-100 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap shrink-0">
              <Send className="w-3.5 h-3.5" />
              Notify Me
            </button>
          </div>

          <button 
            onClick={() => setShowBanner(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="w-full max-w-5xl mx-auto px-4 md:px-6 pt-12 pb-20 flex-1">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-3 flex items-center justify-center gap-3">
            <span className="text-2xl">📢</span> Latest Updates & Circulars
          </h2>
          <p className="text-gray-500 font-medium text-[15px]">
            Stay informed with the latest notices, orders, and announcements
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
          <div className="relative w-full md:w-64 shrink-0">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4d161a] focus:border-transparent cursor-pointer font-medium"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4d161a] focus:border-transparent font-medium"
              placeholder="Search updates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#6b2c31] animate-spin"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-100 rounded-[14px]">
            <h3 className="text-lg font-medium text-gray-900 mb-1">No updates found</h3>
            <p className="text-gray-500">
              There are currently no circulars matching your search criteria.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredFiles.map(file => {
              const info = getFileIconInfo(file.fileType);
              return (
                <div 
                  key={file.id} 
                  className="bg-white border border-gray-100 rounded-[12px] overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow transition-shadow ml-1"
                >
                  <div className="bg-[#612127] text-white flex md:flex-col items-center justify-center p-4 md:px-7 md:py-6 min-w-[130px]">
                    <div className="flex items-baseline gap-1 md:gap-0">
                        <span className="text-[34px] md:text-[42px] font-bold leading-none tracking-tight">
                        {getDay(file.createdAt)}
                        </span>
                        <div className="flex flex-col md:ml-1.5 mt-1 md:mt-2 items-start justify-center">
                            <span className="text-xs md:text-[13px] font-semibold leading-tight whitespace-nowrap">
                            {getMonthYear(file.createdAt)}
                            </span>
                             <span className="text-[11px] font-medium text-white/70 hidden md:block mt-1">
                                {getTime(file.createdAt)}
                            </span>
                        </div>
                    </div>
                    <span className="text-xs font-normal text-white/80 ml-auto md:hidden">
                        {getTime(file.createdAt)}
                    </span>
                  </div>

                  <div className="flex-1 p-5 md:py-6 md:px-7 flex flex-col justify-center">
                    <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase mb-2">
                      {file.category || 'GENERAL'}
                    </span>
                    <h3 className="text-[16px] md:text-[18px] font-semibold text-gray-800 leading-snug">
                      {file.name}
                    </h3>
                  </div>

                  <div className="p-5 md:py-6 md:px-7 flex items-center md:items-start lg:items-center justify-end gap-3 flex-wrap md:flex-nowrap bg-white md:border-none border-t border-gray-50 shrink-0">
                    <a
                      href={file.driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-[8px] px-5 py-2.5 text-[13px] font-bold transition-colors ${info.bg} ${info.text}`}
                    >
                      {info.icon}
                      {info.label}
                    </a>
                    
                    <button 
                      className="flex items-center justify-center rounded-[8px] bg-[#dcfce7] text-[#16a34a] p-2.5 hover:bg-green-200 transition-colors"
                      onClick={() => {
                         window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(file.name + ' - ' + file.driveLink)}`, '_blank');
                      }}
                    >
                      {/* WhatsApp Icon SVG */}
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                      </svg>
                    </button>
                    
                    <button 
                      onClick={() => {
                        window.navigator.clipboard.writeText(file.driveLink);
                        alert('Link copied to clipboard!');
                      }}
                      className="flex items-center justify-center rounded-[8px] bg-[#e2f0fe] text-[#0284c7] p-2.5 hover:bg-blue-100 transition-colors"
                    >
                      <LinkIcon className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
