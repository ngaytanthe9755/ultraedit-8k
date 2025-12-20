
import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Layers, Image as ImageIcon, Video, Grid, LogOut, 
  User as UserIcon, Wand2, MonitorPlay, Settings, Cloud, Download, MonitorDown, Film, Users, BookOpen, Home, Bell, LogIn, Shield, Coins, MessageCircle, HelpCircle, AlertCircle, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, TrendingUp, Edit2
} from 'lucide-react';
import { ModuleType, User, AppNotification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: ModuleType;
  onModuleChange: (m: ModuleType) => void;
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
  addToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
  notifications?: AppNotification[];
  onMarkAllRead?: () => void;
  onDeleteNotification?: (id: string) => void;
  onOpenLogin: () => void;
}

// ... CreditInfoModal component remains same ...
const CreditInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
                <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Coins size={20} className="text-yellow-500"/> Quy tắc Tín Dụng
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-yellow-900/20 border border-yellow-600/30 p-3 rounded-xl flex gap-3 items-start">
                        <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={18}/>
                        <p className="text-sm text-yellow-200 leading-relaxed">
                            Mỗi tác phẩm nghệ thuật được tạo ra sẽ tiêu tốn điểm tín dụng. Hệ thống sẽ tự động trừ điểm ngay khi quá trình tạo hoàn tất thành công.
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Bảng giá tham khảo:</h4>
                        <ul className="text-sm text-zinc-300 space-y-2">
                            <li className="flex justify-between border-b border-white/5 pb-1">
                                <span>Tạo ảnh mới / Poster / Thumbnail</span>
                                <span className="font-bold text-white">1 Điểm / 1 Ảnh</span>
                            </li>
                            <li className="flex justify-between border-b border-white/5 pb-1">
                                <span>Tạo nhân vật</span>
                                <span className="font-bold text-white">1 Điểm / 1 Nhân vật</span>
                            </li>
                            <li className="flex justify-between border-b border-white/5 pb-1">
                                <span>Ghép ảnh (Studio)</span>
                                <span className="font-bold text-white">1 Điểm / 1 Ảnh</span>
                            </li>
                            <li className="flex justify-between border-b border-white/5 pb-1">
                                <span>Tạo Video (Veo)</span>
                                <span className="font-bold text-white">1 Điểm / 1 Video</span>
                            </li>
                            <li className="flex justify-between border-b border-white/5 pb-1">
                                <span>Sản xuất Storyboard/Kịch bản</span>
                                <span className="font-bold text-white">1 Điểm / 1 Cảnh (Scene)</span>
                            </li>
                            <li className="flex justify-between border-b border-white/5 pb-1">
                                <span>Lập Chiến lược Kênh (Channel Architect)</span>
                                <span className="font-bold text-white">1 Điểm / 1 Plan</span>
                            </li>
                        </ul>
                    </div>

                    <div className="pt-4 mt-2 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 mb-3 text-center">Hết điểm? Liên hệ Admin để nạp thêm.</p>
                        <a 
                            href="https://t.me/JacyGM_Official" 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            <MessageCircle size={18}/> Liên hệ Admin nạp điểm
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

