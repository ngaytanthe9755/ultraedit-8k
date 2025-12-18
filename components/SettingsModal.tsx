
import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, CheckCircle, AlertCircle, HardDrive, RefreshCw, X, Cpu, Zap, Crown, UserCog, Save, Key, User as UserIcon, MessageCircle, Lock, Loader2, ExternalLink, ShieldCheck, Database, Info, LogIn, CloudDownload } from 'lucide-react';
import { exportDatabase, importDatabase, saveItem, saveCharacter } from '../services/db';
import { updateUserCredentials } from '../services/userService';
import { getBotInfo } from '../services/telegramService';
import { driveService } from '../services/googleDriveService';
import { User } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
    user: User;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, addToast, user }) => {
    const [activeTab, setActiveTab] = useState<'account' | 'storage' | 'cloud'>('account');
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
    const [isDriveLinked, setIsDriveLinked] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const savedTier = localStorage.getItem('ue_model_tier') as 'free' | 'paid';
            if (savedTier) setModelTier(savedTier);
            setEditUsername(user.username);
            setEditTelegramId(user.telegramChatId || '');
            
            // Load Drive Config
            const driveConfig = localStorage.getItem('ue_drive_config');
            if (driveConfig) {
                const parsed = JSON.parse(driveConfig);
                setDriveClientId(parsed.clientId || '');
                setDriveApiKey(parsed.apiKey || '');
                setIsDriveLinked(!!parsed.accessToken);
            }

            getBotInfo().then(info => { if (info) setBotUsername(info.username); });
        }
    }, [isOpen, user]);

    const handleSaveTier = (tier: 'free' | 'paid') => {
        setModelTier(tier);
        localStorage.setItem('ue_model_tier', tier);
        addToast('Cập nhật thành công', `Mô hình: ${tier === 'free' ? 'Gemini 2.5 Pro' : 'Gemini 3.0 Pro'}`, 'success');
    };

    const handleUpdateAccount = async () => {
        if (editPassword && editPassword !== confirmPassword) {
            addToast('Lỗi', 'Mật khẩu không khớp.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const res = await updateUserCredentials(user.username, editUsername, editPassword || undefined, user.telegramChatId ? undefined : editTelegramId);
            if (res.success) {
                addToast('Thành công', 'Đã cập nhật thông tin.', 'success');
            } else {
                addToast('Lỗi', res.message, 'error');
            }
        } finally { setIsProcessing(false); }
    };

    const handleSaveDriveConfig = () => {
        localStorage.setItem('ue_drive_config', JSON.stringify({ clientId: driveClientId, apiKey: driveApiKey }));
        addToast('Đã lưu cấu hình', 'Bạn cần bấm "Liên kết" để xác thực quyền truy cập.', 'info');
        driveService.initialize();
    };

    const handleLinkDrive = async () => {
        if (!driveClientId || !driveApiKey) {
            addToast('Thiếu thông tin', 'Vui lòng nhập Client ID và API Key trước.', 'warning');
            return;
        }
        setIsProcessing(true);
        try {
            await driveService.authenticate();
            setIsDriveLinked(true);
            addToast('Thành công', 'Đã liên kết Google Drive.', 'success');
        } catch (e) {
            addToast('Lỗi liên kết', 'Vui lòng kiểm tra lại thông tin API.', 'error');
        } finally { setIsProcessing(false); }
    };

    // --- RETRIEVAL: EXCHANGE INFO FROM CLOUD ---
    const handleSyncFromCloud = async () => {
        if (!isDriveLinked) {
            addToast('Yêu cầu liên kết', 'Vui lòng liên kết Google Drive trước.', 'warning');
            return;
        }
        setIsProcessing(true);
        try {
            addToast('Đang quét Cloud', 'Hệ thống đang truy xuất dữ liệu từ Drive...', 'info');
            const items = await driveService.fetchAllFromCloud();
            
            if (items.length === 0) {
                addToast('Trống', 'Không tìm thấy dữ liệu cũ trên Drive.', 'info');
                return;
            }

            let count = 0;
            for (const item of items) {
                if (item.type === 'character' || item.type === 'story_character') {
                    // Restore character
                    await saveCharacter({
                        id: item.id.replace('char_', ''),
                        name: item.prompt || item.name,
                        base64Data: item.base64Data.split(',')[1] || item.base64Data,
                        createdAt: item.createdAt
                    });
                    count++;
                }
                // Standard items (Scripts, images, stories)
                await saveItem(item);
                count++;
            }
            
            addToast('Đồng bộ hoàn tất', `Đã khôi phục ${count} mục từ Drive để bạn tiếp tục hoạt động.`, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            addToast('Lỗi đồng bộ', 'Không thể lấy dữ liệu từ Drive.', 'error');
        } finally { setIsProcessing(false); }
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
            addToast('Thành công', 'File backup đã được tải xuống.', 'success');
        } finally { setIsProcessing(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <UserCog size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Thiết lập hệ thống</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 bg-zinc-900/30 px-6 shrink-0">
                    {[
                        { id: 'account', label: 'Tài khoản', icon: UserIcon },
                        { id: 'cloud', label: 'Lưu trữ & Trao đổi', icon: Cloud },
                        { id: 'storage', label: 'Bộ nhớ nội bộ', icon: HardDrive }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <tab.icon size={14}/> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-950/20">
                    
                    {activeTab === 'account' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 font-bold mb-1 block">Tên hiển thị</label>
                                    <div className="relative">
                                        <UserIcon size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                        <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:border-blue-500 outline-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 font-bold mb-1 block">Telegram Chat ID</label>
                                    <div className="relative">
                                        <MessageCircle size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                        <input type="text" value={editTelegramId} readOnly className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-zinc-400 cursor-not-allowed" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-zinc-500 font-bold mb-1 block">Mật khẩu mới</label>
                                        <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-500"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 font-bold mb-1 block">Xác nhận</label>
                                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-500"/>
                                    </div>
                                </div>
                                <button onClick={handleUpdateAccount} disabled={isProcessing} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                                    {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Lưu thay đổi
                                </button>
                            </div>

                            {user.role === 'admin' && (
                                <div className="pt-6 border-t border-white/5 space-y-4">
                                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Cấu hình mô hình AI (Admin)</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => handleSaveTier('free')} className={`p-4 rounded-xl border text-left transition-all ${modelTier === 'free' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-zinc-950 border-zinc-800'}`}>
                                            <div className="font-bold text-sm text-white">Gemini 2.5 Pro</div>
                                            <div className="text-[10px] text-zinc-500">Miễn phí / Ổn định</div>
                                        </button>
                                        <button onClick={() => handleSaveTier('paid')} className={`p-4 rounded-xl border text-left transition-all ${modelTier === 'paid' ? 'bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-purple-500 ring-1 ring-purple-500' : 'bg-zinc-950 border-zinc-800'}`}>
                                            <div className="font-bold text-sm text-white">Gemini 3.0 Pro</div>
                                            <div className="text-[10px] text-zinc-500">Chất lượng cao / Đa phương thức</div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'cloud' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 items-start">
                                <CloudDownload size={24} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-200 leading-relaxed">
                                    <p className="font-bold mb-1">Trao đổi dữ liệu đám mây</p>
                                    Khi liên kết Drive, hệ thống không chỉ lưu mà còn có thể <strong>truy xuất (Download)</strong> các kịch bản và nhân vật cũ để bạn tiếp tục hoạt động trên bất kỳ thiết bị nào.
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 font-bold mb-1 block">Google Client ID</label>
                                    <input type="text" value={driveClientId} onChange={e => setDriveClientId(e.target.value)} placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none font-mono focus:border-blue-500"/>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 font-bold mb-1 block">API Key</label>
                                    <input type="password" value={driveApiKey} onChange={e => setDriveApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none font-mono focus:border-blue-500"/>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-3">
                                        <button onClick={handleSaveDriveConfig} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-white/5 transition-all">
                                            <Save size={16}/> Lưu cấu hình
                                        </button>
                                        <button onClick={handleLinkDrive} disabled={isProcessing} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${isDriveLinked ? 'bg-green-600/20 text-green-400 border border-green-500/50' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                                            {isProcessing ? <Loader2 className="animate-spin" size={16}/> : isDriveLinked ? <ShieldCheck size={16}/> : <LogIn size={16}/>}
                                            {isDriveLinked ? 'Đã liên kết' : 'Kết nối Drive'}
                                        </button>
                                    </div>
                                    
                                    {isDriveLinked && (
                                        <button onClick={handleSyncFromCloud} disabled={isProcessing} className="w-full py-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-all">
                                            {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                                            Đồng bộ dữ liệu từ Drive về Máy này
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/5">
                                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Info size={14} className="text-blue-400"/> Cách lấy Client ID và API Key
                                </h4>
                                <div className="space-y-4 text-xs text-zinc-400 leading-relaxed bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 shadow-inner">
                                    <div className="space-y-3">
                                        <p className="font-bold text-white">Bước 1: Tạo Project</p>
                                        <p>Truy cập <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-400 hover:underline">Google Cloud Console</a>. Tạo Project mới tên "UltraEdit".</p>
                                        
                                        <p className="font-bold text-white">Bước 2: Bật Drive API</p>
                                        <p>Vào <strong>Library</strong>, tìm "Google Drive API" và bấm <strong>Enable</strong>.</p>
                                        
                                        <p className="font-bold text-white">Bước 3: Cấu hình OAuth (Quan trọng nhất)</p>
                                        <p>Vào <strong>OAuth consent screen</strong>, chọn User Type: External. Điền tên App. Tại mục Scopes, bấm "Add scope" và nhập <code>https://www.googleapis.com/auth/drive.file</code> (Chỉ cho phép App đọc tệp nó tạo ra).</p>
                                        
                                        <p className="font-bold text-white">Bước 4: Tạo Credentials</p>
                                        <ul className="list-disc pl-4 space-y-2">
                                            <li>Bấm "Create Credentials" > "API Key". Sao chép dán vào ô API Key.</li>
                                            <li>Bấm "Create Credentials" > "OAuth client ID" > "Web application".</li>
                                            <li>Tại <strong>Authorized JavaScript origins</strong>: Thêm <code>https://localhost:3000</code> hoặc domain web của bạn.</li>
                                            <li>Bấm Create và lấy Client ID.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'storage' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex gap-3 items-start">
                                <AlertCircle size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    Dữ liệu local (IndexedDB) cực kỳ nhanh nhưng có thể bị xóa bởi trình duyệt nếu máy hết dung lượng. Hãy dùng Cloud để đảm bảo an toàn.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={handleBackup} disabled={isProcessing} className="flex flex-col items-center justify-center gap-3 p-6 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-green-500/50 hover:bg-zinc-900 transition-all group">
                                    <Download size={24} className="text-zinc-500 group-hover:text-green-500" />
                                    <span className="font-bold text-zinc-300 text-xs text-center">Sao lưu (.ultra8k)</span>
                                </button>

                                <label className="group flex flex-col items-center justify-center gap-3 p-6 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-blue-500/50 hover:bg-zinc-900 transition-all cursor-pointer">
                                    <Upload size={24} className="text-zinc-500 group-hover:text-blue-500" />
                                    <span className="font-bold text-zinc-300 text-xs text-center">Nhập từ File</span>
                                    <input type="file" accept=".json,.ultra8k" className="hidden" onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = async (ev) => {
                                            try {
                                                const res = await importDatabase(ev.target?.result as string);
                                                addToast('Thành công', `Đã nhập ${res.itemsCount} mục.`, 'success');
                                                setTimeout(() => window.location.reload(), 1000);
                                            } catch { addToast('Lỗi', 'File không hợp lệ.', 'error'); }
                                        };
                                        reader.readAsText(file);
                                    }} />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-zinc-900/50 shrink-0 flex justify-between items-center">
                    <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                        <Lock size={10}/> Mã hóa end-to-end (Client-side)
                    </div>
                    <button onClick={onClose} className="px-6 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors">Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
