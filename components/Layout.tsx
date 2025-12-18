import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Layers, Image as ImageIcon, Video, Grid, LogOut, 
  User as UserIcon, Wand2, MonitorPlay, Settings, Cloud, Download, MonitorDown, Film, Users, BookOpen, Home, Bell, LogIn, Shield, Coins, MessageCircle, HelpCircle, AlertCircle, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, TrendingUp, Sparkles
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

// Logo Component hiển thị file logo.png của người dùng
const AppLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const dimensions = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
    return (
        <div className={`${dimensions} rounded-xl bg-zinc-800/50 p-1 shadow-lg flex items-center justify-center overflow-hidden shrink-0 border border-white/10`}>
            <img 
                src="logo.png" 
                alt="Brand Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                    // Fallback nếu không tìm thấy file logo.png
                    (e.target as HTMLImageElement).src = "https://img.icons8.com/fluency/48/layers.png";
                }}
            />
        </div>
    );
};

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
  const [isStandalone, setIsStandalone] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(checkStandalone);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allNavItems = [
    { id: ModuleType.HOME, label: 'Dashboard', icon: Home },
    { id: ModuleType.CHANNEL_BUILDER, label: 'Channel Architect', icon: TrendingUp },
    { id: ModuleType.NEW_CREATION, label: 'Vision Generator', icon: Wand2 },
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

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-zinc-950 text-gray-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      <CreditInfoModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} />

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 flex-col bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-800 shrink-0 shadow-2xl z-20">
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <AppLogo />
          <div>
              <h1 className="text-lg font-black text-white tracking-tight leading-none">UltraEdit 8K</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Gemini Pro Suite</p>
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
        <header className="lg:hidden h-16 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
             <AppLogo size="sm" />
            <span className="font-black text-lg text-white tracking-tight">UltraEdit 8K</span>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-300">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-950 relative scroll-smooth">
          <div className="w-full h-full">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;