const Layout: React.FC<LayoutProps> = ({ 
  children, activeModule, onModuleChange, user, onLogout, onOpenSettings, addToast, notifications = [], onMarkAllRead, onDeleteNotification, onOpenLogin
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(checkStandalone);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      addToast?.("Cài đặt Ứng dụng", "Nhìn lên thanh địa chỉ trình duyệt, bấm vào biểu tượng 'Cài đặt' để đưa App ra màn hình chính.", "info");
    }
  };

  const handleContactSupport = () => {
    window.open('https://t.me/JacyGM_Official', '_blank');
  };

  // UPGRADED NAVIGATION LABELS
  const allNavItems = [
    { id: ModuleType.HOME, label: 'Dashboard', icon: Home },
    { id: ModuleType.CHANNEL_BUILDER, label: 'Channel Architect', icon: TrendingUp },
    { id: ModuleType.NEW_CREATION, label: 'Vision Generator', icon: Wand2 },
    { id: ModuleType.PHOTO_EDITOR, label: 'Photo Editor', icon: Edit2 }, // ADDED
    { id: ModuleType.CHARACTER_CREATOR, label: 'Character Lab', icon: Users },
    { id: ModuleType.STORY_CREATOR, label: 'Story Architect', icon: BookOpen },
    { id: ModuleType.VEO_IDEAS, label: 'Cinematic Scripts', icon: Video },
    { id: ModuleType.IMAGE_TO_VIDEO, label: 'Veo Motion', icon: Film },
    { id: ModuleType.STUDIO, label: 'Composition Studio', icon: Layers },
    { id: ModuleType.POSTER, label: 'Pro Posters', icon: ImageIcon },
    { id: ModuleType.THUMBNAIL, label: 'Viral Thumbnails', icon: MonitorPlay },
    { id: ModuleType.LIBRARY, label: 'Assets Library', icon: Grid },
  ];

  const navItems = allNavItems.filter(item => {
      if (item.id === ModuleType.HOME) return true;
      if (user.isAuthenticated && user.permissions && user.role !== 'admin') {
          return user.permissions[item.id] !== false;
      }
      return true; 
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // Group notifications by date
  const groupedNotifications = React.useMemo(() => {
      const groups: Record<string, AppNotification[]> = {
          'Hôm nay': [],
          'Hôm qua': [],
          'Cũ hơn': []
      };
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterday = today - 86400000;

      notifications.forEach(n => {
          if (n.timestamp >= today) {
              groups['Hôm nay'].push(n);
          } else if (n.timestamp >= yesterday) {
              groups['Hôm qua'].push(n);
          } else {
              groups['Cũ hơn'].push(n);
          }
      });
      return groups;
  }, [notifications]);

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-zinc-950 text-gray-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      <CreditInfoModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} />

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 flex-col bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-800 shrink-0 shadow-2xl z-20">
        {!isStandalone && (
            <div className="px-6 pt-6 pb-2">
                <button onClick={handleInstallClick} className="w-full bg-white text-zinc-900 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-all text-[10px] uppercase tracking-widest">
                    <MonitorDown size={14}/> Install App
                </button>
            </div>
        )}

        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-black text-white text-sm">UE</span>
          </div>
          <div>
              <h1 className="text-lg font-black text-white tracking-tight">UltraEdit 8K</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Gemini Pro Suite</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group relative overflow-hidden ${
                activeModule === item.id ? 'bg-zinc-800 text-white font-bold shadow-lg ring-1 ring-white/10' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              {activeModule === item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
              <item.icon className={`w-5 h-5 ${activeModule === item.id ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-white'}`} />
              <span className="tracking-wide text-sm">{item.label}</span>
            </button>
          ))}
          
          {user.role === 'admin' && (
              <div className="pt-4 mt-2 border-t border-zinc-800/50">
                  <button
                    onClick={() => onModuleChange(ModuleType.ADMIN_PANEL)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group border border-red-900/20 bg-red-950/10 ${
                        activeModule === ModuleType.ADMIN_PANEL ? 'text-red-400 ring-1 ring-red-500/30' : 'text-zinc-500 hover:text-red-400 hover:bg-red-900/20'
                    }`}
                  >
                      <Shield className="w-5 h-5"/> <span className="font-bold text-sm">Admin Console</span>
                  </button>
              </div>
          )}
        </nav>

        <div className="px-4 pb-2 mt-auto">
            <button 
                onClick={handleContactSupport}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 hover:from-blue-600/20 hover:to-cyan-600/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all group"
            >
                <MessageCircle size={16} />
                <span className="font-bold text-xs uppercase tracking-wider">Premium Support</span>
            </button>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          {user.isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 mb-2 hover:border-zinc-700 transition-colors cursor-pointer group" onClick={onOpenSettings}>
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-700 group-hover:border-indigo-500 transition-colors">
                        <UserIcon size={16} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{user.username}</p>
                        <div className="flex items-center gap-2 mt-0.5" onClick={(e) => { e.stopPropagation(); setIsCreditModalOpen(true); }}>
                            <span className="text-[10px] text-yellow-500 flex items-center gap-1 font-bold bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-500/20" title="Credits">
                                <Coins size={10}/> {user.credits !== undefined ? user.credits : 0}
                            </span>
                        </div>
                    </div>
                    <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400"><Settings size={16} /></button>
                </div>
                <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-widest">
                    <LogOut size={12} /> Sign Out
                </button>
              </>
          ) : (
              <button onClick={onOpenLogin} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
                  <LogIn size={16}/> Access Studio
              </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header - Mobile */}
        <header className="lg:hidden h-16 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg"><span className="font-black text-white text-xs">UE</span></div>
            <span className="font-black text-lg text-white tracking-tight">UltraEdit 8K</span>
          </div>
          <div className="flex items-center gap-3">
             {!user.isAuthenticated && (
                 <button onClick={onOpenLogin} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">Login</button>
             )}
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-300">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
             </button>
          </div>
        </header>

        {/* Improved Notification Bell */}
        {user.isAuthenticated && (
            <div className="absolute top-6 right-8 z-40 hidden lg:block" ref={notifRef}>
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 shadow-xl relative group transition-all hover:scale-105">
                    <Bell size={20} className={unreadCount > 0 ? 'text-white' : ''} />
                    {unreadCount > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-zinc-950 flex items-center justify-center text-[8px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                
                {isNotifOpen && (
                    <div className="absolute top-full right-0 mt-3 w-[400px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[600px] animate-in fade-in zoom-in-95 origin-top-right ring-1 ring-white/10">
                        {/* Notif Header */}
                        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center">
                            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                <Bell size={14} className="text-indigo-500"/> Thông báo
                            </h3>
                            <div className="flex items-center gap-3">
                                {notifications.length > 0 && (
                                    <button onClick={onMarkAllRead} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors" title="Đánh dấu tất cả đã đọc">
                                        <CheckCheck size={12}/> <span className="hidden sm:inline">Đã đọc</span>
                                    </button>
                                )}
                                <div className="h-4 w-px bg-zinc-800"></div>
                                <button onClick={() => setIsNotifOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                                    <X size={16}/>
                                </button>
                            </div>
                        </div>

                        {/* Notif Body */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 p-0 bg-zinc-950">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center gap-3 opacity-60">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                                        <Bell size={24} className="text-zinc-600"/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-400">Không có thông báo mới</p>
                                        <p className="text-xs text-zinc-600">Bạn đã cập nhật tất cả hoạt động.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="pb-4">
                                    {(['Hôm nay', 'Hôm qua', 'Cũ hơn'] as const).map(group => {
                                        const items = groupedNotifications[group];
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={group} className="animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="px-4 py-2 bg-zinc-900/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest sticky top-0 backdrop-blur-md z-10 border-y border-zinc-900/50">
                                                    {group}
                                                </div>
                                                <div>
                                                    {items.map(n => (
                                                        <div key={n.id} className={`group relative p-4 flex gap-3 transition-all border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/60 ${!n.read ? 'bg-indigo-900/5' : ''}`}>
                                                            {/* Status Icon */}
                                                            <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                                                                n.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                                                n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                                n.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                                                'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                                            }`}>
                                                                {n.type === 'success' && <CheckCircle size={14}/>}
                                                                {n.type === 'error' && <AlertCircle size={14}/>}
                                                                {n.type === 'warning' && <AlertTriangle size={14}/>}
                                                                {n.type === 'info' && <Info size={14}/>}
                                                            </div>

                                                            <div className="flex-1 min-w-0 pr-6">
                                                                <div className="flex justify-between items-start mb-0.5">
                                                                    <h4 className={`text-sm font-bold truncate ${n.read ? 'text-zinc-400' : 'text-white'}`}>{n.title}</h4>
                                                                    {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5 animate-pulse"></div>}
                                                                </div>
                                                                <p className={`text-xs leading-relaxed line-clamp-2 ${n.read ? 'text-zinc-600' : 'text-zinc-300'}`}>{n.message}</p>
                                                                <span className="text-[10px] text-zinc-600 font-mono mt-1.5 block">
                                                                    {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </span>
                                                            </div>

                                                            {/* Delete Action */}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onDeleteNotification?.(n.id); }}
                                                                className="absolute top-3 right-3 p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-all"
                                                                title="Xóa thông báo"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute inset-0 z-40 bg-zinc-950/95 p-4 flex flex-col backdrop-blur-xl animate-in fade-in slide-in-from-top-10">
             <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar py-4">
                 {navItems.map((item) => (
                    <button key={item.id} onClick={() => { onModuleChange(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-base font-bold ${activeModule === item.id ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>
                      <item.icon size={20} className={activeModule === item.id ? 'text-indigo-400' : ''}/> {item.label}
                    </button>
                  ))}
                  {user.role === 'admin' && (
                      <button onClick={() => { onModuleChange(ModuleType.ADMIN_PANEL); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-base font-bold text-red-400 hover:bg-red-900/10 border border-red-900/20 mt-4">
                          <Shield size={20} /> Admin Console
                      </button>
                  )}
             </div>
              <div className="pt-6 border-t border-zinc-800 space-y-3 shrink-0 pb-safe">
                 {user.isAuthenticated ? (
                     <>
                        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800" onClick={() => { setIsMobileMenuOpen(false); onOpenSettings(); }}>
                            <span className="text-sm text-white font-bold flex items-center gap-2"><UserIcon size={16}/> {user.username}</span>
                            <span className="text-sm text-yellow-500 font-bold flex items-center gap-1"><Coins size={14}/> {user.credits}</span>
                        </div>
                        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-zinc-400 py-4 px-4 rounded-xl hover:bg-red-900/10 hover:text-red-400 font-bold uppercase text-xs tracking-widest"><LogOut size={16} /> Sign Out</button>
                     </>
                 ) : (
                     <button onClick={() => { onOpenLogin(); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 text-white py-4 px-4 rounded-xl bg-indigo-600 font-bold shadow-lg"><LogIn size={18} /> Access Studio</button>
                 )}
              </div>
          </div>
        )}

        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-950 relative scroll-smooth">
          <div className="w-full h-full">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
