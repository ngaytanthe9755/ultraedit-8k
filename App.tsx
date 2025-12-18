import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import { ToastContainer } from './components/Toast';
import { ModuleType, User, ToastMessage, AppNotification, RegisteredUser } from './types';
import NewCreation from './modules/NewCreation';
import Studio from './modules/Studio';
import VeoIdeas from './modules/VeoIdeas';
import ImageToVideo from './modules/ImageToVideo';
import Library from './modules/Library';
import Poster from './modules/Poster';
import Thumbnail from './modules/Thumbnail';
import CharacterCreator from './modules/CharacterCreator';
import StoryCreator from './modules/StoryCreator';
import ChannelBuilder from './modules/ChannelBuilder';
import Home from './modules/Home';
import AdminPanel from './modules/AdminPanel';
import SettingsModal from './components/SettingsModal';
import { Key, X, Loader2, Cloud, Link, MessageCircle, Send, CheckCircle2, Lock, ExternalLink, Copy, HelpCircle, ShieldAlert, Eye, EyeOff, AlertCircle, FileText, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { loginUser, registerUser, getAllUsers, getUserNotifications, markNotificationsRead, isSessionValid, syncUsersFromCloud, findUserByContact, resetPassword, finalizeUserLogin, getSystemConfig } from './services/userService';
import { generateOTP, sendOTP, getBotInfo } from './services/telegramService';

// --- AUTH MODAL COMPONENT ---
interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: RegisteredUser) => void;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess, addToast }) => {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showLoginPass, setShowLoginPass] = useState(false);
    
    useEffect(() => {
        if(!isOpen) setMode('login');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await loginUser(username, password);
            if (res.success && res.user) {
                onLoginSuccess(res.user);
                addToast("Thành công", "Chào mừng bạn trở lại!", "success");
                onClose();
            } else {
                addToast("Lỗi", res.message, "error");
            }
        } catch (err) {
            addToast("Lỗi", "Lỗi kết nối server.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10" disabled={isLoading}><X size={20}/></button>
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="text-center mb-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 p-1 shadow-2xl mb-4 border border-white/10 overflow-hidden">
                            <img 
                                src="logo.png" 
                                alt="Brand Logo" 
                                className="w-full h-full object-contain"
                                onError={(e) => (e.target as HTMLImageElement).src = "https://img.icons8.com/fluency/48/layers.png"}
                            />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">UltraEdit 8K</h2>
                        <p className="text-sm text-zinc-400">Đăng nhập vào Studio của bạn</p>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <input 
                            type="text" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" 
                            placeholder="Tên đăng nhập" 
                            disabled={isLoading} 
                        />
                        <div className="relative">
                            <input 
                                type={showLoginPass ? "text" : "password"} 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pr-10 text-white focus:border-indigo-500 outline-none" 
                                placeholder="Mật khẩu" 
                                disabled={isLoading} 
                            />
                            <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-3 top-3 text-zinc-500 hover:text-white">
                                {showLoginPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Đăng Nhập"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>(ModuleType.HOME);
  const [user, setUser] = useState<User>({ 
      username: 'Guest', 
      email: '',
      role: 'user', 
      isAuthenticated: false,
      isVerified: false,
      modelTier: '1.5-free',
      permissions: {},
      credits: 0,
      createdAt: 0
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isGlobalProcessing, setGlobalProcessing] = useState(false);

  const handleLoginSuccess = (registeredUser: RegisteredUser) => {
      const appUser: User = {
          ...registeredUser,
          isAuthenticated: true
      };
      setUser(appUser);
      localStorage.setItem('ue_current_user', JSON.stringify(appUser));
  };

  const handleLogout = () => {
      setUser({ 
          username: 'Guest', 
          email: '',
          role: 'user', 
          isAuthenticated: false,
          isVerified: false,
          modelTier: '1.5-free',
          permissions: {},
          credits: 0,
          createdAt: 0
      });
      localStorage.removeItem('ue_current_user');
      setActiveModule(ModuleType.HOME);
  };

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  return (
    <Layout 
        activeModule={activeModule} 
        onModuleChange={setActiveModule} 
        user={user} 
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        addToast={addToast}
        notifications={notifications}
        onOpenLogin={() => setIsAuthModalOpen(true)}
    >
      {activeModule === ModuleType.HOME && <Home onNavigate={setActiveModule} currentUser={user} />}
      {activeModule === ModuleType.ADMIN_PANEL && <AdminPanel currentUser={user} addToast={addToast}/>}
      
      <div style={{ display: activeModule === ModuleType.LIBRARY ? 'block' : 'none', height: '100%' }}>
          <Library onNavigate={(m) => setActiveModule(m)} addToast={addToast} isActive={activeModule === ModuleType.LIBRARY} />
      </div>

      <div style={{ display: activeModule === ModuleType.STUDIO ? 'block' : 'none', height: '100%' }}>
          <Studio addToast={addToast} currentUser={user} onRequireAuth={() => setIsAuthModalOpen(true)} isAuthenticated={user.isAuthenticated} isGlobalProcessing={isGlobalProcessing} setGlobalProcessing={setGlobalProcessing} />
      </div>

      {/* Các module khác tương tự... */}
      <div style={{ display: activeModule === ModuleType.NEW_CREATION ? 'block' : 'none', height: '100%' }}>
          <NewCreation addToast={addToast} currentUser={user} onRequireAuth={() => setIsAuthModalOpen(true)} isAuthenticated={user.isAuthenticated} isGlobalProcessing={isGlobalProcessing} setGlobalProcessing={setGlobalProcessing} />
      </div>

      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onLoginSuccess={handleLoginSuccess} addToast={addToast} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} addToast={addToast} user={user} />
    </Layout>
  );
};

export default App;