
import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, CheckCircle, AlertCircle, HardDrive, RefreshCw, X, Cpu, Zap, Crown, UserCog, Save, Key, User as UserIcon, MessageCircle, Lock, Loader2 } from 'lucide-react';
import { exportDatabase, importDatabase } from '../services/db';
import { updateUserCredentials, getAllUsers } from '../services/userService';
import { getBotInfo } from '../services/telegramService';
import { User } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
    user: User;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, addToast, user }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [modelTier, setModelTier] = useState<'free' | 'paid'>('free');
    
    // Account Edit States
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [editTelegramId, setEditTelegramId] = useState('');
    const [botUsername, setBotUsername] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const savedTier = localStorage.getItem('ue_model_tier') as 'free' | 'paid';
            if (savedTier) setModelTier(savedTier);
            setEditUsername(user.username);
            setEditTelegramId(user.telegramChatId || '');
            setEditPassword('');
            setConfirmPassword('');
            
            // Fetch Bot Info
            getBotInfo().then(info => {
                if (info) setBotUsername(info.username);
            });
        }
    }, [isOpen, user]);

    const handleSaveTier = (tier: 'free' | 'paid') => {
        setModelTier(tier);
        localStorage.setItem('ue_model_tier', tier);
        addToast('Cập nhật thành công', `Đã chuyển sang gói mô hình: ${tier === 'free' ? 'Gemini 2.5 Pro (Miễn phí)' : 'Gemini 3.0 Pro (Trả phí)'}`, 'success');
    };

    const handleUpdateAccount = async () => {
        if (editPassword && editPassword !== confirmPassword) {
            addToast('Lỗi', 'Mật khẩu xác nhận không khớp.', 'error');
            return;
        }
        
        setIsProcessing(true);
        try {
            const telegramIdToUpdate = user.telegramChatId ? undefined : editTelegramId;

            const res = await updateUserCredentials(user.username, editUsername, editPassword || undefined, telegramIdToUpdate);
            if (res.success) {
                addToast('Thành công', 'Thông tin tài khoản đã được cập nhật.', 'success');
                const currentUserStr = localStorage.getItem('ue_current_user');
                if (currentUserStr) {
                    const currentUser = JSON.parse(currentUserStr);
                    currentUser.username = editUsername;
                    if (!user.telegramChatId && editTelegramId) {
                        currentUser.telegramChatId = editTelegramId;
                    }
                    localStorage.setItem('ue_current_user', JSON.stringify(currentUser));
                }
            } else {
                addToast('Lỗi', res.message, 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    const handleBackup = async () => {
        setIsProcessing(true);
        try {
            const jsonStr = await exportDatabase();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `UltraEdit-Backup-${new Date().toISOString().split('T')[0]}.ultra8k`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast('Sao lưu thành công', 'File backup đã được tải xuống máy của bạn.', 'success');
        } catch (error) {
            console.error(error);
            addToast('Lỗi', 'Không thể tạo file backup.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const result = await importDatabase(content);
                addToast('Khôi phục thành công', `Đã nhập ${result.itemsCount} tác phẩm và ${result.charsCount} nhân vật.`, 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                console.error(error);
                addToast('Lỗi', 'File backup không hợp lệ hoặc bị lỗi.', 'error');
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
    };

    const isAdmin = user.role === 'admin';
    const isTelegramLinked = !!user.telegramChatId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <UserCog size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Quản Lý Tài Khoản</h3>
                            <p className="text-xs text-zinc-400">Cập nhật thông tin và bảo mật cho {user.username}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                    
                    {/* ACCOUNT INFO */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <UserIcon size={16} className="text-blue-400"/> Thông tin cá nhân
                        </h4>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-zinc-500 font-bold mb-1 block">Tên hiển thị</label>
                                <div className="relative">
                                    <UserIcon size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                    <input 
                                        type="text" 
                                        value={editUsername} 
                                        onChange={e => setEditUsername(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-zinc-500 font-bold mb-1 block flex justify-between">
                                    Telegram Chat ID (Bảo mật OTP)
                                    {!isTelegramLinked && botUsername && (
                                        <a 
                                            href={`https://t.me/${botUsername}?start=getid`} 
                                            target="_blank" 
                                            className="text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                            Lấy ID?
                                        </a>
                                    )}
                                </label>
                                <div className="relative">
                                    {isTelegramLinked ? (
                                        <Lock size={14} className="absolute left-3 top-3 text-emerald-500"/>
                                    ) : (
                                        <MessageCircle size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                    )}
                                    
                                    <input 
                                        type="text" 
                                        value={editTelegramId} 
                                        onChange={e => setEditTelegramId(e.target.value)}
                                        placeholder="Nhập Chat ID..."
                                        className={`w-full bg-zinc-950 border rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none ${isTelegramLinked ? 'border-emerald-900/50 text-zinc-400 cursor-not-allowed' : 'border-zinc-800 focus:border-blue-500'}`}
                                        disabled={isTelegramLinked}
                                        readOnly={isTelegramLinked}
                                    />
                                    {isTelegramLinked && (
                                        <span className="absolute right-3 top-3 text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                            <CheckCircle size={10}/> Đã liên kết
                                        </span>
                                    )}
                                </div>
                                {isTelegramLinked && <p className="text-[10px] text-zinc-500 mt-1 italic">* Không thể thay đổi ID đã liên kết vì lý do bảo mật.</p>}
                            </div>

                            <div>
                                <label className="text-xs text-zinc-500 font-bold mb-1 block">Đổi mật khẩu (Để trống nếu không đổi)</label>
                                <div className="relative space-y-2">
                                    <div className="relative">
                                        <Key size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                        <input 
                                            type="password" 
                                            value={editPassword} 
                                            onChange={e => setEditPassword(e.target.value)}
                                            placeholder="Mật khẩu mới"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    {editPassword && (
                                        <div className="relative">
                                            <Key size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                            <input 
                                                type="password" 
                                                value={confirmPassword} 
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="Xác nhận mật khẩu"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={handleUpdateAccount}
                                disabled={isProcessing}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                            >
                                {isProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14}/>} Lưu thay đổi
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* MODEL CONFIGURATION (ADMIN ONLY) */}
                    {isAdmin && (
                        <>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                    <Cpu size={16} className="text-indigo-400"/> Cấu hình Mô hình AI (Admin Only)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleSaveTier('free')}
                                        className={`relative p-4 rounded-xl border text-left transition-all ${
                                            modelTier === 'free' 
                                            ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500/50' 
                                            : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <Zap size={20} className={modelTier === 'free' ? 'text-indigo-400' : 'text-zinc-600'} />
                                            {modelTier === 'free' && <CheckCircle size={16} className="text-indigo-500" />}
                                        </div>
                                        <div className="font-bold text-sm text-white">Gemini 2.5 Pro</div>
                                        <div className="text-xs text-zinc-400 mt-1">Gói tiêu chuẩn (Miễn phí)</div>
                                    </button>

                                    <button
                                        onClick={() => handleSaveTier('paid')}
                                        className={`relative p-4 rounded-xl border text-left transition-all ${
                                            modelTier === 'paid' 
                                            ? 'bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-pink-500 ring-1 ring-pink-500/50' 
                                            : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <Crown size={20} className={modelTier === 'paid' ? 'text-pink-400' : 'text-zinc-600'} />
                                            {modelTier === 'paid' && <CheckCircle size={16} className="text-pink-500" />}
                                        </div>
                                        <div className="font-bold text-sm text-white">Gemini 3.0 Pro</div>
                                        <div className="text-xs text-zinc-400 mt-1">Gói cao cấp (Trả phí)</div>
                                    </button>
                                </div>
                            </div>
                            <div className="h-px bg-white/5"></div>
                        </>
                    )}

                    {/* DATA SYNC */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <HardDrive size={16} className="text-green-400"/> Dữ liệu cục bộ
                        </h4>
                        
                        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-3 flex items-start gap-3">
                            <AlertCircle className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                            <p className="text-zinc-400 leading-relaxed text-xs">
                                Dữ liệu được lưu trên trình duyệt này. Sử dụng chức năng bên dưới để chuyển dữ liệu sang thiết bị khác (Backup/Restore).
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={handleBackup}
                                disabled={isProcessing}
                                className="group flex flex-col items-center justify-center gap-2 p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-green-500/50 hover:bg-zinc-900 transition-all"
                            >
                                <Download size={20} className="text-zinc-400 group-hover:text-green-400 transition-colors" />
                                <span className="font-bold text-zinc-300 text-xs">Sao lưu (.ultra8k)</span>
                            </button>

                            <label 
                                className={`group flex flex-col items-center justify-center gap-2 p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-blue-500/50 hover:bg-zinc-900 transition-all cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <Upload size={20} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
                                <span className="font-bold text-zinc-300 text-xs">Khôi phục</span>
                                <input type="file" accept=".json,.ultra8k" className="hidden" onChange={handleRestore} />
                            </label>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-zinc-600 text-[10px]">
                            <span>Local Storage & IndexedDB Enabled</span>
                        </div>
                        {isProcessing && (
                             <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold animate-pulse">
                                <RefreshCw size={14} className="animate-spin" /> Đang xử lý...
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
