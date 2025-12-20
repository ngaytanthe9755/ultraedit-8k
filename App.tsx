
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
import PhotoEditor from './modules/PhotoEditor'; // Added import
import Home from './modules/Home';
import AdminPanel from './modules/AdminPanel';
import SettingsModal from './components/SettingsModal';
import { Key, X, Loader2, Cloud, Link, MessageCircle, Send, CheckCircle2, Lock, ExternalLink, Copy, HelpCircle, ShieldAlert, Eye, EyeOff, AlertCircle, FileText, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { loginUser, registerUser, getAllUsers, getUserNotifications, markNotificationsRead, isSessionValid, syncUsersFromCloud, findUserByContact, resetPassword, finalizeUserLogin, getSystemConfig } from './services/userService';
import { generateOTP, sendOTP, getBotInfo } from './services/telegramService';

// ... (PolicyModal, TelegramConnect, AuthModal remain unchanged) ...
// To save space, I will focus on the return statement of App component where routing happens.
// Assuming the top part of the file is identical to what was provided in context.

// --- POLICY MODAL COMPONENT ---
const PolicyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
                <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield size={20} className="text-indigo-500"/> Điều Khoản & Chính Sách Bảo Mật
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-sm text-zinc-300 leading-relaxed">
                    
                    <section>
                        <h4 className="text-white font-bold text-base mb-2 flex items-center gap-2">
                            <FileText size={16} className="text-blue-400"/> 1. Chính sách sử dụng Generative AI (Google Gemini & Imagen)
                        </h4>
                        <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
                            <p>Khi sử dụng các tính năng tạo nội dung (Văn bản, Hình ảnh, Video) trên UltraEdit 8K, bạn cam kết tuân thủ nghiêm ngặt Chính sách sử dụng bị cấm của Google (Google Generative AI Prohibited Use Policy).</p>
                            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                                <li><strong className="text-red-400">Cấm tuyệt đối:</strong> Nội dung khiêu dâm (CSAM, NSFW), bạo lực đẫm máu, kích động thù địch, phân biệt chủng tộc/tôn giáo.</li>
                                <li><strong className="text-red-400">Cấm:</strong> Tạo tin giả (Deepfakes), mạo danh người nổi tiếng nhằm mục đích lừa đảo hoặc bôi nhọ.</li>
                                <li><strong className="text-red-400">Cấm:</strong> Sử dụng AI để tư vấn y tế, pháp lý hoặc tài chính chuyên sâu mà không có sự kiểm chứng của chuyên gia.</li>
                            </ul>
                            <p className="text-xs text-zinc-500 italic mt-2">Hệ thống có cơ chế kiểm duyệt tự động (Safety Filters). Các tài khoản cố tình vi phạm nhiều lần sẽ bị khóa vĩnh viễn mà không cần báo trước.</p>
                        </div>
                    </section>

                    <section>
                        <h4 className="text-white font-bold text-base mb-2 flex items-center gap-2">
                            <Lock size={16} className="text-emerald-400"/> 2. Bảo mật Hệ thống & Dữ liệu Người dùng
                        </h4>
                        <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                            <p>Chúng tôi cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn theo tiêu chuẩn cao nhất.</p>
                            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                                <li><strong>Mật khẩu:</strong> Được mã hóa hoặc lưu trữ an toàn. Chúng tôi không thể xem mật khẩu gốc của bạn.</li>
                                <li><strong>Dữ liệu sáng tạo:</strong> Các hình ảnh, kịch bản bạn tạo ra được lưu trữ cục bộ (Local Storage/IndexedDB) và đồng bộ hóa qua Cloud mã hóa. Chỉ bạn mới có quyền truy cập.</li>
                                <li><strong>Telegram OTP:</strong> Chúng tôi sử dụng Telegram làm phương thức xác thực hai lớp (2FA) để đảm bảo không ai có thể đăng nhập trái phép vào tài khoản của bạn.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h4 className="text-white font-bold text-base mb-2">3. Trách nhiệm người dùng</h4>
                        <p>Bạn chịu trách nhiệm hoàn toàn về nội dung bạn tạo ra và chia sẻ. UltraEdit 8K chỉ cung cấp công cụ và không chịu trách nhiệm pháp lý về việc sử dụng sai mục đích của người dùng.</p>
                    </section>

                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 shrink-0 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all">
                        Đã Hiểu & Đồng Ý
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- TELEGRAM CONNECT COMPONENT ---
const TelegramConnect: React.FC<{
    telegramChatId: string; 
    setTelegramChatId: (id: string) => void;
    otpStep: 'idle' | 'verifying' | 'verified';
    onSendOtp: () => void;
    onVerifyOtp: (otp: string) => void;
    isLoading: boolean;
    botUsername?: string;
    maintenanceActive?: boolean;
}> = ({ telegramChatId, setTelegramChatId, otpStep, onSendOtp, onVerifyOtp, isLoading, botUsername, maintenanceActive }) => {
    const [inputOtp, setInputOtp] = useState('');

    return (
        <div className="bg-zinc-950/50 p-4 rounded-xl border border-blue-900/30 space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1">
                    <MessageCircle size={12}/> Xác Thực Quá Trình Đăng Ký Bằng OTP Telegram
                </label>
                <div className="text-[9px] text-zinc-500 italic">Nhập Chat ID để nhận OTP</div>
            </div>

            <div className="flex gap-2 items-center">
                {botUsername && (
                    <a 
                        href={`https://t.me/${botUsername}?start=getid`} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`px-3 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-bold whitespace-nowrap ${maintenanceActive ? 'pointer-events-none opacity-50' : ''}`}
                        title="Mở Telegram để lấy ID"
                    >
                        <Send size={14}/> <span className="hidden sm:inline">Lấy ID</span>
                    </a>
                )}
                
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={telegramChatId} 
                        onChange={e => setTelegramChatId(e.target.value)} 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 pl-3 pr-8 text-white text-xs outline-none focus:border-blue-500 transition-all" 
                        placeholder="Dán ID Chat đã sao chép vào đây..." 
                        disabled={otpStep === 'verified' || isLoading || maintenanceActive}
                    />
                    {telegramChatId && (
                        <CheckCircle2 size={14} className="absolute right-3 top-2.5 text-green-500 animate-in zoom-in"/>
                    )}
                </div>
            </div>

            {telegramChatId && otpStep === 'idle' && (
                <div className="space-y-2 animate-in fade-in">
                    <button 
                        type="button" 
                        onClick={onSendOtp} 
                        disabled={isLoading || maintenanceActive} 
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-white/5 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin"/> : <Lock size={14}/>} Gửi mã OTP xác thực
                    </button>
                </div>
            )}

            {otpStep === 'verifying' && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                    <input 
                        type="text" 
                        value={inputOtp} 
                        onChange={e => setInputOtp(e.target.value)} 
                        className="flex-1 bg-zinc-900 border border-blue-500 rounded-lg p-2 text-white text-xs text-center tracking-widest font-mono focus:ring-2 focus:ring-blue-500/20 outline-none" 
                        placeholder="Nhập 6 số OTP"
                        maxLength={6}
                        disabled={maintenanceActive}
                    />
                    <button type="button" onClick={() => onVerifyOtp(inputOtp)} disabled={maintenanceActive} className="px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50">Xác nhận</button>
                </div>
            )}

            {otpStep === 'verified' && (
                <div className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-500/10 p-2.5 rounded-lg border border-green-500/20 justify-center">
                    <CheckCircle2 size={16}/> Đã liên kết thành công
                </div>
            )}
        </div>
    );
};

