
import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, CheckCircle, AlertCircle, HardDrive, RefreshCw, X, Cpu, Zap, Crown, UserCog, Save, Key, User as UserIcon, MessageCircle, Lock, Loader2, Database, Link, Check, ToggleLeft, ToggleRight, Server } from 'lucide-react';
import { exportDatabase, importDatabase, saveItem, getAllItems } from '../services/db'; 
import { updateUserCredentials, getAllUsers } from '../services/userService';
import { getBotInfo } from '../services/telegramService';
import { driveService } from '../services/googleDriveService'; 
import { supabaseService } from '../services/supabaseService'; // Import Supabase Service
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

    // Cloud States
    const [driveClientId, setDriveClientId] = useState('');
    const [driveApiKey, setDriveApiKey] = useState('');
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    const [driveLoading, setDriveLoading] = useState(false);
    
    // Supabase States
    const [supaUrl, setSupaUrl] = useState('');
    const [supaKey, setSupaKey] = useState('');
    const [isSupaConnected, setIsSupaConnected] = useState(false);
    const [supaLoading, setSupaLoading] = useState(false);

    const [isCloudOnly, setIsCloudOnly] = useState(false); 

    useEffect(() => {
        if (isOpen) {
            const savedTier = localStorage.getItem('ue_model_tier') as 'free' | 'paid';
            if (savedTier) setModelTier(savedTier);
            setEditUsername(user.username);
            setEditTelegramId(user.telegramChatId || '');
            setEditPassword('');
            setConfirmPassword('');
            
            setIsCloudOnly(localStorage.getItem('ue_cloud_only_mode') === 'true');
            
            getBotInfo().then(info => {
                if (info) setBotUsername(info.username);
            });

            // Load Drive Config
            const config = driveService.getConfig();
            if (config) {
                setDriveClientId(config.clientId);
                setDriveApiKey(config.apiKey);
                if (driveService.isAuthenticated()) setIsDriveConnected(true);
            }

            // Load Supabase Config
            const supaConfig = supabaseService.getConfig();
            if (supaConfig) {
                setSupaUrl(supaConfig.url);
                setSupaKey(supaConfig.key);
                if (supabaseService.isConfigured()) setIsSupaConnected(true);
            }
        }
    }, [isOpen, user]);

    // --- DRIVE HANDLERS ---
    const handleConnectDrive = async () => {
        if (!driveClientId || !driveApiKey) { addToast('Thiếu thông tin', 'Vui lòng nhập Client ID và API Key.', 'error'); return; }
        setDriveLoading(true);
        try {
            driveService.saveConfig(driveClientId, driveApiKey);
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
        } finally { setDriveLoading(false); }
    };

    // --- SUPABASE HANDLERS ---
    const handleConnectSupabase = async () => {
        if (!supaUrl || !supaKey) { addToast('Thiếu thông tin', 'Nhập URL và Key.', 'error'); return; }
        setSupaLoading(true);
        try {
            supabaseService.saveConfig(supaUrl, supaKey);
            const ok = await supabaseService.testConnection();
            if (ok) {
                setIsSupaConnected(true);
                addToast("Kết nối thành công", "Đã liên kết Supabase Database.", "success");
            } else {
                throw new Error("Kết nối thất bại. Kiểm tra URL/Key.");
            }
        } catch (e: any) {
            addToast("Lỗi", e.message, "error");
            setIsSupaConnected(false);
        } finally {
            setSupaLoading(false);
        }
    }

    const handleToggleCloudOnly = () => {
        const newValue = !isCloudOnly;
        setIsCloudOnly(newValue);
        localStorage.setItem('ue_cloud_only_mode', String(newValue));
        addToast(newValue ? 'Chế độ Cloud-Only' : 'Chế độ Lưu trữ Kép', newValue ? 'Dữ liệu chỉ lưu trên Cloud. Máy nhẹ hơn.' : 'Dữ liệu lưu cả 2 nơi (An toàn).', 'info');
        window.dispatchEvent(new Event('library_updated'));
    };

    const handleDisconnectDrive = () => { driveService.clearConfig(); setIsDriveConnected(false); addToast('Đã ngắt kết nối', 'Drive Disconnected.', 'info'); }
    const handleDisconnectSupabase = () => { supabaseService.clearConfig(); setIsSupaConnected(false); addToast('Đã ngắt kết nối', 'Supabase Disconnected.', 'info'); }

    // --- GENERIC SYNC ---
    const handleSyncUp = async () => {
        if (!isDriveConnected && !isSupaConnected) { addToast("Chưa kết nối", "Vui lòng kết nối ít nhất 1 Cloud.", "error"); return; }
        setIsProcessing(true);
        try {
            const allItems = await getAllItems();
            addToast('Đang đồng bộ', `Đang tải ${allItems.length} mục lên Cloud...`, 'info');
            const promises = [];
            
            const chunkSize = 5;
            for (let i = 0; i < allItems.length; i += chunkSize) {
                const chunk = allItems.slice(i, i + chunkSize);
                if (isDriveConnected) promises.push(Promise.all(chunk.map(item => driveService.uploadItem(item))));
                if (isSupaConnected) promises.push(Promise.all(chunk.map(item => supabaseService.uploadItem(item))));
                await Promise.all(promises); 
            }
            addToast('Hoàn tất', 'Đã đồng bộ lên tất cả Cloud đang kết nối.', 'success');
        } catch (e) { addToast('Lỗi', 'Đồng bộ thất bại.', 'error'); } finally { setIsProcessing(false); }
    };

    // ... (handleSaveTier, handleUpdateAccount, handleBackup, handleRestore remain same)
    const handleSaveTier = (tier: 'free' | 'paid') => { setModelTier(tier); localStorage.setItem('ue_model_tier', tier); addToast('Cập nhật thành công', `Đã chuyển sang gói: ${tier}`, 'success'); };
    const handleUpdateAccount = async () => { if (editPassword && editPassword !== confirmPassword) { addToast('Lỗi', 'Mật khẩu không khớp.', 'error'); return; } setIsProcessing(true); try { const res = await updateUserCredentials(user.username, editUsername, editPassword || undefined, user.telegramChatId ? undefined : editTelegramId); if (res.success) { addToast('Thành công', 'Thông tin đã cập nhật.', 'success'); } else { addToast('Lỗi', res.message, 'error'); } } finally { setIsProcessing(false); } };
    const handleBackup = async () => { setIsProcessing(true); try { const jsonStr = await exportDatabase(); const blob = new Blob([jsonStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `UltraEdit-Backup-${Date.now()}.ultra8k`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); addToast('Backup xong', 'File đã tải xuống.', 'success'); } catch (e) { addToast('Lỗi', 'Backup thất bại.', 'error'); } finally { setIsProcessing(false); } };
    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsProcessing(true); const reader = new FileReader(); reader.onload = async (ev) => { try { await importDatabase(ev.target?.result as string); addToast('Khôi phục xong', 'Đã nhập dữ liệu.', 'success'); setTimeout(() => window.location.reload(), 1500); } catch (e) { addToast('Lỗi', 'File lỗi.', 'error'); } finally { setIsProcessing(false); } }; reader.readAsText(file); };

    if (!isOpen) return null;

    const isAdmin = user.role === 'admin';
    const isTelegramLinked = !!user.telegramChatId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-3"><div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><UserCog size={20} /></div><div><h3 className="text-lg font-bold text-white">Cài Đặt & Lưu Trữ</h3><p className="text-xs text-zinc-400">Kết nối Cloud để bảo vệ dữ liệu</p></div></div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                    
                    {/* CLOUD STORAGE SECTION */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider"><Cloud size={16} className="text-blue-400"/> Cloud Storage</h4>
                            <div className="flex items-center gap-2"><span className="text-[10px] text-zinc-400">{isCloudOnly ? "Cloud Only" : "Hybrid Mode"}</span><button onClick={handleToggleCloudOnly} className={`transition-colors ${isCloudOnly ? 'text-green-400' : 'text-zinc-600'}`}>{isCloudOnly ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}</button></div>
                        </div>

                        {/* 1. SUPABASE (Recommended) */}
                        <div className={`border rounded-xl p-4 transition-all ${isSupaConnected ? 'bg-green-900/10 border-green-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2"><Server size={18} className={isSupaConnected ? "text-green-400" : "text-zinc-500"}/><span className="font-bold text-sm text-white">Supabase (Database + Storage)</span>{isSupaConnected && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>}</div>
                                {isSupaConnected && <button onClick={handleDisconnectSupabase} className="text-[10px] text-red-400 hover:underline">Ngắt kết nối</button>}
                            </div>
                            {!isSupaConnected ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input type="text" value={supaUrl} onChange={e => setSupaUrl(e.target.value)} placeholder="Project URL (https://...supabase.co)" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"/>
                                        <input type="password" value={supaKey} onChange={e => setSupaKey(e.target.value)} placeholder="Anon / Public Key" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"/>
                                    </div>
                                    <button onClick={handleConnectSupabase} disabled={supaLoading} className="w-full py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all">{supaLoading ? <Loader2 size={14} className="animate-spin"/> : <Link size={14}/>} Kết Nối Supabase</button>
                                    <p className="text-[10px] text-zinc-500 italic mt-1">Khuyên dùng: Miễn phí, Nhanh, Không cần Login lại.</p>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-400">Đã kết nối cơ sở dữ liệu Supabase. Dữ liệu của bạn được lưu trữ an toàn.</p>
                            )}
                        </div>

                        {/* 2. GOOGLE DRIVE (Alternative) */}
                        <div className={`border rounded-xl p-4 transition-all ${isDriveConnected ? 'bg-blue-900/10 border-blue-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2"><HardDrive size={18} className={isDriveConnected ? "text-blue-400" : "text-zinc-500"}/><span className="font-bold text-sm text-white">Google Drive</span>{isDriveConnected && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Active</span>}</div>
                                {isDriveConnected && <button onClick={handleDisconnectDrive} className="text-[10px] text-red-400 hover:underline">Ngắt kết nối</button>}
                            </div>
                            {!isDriveConnected ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input type="text" value={driveClientId} onChange={e => setDriveClientId(e.target.value)} placeholder="Client ID" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"/>
                                        <input type="password" value={driveApiKey} onChange={e => setDriveApiKey(e.target.value)} placeholder="API Key" className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"/>
                                    </div>
                                    <button onClick={handleConnectDrive} disabled={driveLoading} className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all">{driveLoading ? <Loader2 size={14} className="animate-spin"/> : <Link size={14}/>} Kết Nối Drive</button>
                                </div>
                            ) : <p className="text-xs text-zinc-400">Đã kết nối Google Drive. Token có thể hết hạn sau 1 giờ.</p>}
                        </div>

                        {(isDriveConnected || isSupaConnected) && (
                            <button onClick={handleSyncUp} disabled={isProcessing} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-zinc-700 transition-all shadow-lg">{isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Đồng Bộ Ngay (Push to Cloud)</button>
                        )}
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* MANUAL BACKUP */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider"><Database size={16} className="text-zinc-400"/> Backup Thủ Công</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={handleBackup} disabled={isProcessing} className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all"><Save size={18} className="text-zinc-500" /><span className="font-bold text-zinc-400 text-xs">Tải File .ultra8k</span></button>
                            <label className={`flex flex-col items-center justify-center gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}><Upload size={18} className="text-zinc-500" /><span className="font-bold text-zinc-400 text-xs">Nhập File</span><input type="file" accept=".json,.ultra8k" className="hidden" onChange={handleRestore} /></label>
                        </div>
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* ACCOUNT */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider"><UserIcon size={16} className="text-purple-400"/> Tài khoản</h4>
                        <div className="space-y-3">
                            <div className="relative"><UserIcon size={14} className="absolute left-3 top-3 text-zinc-500"/><input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"/></div>
                            <div className="relative">{isTelegramLinked ? <Lock size={14} className="absolute left-3 top-3 text-emerald-500"/> : <MessageCircle size={14} className="absolute left-3 top-3 text-zinc-500"/><input type="text" value={editTelegramId} onChange={e => setEditTelegramId(e.target.value)} placeholder="Telegram ID" className={`w-full bg-zinc-950 border rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none ${isTelegramLinked ? 'border-emerald-900/50 text-zinc-400 cursor-not-allowed' : 'border-zinc-800 focus:border-purple-500'}`} disabled={isTelegramLinked}/>}</div>
                            <button onClick={handleUpdateAccount} disabled={isProcessing} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50">{isProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Check size={14}/>} Cập nhật tài khoản</button>
                        </div>
                    </div>

                    {isAdmin && (
                        <>
                            <div className="h-px bg-white/5"></div>
                            <div className="space-y-3"><h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider"><Cpu size={16} className="text-indigo-400"/> AI Model (Admin)</h4><div className="grid grid-cols-2 gap-3"><button onClick={() => handleSaveTier('free')} className={`p-3 rounded-xl border text-left ${modelTier === 'free' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500/50' : 'bg-zinc-950 border-zinc-800'}`}><div className="font-bold text-xs text-white">Gemini 2.5 Pro</div></button><button onClick={() => handleSaveTier('paid')} className={`p-3 rounded-xl border text-left ${modelTier === 'paid' ? 'bg-purple-900/20 border-purple-500 ring-1 ring-purple-500/50' : 'bg-zinc-950 border-zinc-800'}`}><div className="font-bold text-xs text-white">Gemini 3.0 Pro</div></button></div></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
