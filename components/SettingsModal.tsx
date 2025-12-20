
import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, CheckCircle, AlertCircle, HardDrive, RefreshCw, X, Cpu, Zap, Crown, UserCog, Save, Key, User as UserIcon, MessageCircle, Lock, Loader2, Database, Link, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { exportDatabase, importDatabase, saveItem, getAllItems } from '../services/db'; // Import getAllItems/saveItem for sync
import { updateUserCredentials, getAllUsers } from '../services/userService';
import { getBotInfo } from '../services/telegramService';
import { driveService } from '../services/googleDriveService'; // Import Drive Service
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

    // Google Drive States
    const [driveClientId, setDriveClientId] = useState('');
    const [driveApiKey, setDriveApiKey] = useState('');
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    const [driveLoading, setDriveLoading] = useState(false);
    const [isCloudOnly, setIsCloudOnly] = useState(false); // New state for Cloud Only Mode

    useEffect(() => {
        if (isOpen) {
            const savedTier = localStorage.getItem('ue_model_tier') as 'free' | 'paid';
            if (savedTier) setModelTier(savedTier);
            setEditUsername(user.username);
            setEditTelegramId(user.telegramChatId || '');
            setEditPassword('');
            setConfirmPassword('');
            
            // Load Cloud Only Setting
            setIsCloudOnly(localStorage.getItem('ue_cloud_only_mode') === 'true');
            
            // Fetch Bot Info
            getBotInfo().then(info => {
                if (info) setBotUsername(info.username);
            });

            // Load Drive Config
            const config = driveService.getConfig();
            if (config) {
                setDriveClientId(config.clientId);
                setDriveApiKey(config.apiKey);
                if (driveService.isAuthenticated()) {
                    setIsDriveConnected(true);
                } else if (config.accessToken) {
                    addToast("Token hết hạn", "Vui lòng kết nối lại Google Drive.", "info");
                    setIsDriveConnected(false);
                }
            } else {
                // Try pre-fill from env if available (for dev convenience)
                if (process.env.GOOGLE_CLIENT_ID) setDriveClientId(process.env.GOOGLE_CLIENT_ID);
                if (process.env.GOOGLE_API_KEY) setDriveApiKey(process.env.GOOGLE_API_KEY);
            }
        }
    }, [isOpen, user]);

    // --- DRIVE HANDLERS ---
    const handleConnectDrive = async () => {
        if (!driveClientId || !driveApiKey) {
            addToast('Thiếu thông tin', 'Vui lòng nhập Client ID và API Key.', 'error');
            return;
        }
        setDriveLoading(true);
        try {
            driveService.saveConfig(driveClientId, driveApiKey);
            // This now explicitly loads Drive v3 to avoid discovery error
            await driveService.initialize(); 
            await driveService.login();
            setIsDriveConnected(true);
            addToast('Kết nối thành công', 'Đã liên kết với Google Drive.', 'success');
        } catch (e: any) {
            console.error(e);
            let msg = e.error || e.message || 'Lỗi không xác định.';
            if (msg.includes('popup')) msg = "Trình duyệt chặn Popup đăng nhập. Hãy cho phép.";
            addToast('Lỗi kết nối', msg, 'error');
            setIsDriveConnected(false);
        } finally {
            setDriveLoading(false);
        }
    };

    const handleToggleCloudOnly = () => {
        const newValue = !isCloudOnly;
        setIsCloudOnly(newValue);
        localStorage.setItem('ue_cloud_only_mode', String(newValue));
        addToast(
            newValue ? 'Chế độ Cloud-Only' : 'Chế độ Lưu trữ Kép',
            newValue 
                ? 'Dữ liệu sẽ chỉ lưu trên Google Drive. Bộ nhớ máy được giải phóng.' 
                : 'Dữ liệu sẽ lưu cả trên máy và Drive (Tốc độ cao hơn).', 
            'info'
        );
        // Dispatch event to refresh library
        window.dispatchEvent(new Event('library_updated'));
    };

    const handleSyncToDrive = async () => {
        if (!isDriveConnected) {
            addToast("Chưa kết nối", "Vui lòng kết nối lại Drive.", "error");
            return;
        }
        setIsProcessing(true);
        try {
            const allItems = await getAllItems();
            addToast('Đang đồng bộ', `Đang tải ${allItems.length} mục lên Drive...`, 'info');
            
            // Upload in parallel chunks to prevent freezing but speed up
            const chunkSize = 5;
            for (let i = 0; i < allItems.length; i += chunkSize) {
                const chunk = allItems.slice(i, i + chunkSize);
                await Promise.all(chunk.map(item => driveService.uploadItem(item)));
            }
            
            addToast('Hoàn tất', 'Đã đồng bộ toàn bộ dữ liệu lên Google Drive.', 'success');
        } catch (e: any) {
            console.error(e);
            if (e.status === 401) {
                addToast("Hết phiên", "Token Google hết hạn. Vui lòng kết nối lại.", "error");
                setIsDriveConnected(false);
            } else {
                addToast('Lỗi đồng bộ', 'Có lỗi khi tải lên Drive.', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFetchFromDrive = async () => {
        if (!isDriveConnected) {
            addToast("Chưa kết nối", "Vui lòng kết nối lại Drive.", "error");
            return;
        }
        setIsProcessing(true);
        try {
            addToast('Đang tải', 'Đang lấy dữ liệu từ Drive...', 'info');
            const items = await driveService.fetchAllItems();
            
            if (items.length === 0) {
                addToast('Trống', 'Không tìm thấy dữ liệu backup trên Drive.', 'info');
            } else {
                // Save to local IndexedDB (Will be skipped if Cloud Only mode is checked in saveItem logic, but here we force sync usually)
                // Actually, if Cloud Only is ON, we don't need to save to local DB.
                if (!isCloudOnly) {
                    for (const item of items) {
                        await saveItem(item); 
                    }
                    addToast('Khôi phục xong', `Đã tải về ${items.length} mục từ Drive vào máy.`, 'success');
                } else {
                    addToast('Thông báo', 'Đang ở chế độ Cloud-Only. Dữ liệu đã có sẵn trên Cloud.', 'info');
                }
                setTimeout(() => window.dispatchEvent(new Event('library_updated')), 500);
            }
        } catch (e: any) {
            console.error(e);
            if (e.message?.includes('Token expired')) {
                addToast("Hết phiên", "Token Google hết hạn. Vui lòng kết nối lại.", "error");
                setIsDriveConnected(false);
            } else {
                addToast('Lỗi', 'Không thể tải dữ liệu từ Drive.', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDisconnectDrive = () => {
        driveService.clearConfig();
        setIsDriveConnected(false);
        setDriveClientId('');
        setDriveApiKey('');
        addToast('Đã ngắt kết nối', 'Thông tin Drive đã bị xóa.', 'info');
    }

    // --- EXISTING HANDLERS ---
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

    if (!isOpen) return null;

    const isAdmin = user.role === 'admin';
    const isTelegramLinked = !!user.telegramChatId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <UserCog size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Quản Lý Tài Khoản & Lưu Trữ</h3>
                            <p className="text-xs text-zinc-400">Cập nhật thông tin và kết nối Cloud</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                    
                    {/* GOOGLE DRIVE INTEGRATION */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <Cloud size={16} className={isDriveConnected ? "text-green-400" : "text-blue-400"}/> 
                            Google Drive Storage {isDriveConnected && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Connected</span>}
                        </h4>
                        
                        {!isDriveConnected ? (
                            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
                                <p className="text-xs text-blue-200">Kết nối Google Drive để tự động lưu trữ và đồng bộ dữ liệu giữa các thiết bị.</p>
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={driveClientId} 
                                        onChange={e => setDriveClientId(e.target.value)}
                                        placeholder="Google Client ID"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
                                    />
                                    <input 
                                        type="text" 
                                        value={driveApiKey} 
                                        onChange={e => setDriveApiKey(e.target.value)}
                                        placeholder="Google API Key"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleConnectDrive} 
                                    disabled={driveLoading}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                                >
                                    {driveLoading ? <Loader2 size={14} className="animate-spin"/> : <Link size={14}/>} Kết Nối Drive (Popup)
                                </button>
                            </div>
                        ) : (
                            <div className="bg-green-900/10 border border-green-500/20 p-4 rounded-xl space-y-3">
                                <div className="flex items-center gap-2 text-xs text-green-400 mb-2">
                                    <CheckCircle size={14}/> Tài khoản Google đã liên kết. Dữ liệu mới sẽ tự động được lưu.
                                </div>
                                
                                {/* CLOUD ONLY TOGGLE */}
                                <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50">
                                    <div>
                                        <div className="text-xs font-bold text-white mb-0.5">Chế độ chỉ dùng Cloud</div>
                                        <div className="text-[10px] text-zinc-400">Không lưu dữ liệu vào máy, tiết kiệm bộ nhớ.</div>
                                    </div>
                                    <button onClick={handleToggleCloudOnly} className={`transition-colors ${isCloudOnly ? 'text-green-400' : 'text-zinc-500'}`}>
                                        {isCloudOnly ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleSyncToDrive} disabled={isProcessing} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 flex flex-col items-center gap-1 transition-all group">
                                        <Upload size={18} className="text-zinc-400 group-hover:text-white"/>
                                        <span className="text-[10px] font-bold text-zinc-300">Đẩy tất cả lên Cloud</span>
                                    </button>
                                    <button onClick={handleFetchFromDrive} disabled={isProcessing} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 flex flex-col items-center gap-1 transition-all group">
                                        <Download size={18} className="text-zinc-400 group-hover:text-white"/>
                                        <span className="text-[10px] font-bold text-zinc-300">Tải về từ Cloud</span>
                                    </button>
                                </div>
                                <button onClick={handleDisconnectDrive} className="text-[10px] text-red-400 hover:text-red-300 underline w-full text-center mt-2">Ngắt kết nối</button>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* LOCAL BACKUP (LEGACY) */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <HardDrive size={16} className="text-zinc-400"/> Backup Cục bộ (File)
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={handleBackup} disabled={isProcessing} className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all">
                                <Save size={18} className="text-zinc-500" />
                                <span className="font-bold text-zinc-400 text-xs">Tải File .ultra8k</span>
                            </button>
                            <label className={`flex flex-col items-center justify-center gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload size={18} className="text-zinc-500" />
                                <span className="font-bold text-zinc-400 text-xs">Nhập File</span>
                                <input type="file" accept=".json,.ultra8k" className="hidden" onChange={handleRestore} />
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* ACCOUNT INFO */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <UserIcon size={16} className="text-purple-400"/> Thông tin cá nhân
                        </h4>
                        <div className="space-y-3">
                            <div className="relative">
                                <UserIcon size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"/>
                            </div>
                            <div className="relative">
                                {isTelegramLinked ? <Lock size={14} className="absolute left-3 top-3 text-emerald-500"/> : <MessageCircle size={14} className="absolute left-3 top-3 text-zinc-500"/>}
                                <input type="text" value={editTelegramId} onChange={e => setEditTelegramId(e.target.value)} placeholder="Telegram ID" className={`w-full bg-zinc-950 border rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none ${isTelegramLinked ? 'border-emerald-900/50 text-zinc-400 cursor-not-allowed' : 'border-zinc-800 focus:border-purple-500'}`} disabled={isTelegramLinked}/>
                            </div>
                            <button onClick={handleUpdateAccount} disabled={isProcessing} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                                {isProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Check size={14}/>} Cập nhật tài khoản
                            </button>
                        </div>
                    </div>

                    {/* MODEL CONFIGURATION (ADMIN ONLY) */}
                    {isAdmin && (
                        <>
                            <div className="h-px bg-white/5"></div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                    <Cpu size={16} className="text-indigo-400"/> Cấu hình AI (Admin)
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleSaveTier('free')} className={`p-3 rounded-xl border text-left ${modelTier === 'free' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
                                        <div className="font-bold text-xs text-white">Gemini 2.5 Pro</div>
                                    </button>
                                    <button onClick={() => handleSaveTier('paid')} className={`p-3 rounded-xl border text-left ${modelTier === 'paid' ? 'bg-purple-900/20 border-purple-500 ring-1 ring-purple-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
                                        <div className="font-bold text-xs text-white">Gemini 3.0 Pro</div>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