// --- AUTH MODAL COMPONENT ---
interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: RegisteredUser) => void;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess, addToast }) => {
    // ... [AuthModal implementation unchanged] ...
    // Using previous implementation for AuthModal to save tokens
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [isAgreed, setIsAgreed] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showLoginPass, setShowLoginPass] = useState(false);
    const [showRegPass, setShowRegPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [activeField, setActiveField] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [isPolicyOpen, setIsPolicyOpen] = useState(false);
    const [otpStep, setOtpStep] = useState<'idle' | 'verifying' | 'verified'>('idle');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [botInfo, setBotInfo] = useState<{username: string} | null>(null);
    const [loginStep, setLoginStep] = useState<'credentials' | 'otp'>('credentials');
    const [loginOtpInput, setLoginOtpInput] = useState('');
    const [tempLoginUser, setTempLoginUser] = useState<RegisteredUser | null>(null);
    const [maintenanceInfo, setMaintenanceInfo] = useState<{ active: boolean; remaining: number } | null>(null);

    useEffect(() => {
        if(!isOpen) {
            setMode('login');
            resetForm();
        } else {
            checkMaintenance();
            getBotInfo().then(info => { if (info) setBotInfo(info); });
        }
    }, [isOpen]);

    useEffect(() => {
        let interval: any;
        if (isOpen) { interval = setInterval(checkMaintenance, 60000); }
        return () => clearInterval(interval);
    }, [isOpen]);

    const checkMaintenance = () => {
        const config = getSystemConfig();
        if (config?.maintenanceMode) {
            const diff = config.maintenanceEndTime - Date.now();
            if (diff > 0) {
                setMaintenanceInfo({ active: true, remaining: Math.ceil(diff / 60000) });
            } else {
                setMaintenanceInfo(null);
            }
        } else {
            setMaintenanceInfo(null);
        }
    }

    const resetForm = () => {
        setUsername(''); setPassword(''); setEmail(''); setConfirmPass(''); 
        setTelegramChatId(''); setIsAgreed(false); setIsLoading(false);
        setOtpStep('idle'); setGeneratedOtp(null);
        setLoginStep('credentials'); setLoginOtpInput(''); setTempLoginUser(null);
        setErrors({}); setPasswordStrength(0);
        setShowLoginPass(false); setShowRegPass(false); setShowConfirmPass(false);
    }

    if (!isOpen) return null;

    const validateEmail = (val: string) => (!val ? "Email không được để trống." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? "Định dạng Email không hợp lệ." : "");
    const validateUsername = (val: string) => (!val ? "Tên đăng nhập không được để trống." : /\s/.test(val) ? "Viết liền không khoảng trắng." : !/^[a-zA-Z0-9]+$/.test(val) ? "Không được chứa dấu." : val.length < 3 ? "Tối thiểu 3 ký tự." : "");
    const checkPasswordStrength = (val: string) => {
        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val) || /[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++; 
        setPasswordStrength(Math.min(4, score));
        return val.length < 6 ? "Mật khẩu tối thiểu 6 ký tự." : "";
    };

    const handleInputChange = (field: string, value: string) => {
        let errorMsg = "";
        if (field === 'email') { setEmail(value); errorMsg = validateEmail(value); } 
        else if (field === 'username') { setUsername(value); errorMsg = validateUsername(value); } 
        else if (field === 'password') { 
            setPassword(value); errorMsg = checkPasswordStrength(value); 
            if (confirmPass) setErrors(prev => ({ ...prev, confirm: value !== confirmPass ? "Mật khẩu xác nhận không khớp." : "" }));
        } else if (field === 'confirmPass') { 
            setConfirmPass(value); errorMsg = value && value !== password ? "Mật khẩu không khớp." : ""; 
        }
        setErrors(prev => ({ ...prev, [field]: errorMsg }));
    };

    const ValidationBubble = ({ message, type = 'error' }: { message: string, type?: 'error' | 'info' | 'success' }) => {
        if (!message && type !== 'success') return null;
        let bgColor = type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' : type === 'success' ? 'bg-green-950/90 border-green-500/50 text-green-200' : 'bg-blue-950/90 border-blue-500/50 text-blue-200';
        let arrowColor = type === 'error' ? 'border-t-red-900/90' : type === 'success' ? 'border-t-green-900/90' : 'border-t-blue-900/90';
        let icon = type === 'error' ? <AlertCircle size={12}/> : <CheckCircle2 size={12}/>;
        return (
            <div className={`absolute bottom-full left-0 mb-2 w-full p-2 rounded-lg text-[10px] font-bold shadow-xl animate-[fadeIn_0.2s_ease-out] z-20 border ${bgColor}`}>
                <div className="flex items-start gap-1.5">{icon}<span className="leading-tight">{message}</span></div>
                <div className={`absolute top-full left-4 -mt-px border-4 border-transparent ${arrowColor}`}></div>
            </div>
        );
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (username.toLowerCase() !== 'admin' && maintenanceInfo?.active) { addToast("Bảo trì", `Hệ thống đang bảo trì. Vui lòng quay lại sau ${maintenanceInfo.remaining} phút.`, "warning"); return; }
        setIsLoading(true);
        try {
            const res = await loginUser(username, password);
            if (res.success && res.user) {
                if (res.user.role === 'admin') { onLoginSuccess(res.user); addToast("Thành công", res.message, "success"); onClose(); } 
                else if (res.requireOtp) {
                    setTempLoginUser(res.user);
                    const code = generateOTP();
                    const otpRes = await sendOTP(res.user.telegramChatId!, code, 'register');
                    if (otpRes.success) { setGeneratedOtp(code); setLoginStep('otp'); addToast("Yêu cầu xác thực", "Mã OTP đã được gửi đến Telegram của bạn.", "info"); } 
                    else { addToast("Lỗi gửi OTP", "Không thể gửi tin nhắn Telegram.", "error"); }
                }
            } else { addToast("Lỗi", res.message, "error"); }
        } catch (err) { addToast("Lỗi", "Đã xảy ra lỗi hệ thống.", "error"); } finally { setIsLoading(false); }
    };

    const handleLoginVerifyOtp = async () => {
        if (loginOtpInput === generatedOtp && tempLoginUser) {
            setIsLoading(true);
            try {
                const finalizedUser = await finalizeUserLogin(tempLoginUser.username);
                if (finalizedUser) { onLoginSuccess(finalizedUser); addToast("Thành công", "Đăng nhập an toàn.", "success"); onClose(); } 
                else { addToast("Lỗi", "Không thể khởi tạo phiên làm việc.", "error"); }
            } catch (e) { addToast("Lỗi mạng", "Lỗi kết nối server.", "error"); } finally { setIsLoading(false); }
        } else { addToast("Thất bại", "Mã OTP không chính xác.", "error"); }
    };

    const handleSendRegisterOtp = async () => {
        if (maintenanceInfo?.active) { addToast("Bảo trì", "Không thể đăng ký trong thời gian bảo trì.", "warning"); return; }
        if (!telegramChatId) { addToast("Lỗi", "Vui lòng nhập Telegram Chat ID", "error"); return; }
        setIsLoading(true);
        try {
            const code = generateOTP();
            const res = await sendOTP(telegramChatId, code, 'register');
            if (res.success) { setGeneratedOtp(code); setOtpStep('verifying'); addToast("Đã gửi OTP", "Kiểm tra tin nhắn Telegram của bạn", "info"); } 
            else { addToast("Lỗi Telegram", res.error || "Không thể gửi OTP.", "error"); }
        } catch (e) { addToast("Lỗi mạng", "Không thể kết nối Telegram", "error"); } finally { setIsLoading(false); }
    }

    const handleVerifyRegisterOtp = (inputCode: string) => {
        if (inputCode === generatedOtp) { setOtpStep('verified'); addToast("Thành công", "Xác thực Telegram thành công!", "success"); } 
        else { addToast("Lỗi", "Mã OTP không chính xác", "error"); }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (maintenanceInfo?.active) { addToast("Bảo trì", "Hệ thống tạm khóa đăng ký.", "warning"); return; }
        if (validateEmail(email) || validateUsername(username) || checkPasswordStrength(password) || password !== confirmPass) {
            setErrors({ email: validateEmail(email), username: validateUsername(username), password: checkPasswordStrength(password), confirm: password !== confirmPass ? "Mật khẩu không khớp" : "" });
            addToast("Lỗi thông tin", "Vui lòng kiểm tra lại các trường báo đỏ.", "error");
            return;
        }
        if (!isAgreed) { addToast("Lỗi", "Bạn phải đồng ý với điều khoản.", "error"); return; }
        if (telegramChatId && otpStep !== 'verified') { addToast("Chưa xác thực", "Vui lòng xác thực Telegram ID.", "error"); return; }
        setIsLoading(true);
        try {
            const newUser: RegisteredUser = { username, email, password, role: 'user', isVerified: false, permissions: {}, credits: 10, createdAt: Date.now(), deviceId: '', telegramChatId: telegramChatId || undefined };
            const res = await registerUser(newUser);
            if (res.success && res.user) { onLoginSuccess(res.user); addToast("Thành công", "Đăng ký thành công!", "success"); onClose(); } 
            else { addToast("Lỗi", res.message, "error"); }
        } catch (e) { addToast("Lỗi", "Có lỗi xảy ra khi đăng ký", "error"); } finally { setIsLoading(false); }
    };
    
    const isMaintenanceMode = maintenanceInfo?.active && username.toLowerCase() !== 'admin';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10" disabled={isLoading}><X size={20}/></button>
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="text-center mb-6"><h2 className="text-2xl font-black text-white mb-2">UltraEdit 8K</h2><p className="text-sm text-zinc-400">{mode === 'login' ? 'Đăng nhập bảo mật' : mode === 'register' ? 'Tạo tài khoản mới' : 'Khôi phục tài khoản'}</p></div>
                    {mode === 'login' && (
                        <div className="space-y-4">
                            {loginStep === 'credentials' ? (
                                <form onSubmit={handleLoginSubmit} className="space-y-4">
                                    <div className="relative group"><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" placeholder="Tên đăng nhập / Email" disabled={isLoading} /></div>
                                    <div className="relative group"><input type={showLoginPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pr-10 text-white focus:border-indigo-500 outline-none" placeholder="Mật khẩu" disabled={isLoading} /><button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-3 top-3 text-zinc-500 hover:text-white" tabIndex={-1}>{showLoginPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
                                    <div className="flex items-center justify-between px-1"><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="accent-indigo-500 rounded bg-zinc-800 border-zinc-700"/><span className="text-xs text-zinc-400 group-hover:text-white transition-colors">Ghi nhớ đăng nhập</span></label><button type="button" className="text-xs text-indigo-400 hover:underline" onClick={() => { setMode('forgot'); resetForm(); }}>Quên mật khẩu?</button></div>
                                    <button type="submit" disabled={isLoading || isMaintenanceMode} className={`w-full py-3 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg ${isMaintenanceMode ? 'bg-zinc-800 text-zinc-400' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'}`}>{isLoading ? <><Loader2 size={20} className="animate-spin" /> Đang kiểm tra...</> : isMaintenanceMode ? `Đang Bảo Trì: Còn ${maintenanceInfo?.remaining} Phút` : "Đăng Nhập"}</button>
                                </form>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl text-center"><ShieldAlert size={32} className="mx-auto text-indigo-400 mb-2"/><h3 className="text-white font-bold mb-1">Bảo Mật Thiết Bị</h3><p className="text-xs text-indigo-200">Nhập mã OTP từ Telegram để xác thực và đăng nhập trên thiết bị này.</p></div>
                                    <div><input type="text" value={loginOtpInput} onChange={e => setLoginOtpInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center text-white text-lg tracking-widest font-mono focus:border-indigo-500 outline-none" placeholder="XXXXXX" maxLength={6} autoFocus/></div>
                                    <button onClick={handleLoginVerifyOtp} disabled={isLoading} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">{isLoading ? <Loader2 size={18} className="animate-spin"/> : "Xác nhận & Đăng nhập"}</button>
                                    <button onClick={() => { setLoginStep('credentials'); setGeneratedOtp(null); }} className="w-full py-2 text-xs text-zinc-500 hover:text-white">Quay lại</button>
                                </div>
                            )}
                            {loginStep === 'credentials' && (<><div className="flex items-center gap-3 my-2"><div className="h-px bg-zinc-800 flex-1"></div><span className="text-xs text-zinc-500 flex items-center gap-1"><Cloud size={10} className="text-green-500"/> Cloud Sync Enabled</span><div className="h-px bg-zinc-800 flex-1"></div></div><button onClick={() => { setMode('register'); resetForm(); }} className="w-full py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-xl font-bold transition-all text-sm">Tạo tài khoản mới</button></>)}
                        </div>
                    )}
                    {mode === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="relative group">{(activeField === 'email' || errors.email) && <ValidationBubble message={errors.email || "Email hợp lệ (VD: user@gmail.com)"} type={errors.email ? 'error' : 'info'} />}<input type="email" value={email} onChange={e => handleInputChange('email', e.target.value)} onFocus={() => setActiveField('email')} onBlur={() => setActiveField(null)} className={`w-full bg-zinc-950 border rounded-xl p-3 text-white text-sm outline-none ${errors.email ? 'border-red-500' : 'border-zinc-800 focus:border-indigo-500'}`} placeholder="Email" disabled={isLoading || isMaintenanceMode} required /></div>
                            <div className="relative group">{(activeField === 'username' || errors.username) && <ValidationBubble message={errors.username || "Viết liền không dấu."} type={errors.username ? 'error' : 'info'} />}<input type="text" value={username} onChange={e => handleInputChange('username', e.target.value)} onFocus={() => setActiveField('username')} onBlur={() => setActiveField(null)} className={`w-full bg-zinc-950 border rounded-xl p-3 text-white text-sm outline-none ${errors.username ? 'border-red-500' : 'border-zinc-800 focus:border-indigo-500'}`} placeholder="Tên đăng nhập" disabled={isLoading || isMaintenanceMode} required /></div>
                            <div className="relative group">{(activeField === 'password' || errors.password) && <ValidationBubble message={errors.password || "Tối thiểu 6 ký tự."} type={errors.password ? 'error' : 'info'} />}<div className="relative"><input type={showRegPass ? "text" : "password"} value={password} onChange={e => handleInputChange('password', e.target.value)} onFocus={() => setActiveField('password')} onBlur={() => setActiveField(null)} className={`w-full bg-zinc-950 border rounded-xl p-3 pr-10 text-white text-sm outline-none ${errors.password ? 'border-red-500' : 'border-zinc-800 focus:border-indigo-500'}`} placeholder="Mật khẩu" disabled={isLoading || isMaintenanceMode} required /><button type="button" onClick={() => setShowRegPass(!showRegPass)} className="absolute right-3 top-3 text-zinc-500 hover:text-white" tabIndex={-1}>{showRegPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>{password && (<div className="flex gap-1 mt-1.5 h-1"><div className={`flex-1 rounded-full ${passwordStrength >= 1 ? 'bg-red-500' : 'bg-zinc-800'}`}></div><div className={`flex-1 rounded-full ${passwordStrength >= 2 ? 'bg-orange-500' : 'bg-zinc-800'}`}></div><div className={`flex-1 rounded-full ${passwordStrength >= 3 ? 'bg-yellow-500' : 'bg-zinc-800'}`}></div><div className={`flex-1 rounded-full ${passwordStrength >= 4 ? 'bg-green-500' : 'bg-zinc-800'}`}></div></div>)}</div>
                            <div className="relative group">{confirmPass && (errors.confirm ? <ValidationBubble message={errors.confirm} type='error' /> : (password === confirmPass && <ValidationBubble message="Mật khẩu khớp!" type='success' />))}<div className="relative"><input type={showConfirmPass ? "text" : "password"} value={confirmPass} onChange={e => handleInputChange('confirmPass', e.target.value)} onFocus={() => setActiveField('confirmPass')} onBlur={() => setActiveField(null)} className={`w-full bg-zinc-950 border rounded-xl p-3 pr-10 text-white text-sm outline-none ${errors.confirm ? 'border-red-500' : (confirmPass && password === confirmPass ? 'border-green-500' : 'border-zinc-800 focus:border-indigo-500')}`} placeholder="Nhập lại mật khẩu" disabled={isLoading || isMaintenanceMode} required /><button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-3 text-zinc-500 hover:text-white" tabIndex={-1}>{showConfirmPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
                            <TelegramConnect telegramChatId={telegramChatId} setTelegramChatId={setTelegramChatId} otpStep={otpStep} onSendOtp={handleSendRegisterOtp} onVerifyOtp={handleVerifyRegisterOtp} isLoading={isLoading} botUsername={botInfo?.username} maintenanceActive={isMaintenanceMode} />
                            <div className="flex flex-col gap-2"><div className="flex items-start gap-2"><input type="checkbox" id="terms_check" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="mt-1 accent-indigo-500 rounded bg-zinc-800 border-zinc-700 cursor-pointer" disabled={isMaintenanceMode}/><label htmlFor="terms_check" className="text-xs text-zinc-400 cursor-pointer hover:text-white transition-colors leading-relaxed select-none">Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của UltraEdit 8K.</label></div><button type="button" onClick={() => setIsPolicyOpen(true)} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 self-start ml-6"><FileText size={10}/> Xem chi tiết chính sách</button></div>
                            <button type="submit" disabled={isLoading || otpStep !== 'verified' || isMaintenanceMode} className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isMaintenanceMode ? 'bg-zinc-800 text-zinc-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>{isLoading ? <Loader2 size={18} className="animate-spin" /> : isMaintenanceMode ? `Đang Bảo Trì: Còn ${maintenanceInfo?.remaining} Phút` : "Đăng Ký Tài Khoản"}</button>
                            <button type="button" onClick={() => { setMode('login'); resetForm(); }} className="w-full py-2 text-xs text-zinc-500 hover:text-white">Đã có tài khoản? Đăng nhập</button>
                        </form>
                    )}
                    {mode === 'forgot' && (<div className="space-y-4"><p className="text-sm text-zinc-400 text-center">Liên hệ Admin để reset mật khẩu hoặc dùng Telegram Recovery (Coming Soon).</p><button type="button" onClick={() => { setMode('login'); resetForm(); }} className="w-full py-2 bg-zinc-800 text-white rounded-xl">Quay lại</button></div>)}
                </div>
            </div>
            <PolicyModal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />
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
      permissions: {},
      credits: 0,
      createdAt: 0
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // GLOBAL PROCESSING LOCK STATE
  const [isGlobalProcessing, setGlobalProcessing] = useState(false);
  
  // Ref to track latest user state inside interval closures
  const userRef = useRef<User>(user);

  useEffect(() => {
      userRef.current = user;
  }, [user]);

  useEffect(() => {
    const storedUser = localStorage.getItem('ue_current_user');
    if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Load initial notifications from storage if available
        if (parsed.notifications) {
            setNotifications(parsed.notifications);
        }
        
        // On load, perform a silent sync to check if session is still valid
        syncUsersFromCloud().then(() => {
             if (parsed.role !== 'admin') {
                 if (isSessionValid(parsed.username, parsed.currentSessionId)) {
                     setUser({ ...parsed, isAuthenticated: true });
                 } else {
                     // Session invalid immediately on load
                     localStorage.removeItem('ue_current_user');
                     addToast("Hết phiên", "Phiên đăng nhập đã hết hạn hoặc tài khoản đang được sử dụng ở nơi khác.", "warning");
                 }
             } else {
                 setUser({ ...parsed, isAuthenticated: true });
             }
        });
    }
  }, []);

  // --- SESSION GUARD & NOTIFICATION SYNC ---
  useEffect(() => {
      if (!user.isAuthenticated) return;

      const interval = setInterval(async () => {
          const currentUserState = userRef.current;
          
          if (!currentUserState.isAuthenticated) return;

          // 1. Sync Data
          const updatedUsers = await syncUsersFromCloud();
          
          // 2. Security Check (Kick-out logic)
          if (currentUserState.role !== 'admin') {
              if (!isSessionValid(currentUserState.username, currentUserState.sessionId || (currentUserState as any).currentSessionId)) {
                  console.warn("Session invalidated by cloud sync.");
                  handleLogout();
                  addToast("Đăng xuất", "Tài khoản của bạn đã được đăng nhập ở thiết bị khác.", "error");
                  return;
              }
          }

          // 3. Update Notifications & Credits
          const latestUserData = updatedUsers.find(u => u.username === currentUserState.username);
          if (latestUserData) {
              // Update credits/verification live
              if (latestUserData.credits !== currentUserState.credits || latestUserData.isVerified !== currentUserState.isVerified || JSON.stringify(latestUserData.permissions) !== JSON.stringify(currentUserState.permissions)) {
                  const updatedUser = { 
                      ...currentUserState, 
                      credits: latestUserData.credits, 
                      isVerified: latestUserData.isVerified,
                      permissions: latestUserData.permissions // Sync perms too
                  };
                  setUser(updatedUser);
                  localStorage.setItem('ue_current_user', JSON.stringify(updatedUser));
              }

              const serverNotifs = getUserNotifications(currentUserState.username);
              if (JSON.stringify(serverNotifs) !== JSON.stringify(notifications)) {
                  setNotifications(serverNotifs);
              }
          }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
  }, [user.isAuthenticated]);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    // 1. Show Visual Toast
    const id = uuidv4();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);

    // 2. Add to Notification History (Persistent)
    // Only if authenticated, to ensure it attaches to a user
    if (user.isAuthenticated) {
        const newNotification: AppNotification = {
            id: uuidv4(),
            title,
            message,
            type,
            timestamp: Date.now(),
            read: false
        };

        // Update local state immediately
        const updatedNotifications = [newNotification, ...notifications];
        setNotifications(updatedNotifications);

        // Update User object & LocalStorage
        const updatedUser = { ...user, notifications: updatedNotifications };
        setUser(updatedUser);
        userRef.current = updatedUser; // Update Ref
        localStorage.setItem('ue_current_user', JSON.stringify(updatedUser));
    }
  };

  const addNotification = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      // Wrapper for consistency
      addToast(title, message, type);
  }

  const handleLoginSuccess = (registeredUser: RegisteredUser) => {
      const appUser: User = {
          username: registeredUser.username,
          email: registeredUser.email,
          role: registeredUser.role,
          isAuthenticated: true,
          isVerified: registeredUser.isVerified,
          permissions: registeredUser.permissions,
          credits: registeredUser.credits,
          sessionId: registeredUser.currentSessionId, // Store current session
          telegramChatId: registeredUser.telegramChatId,
          createdAt: registeredUser.createdAt // Added createdAt property
      };
      setUser(appUser);
      localStorage.setItem('ue_current_user', JSON.stringify(appUser));
      setNotifications(registeredUser.notifications || []);
  };

  const handleLogout = () => {
      setUser({ 
          username: 'Guest', 
          email: '',
          role: 'user', 
          isAuthenticated: false,
          isVerified: false,
          permissions: {},
          credits: 0,
          createdAt: 0
      });
      localStorage.removeItem('ue_current_user');
      setActiveModule(ModuleType.HOME);
      setNotifications([]);
  };

  const handleMarkAllRead = () => {
      if (user.isAuthenticated) {
          markNotificationsRead(user.username);
          const updated = notifications.map(n => ({...n, read: true}));
          setNotifications(updated);
          
          // Update local storage immediately for UI responsiveness
          const updatedUser = { ...user, notifications: updated };
          setUser(updatedUser);
          localStorage.setItem('ue_current_user', JSON.stringify(updatedUser));
      }
  };

  const handleDeleteNotification = (id: string) => {
      if (user.isAuthenticated) {
          const updated = notifications.filter(n => n.id !== id);
          setNotifications(updated);
          const updatedUser = { ...user, notifications: updated };
          setUser(updatedUser);
          localStorage.setItem('ue_current_user', JSON.stringify(updatedUser));
      }
  }

  // PERSISTENCE LOGIC:
  // Instead of unmounting modules, we hide/show them using CSS based on activeModule.
  // This preserves state. Home, AdminPanel, and Library are exceptions or can be kept mounted too.
  // For better performance, we might want to unmount Home or Admin, but creation modules MUST stay mounted.

  return (
    <Layout 
        activeModule={activeModule} 
        onModuleChange={setActiveModule} 
        user={user} 
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        addToast={addToast}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onDeleteNotification={handleDeleteNotification}
        onOpenLogin={() => setIsAuthModalOpen(true)}
    >
      {/* 
         PERSISTENT MODULE RENDERER 
         All creation modules are mounted once and hidden/shown.
         Global processing state is passed down to all.
      */}
      
      {/* HOME (Re-mounts to refresh stats) */}
      {activeModule === ModuleType.HOME && (
          <Home onNavigate={setActiveModule} currentUser={user} />
      )}

      {/* ADMIN (Re-mounts to refresh data) */}
      {activeModule === ModuleType.ADMIN_PANEL && (
          <AdminPanel currentUser={user as unknown as RegisteredUser} addToast={addToast}/>
      )}

      {/* LIBRARY (Re-mounts or handles visibility internally via isActive prop) */}
      <div style={{ display: activeModule === ModuleType.LIBRARY ? 'block' : 'none', height: '100%' }}>
          <Library 
            onNavigate={(m, d) => { setActiveModule(m); /* Handle data passing logic in future */ }} 
            addToast={addToast} 
            isActive={activeModule === ModuleType.LIBRARY}
          />
      </div>

      {/* CHANNEL BUILDER (PERSISTENT) */}
      <div style={{ display: activeModule === ModuleType.CHANNEL_BUILDER ? 'block' : 'none', height: '100%' }}>
          <ChannelBuilder
            addToast={addToast}
            currentUser={user}
            onNavigate={(m, d) => { setActiveModule(m); }}
          />
      </div>

      {/* CREATION MODULES (PERSISTENT) */}
      <div style={{ display: activeModule === ModuleType.NEW_CREATION ? 'block' : 'none', height: '100%' }}>
          <NewCreation 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            isAuthenticated={user.isAuthenticated}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      {/* PHOTO EDITOR (PERSISTENT) */}
      <div style={{ display: activeModule === ModuleType.PHOTO_EDITOR ? 'block' : 'none', height: '100%' }}>
          <PhotoEditor 
            addToast={addToast} 
            isAuthenticated={user.isAuthenticated}
            onRequireAuth={() => setIsAuthModalOpen(true)}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.STUDIO ? 'block' : 'none', height: '100%' }}>
          <Studio 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            isAuthenticated={user.isAuthenticated}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.VEO_IDEAS ? 'block' : 'none', height: '100%' }}>
          <VeoIdeas 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            isAuthenticated={user.isAuthenticated}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.IMAGE_TO_VIDEO ? 'block' : 'none', height: '100%' }}>
          <ImageToVideo 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            isAuthenticated={user.isAuthenticated}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.POSTER ? 'block' : 'none', height: '100%' }}>
          <Poster 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            isAuthenticated={user.isAuthenticated}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.THUMBNAIL ? 'block' : 'none', height: '100%' }}>
          <Thumbnail 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user} 
            onRequireAuth={() => setIsAuthModalOpen(true)} 
            isAuthenticated={user.isAuthenticated}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.CHARACTER_CREATOR ? 'block' : 'none', height: '100%' }}>
          <CharacterCreator 
            addToast={addToast} 
            addNotification={addNotification} 
            currentUser={user}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <div style={{ display: activeModule === ModuleType.STORY_CREATOR ? 'block' : 'none', height: '100%' }}>
          <StoryCreator 
            addToast={addToast} 
            currentUser={user}
            isGlobalProcessing={isGlobalProcessing}
            setGlobalProcessing={setGlobalProcessing}
          />
      </div>

      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess}
        addToast={addToast}
      />
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        addToast={addToast}
        user={user}
      />
    </Layout>
  );
};

export default App;
