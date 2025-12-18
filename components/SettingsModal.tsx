
import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, HardDrive, RefreshCw, X, UserCog, Save, User as UserIcon, MessageCircle, Lock, Loader2, ShieldCheck, Info, LogIn, CloudDownload, AlertTriangle, Copy, Check, ExternalLink, RotateCcw, ShieldAlert, Cpu, Sparkles, Key, CreditCard, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { exportDatabase, importDatabase, saveItem, saveCharacter } from '../services/db';
import { driveService } from '../services/googleDriveService';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    user: User;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, addToast, user }) => {
    const [activeTab, setActiveTab] = useState<'ai' | 'cloud' | 'storage'>('ai');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showFixGuide, setShowFixGuide] = useState(false);
    const [show403Guide, setShow403Guide] = useState(false);
    
    // Google Drive States
    const [driveClientId, setDriveClientId] = useState('');
    const [driveApiKey, setDriveApiKey] = useState('');
    const [isDriveLinked, setIsDriveLinked] = useState(false);

    // AI API States
    const [hasSelectedAiKey, setHasSelectedAiKey] = useState<boolean>(false);

    // Improved Sandbox Detection for Domain
    const currentOrigin = window.location.origin;
    const isActuallyOnDomain = currentOrigin.includes('ultraedit8k.shop') || currentOrigin.includes('localhost');
    const isSandboxed = !isActuallyOnDomain && (window.origin === 'null' || window.location.protocol === 'blob:' || window.location.ancestorOrigins?.length > 0);

    useEffect(() => {
        if (isOpen) {
            loadDriveState();
            checkAiKeyStatus();
        }
        
        const handleDriveLinked = () => {
            setIsDriveLinked(true);
            setIsProcessing(false);
            setStatusMessage('Đã kết nối Cloud thành công!');
            addToast('Thành công', 'Google Drive đã được liên kết.', 'success');
        };
        
        window.addEventListener('drive_linked', handleDriveLinked);
        return () => window.removeEventListener('drive_linked', handleDriveLinked);
    }, [isOpen]);

    const checkAiKeyStatus = async () => {
        if ((window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setHasSelectedAiKey(hasKey);
        }
    };

    const handleSelectAiKey = async () => {
        if ((window as any).aistudio) {
            try {
                await (window as any).aistudio.openSelectKey();
                setHasSelectedAiKey(true);
                addToast("Thông báo", "Vui lòng chọn Key từ dự án có bật thanh toán (Billing).", "info");
            } catch (e) {
                addToast("Lỗi", "Không thể mở hộp thoại chọn Key.", "error");
            }
        }
    };

    const loadDriveState = () => {
        const driveConfigStr = localStorage.getItem('ue_drive_config');
        if (driveConfigStr) {
            try {
                const parsed = JSON.parse(driveConfigStr);
                setDriveClientId(parsed.clientId || '');
                setDriveApiKey(parsed.apiKey || '');
                setIsDriveLinked(!!parsed.accessToken);
            } catch (e) {}
        }
    };

    const handleLinkDrive = async () => {
        if (isSandboxed) {
            addToast('Môi trường bị chặn', 'Google không cho phép đăng nhập OAuth trong cửa sổ Preview (Sandbox).', 'error');
            return;
        }

        const cleanId = driveClientId.trim();
        const cleanKey = driveApiKey.trim();

        if (!cleanId || !cleanKey) {
            addToast('Thiếu thông tin', 'Vui lòng điền Client ID và API Key từ Google Cloud Console.', 'warning');
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Đang kết nối thư viện Google...');
        try {
            // Cập nhật config trước khi auth
            localStorage.setItem('ue_drive_config', JSON.stringify({ clientId: cleanId, apiKey: cleanKey }));
            await driveService.authenticate();
        } catch (e: any) {
            setIsProcessing(false);
            setStatusMessage('Lỗi: ' + e.message);
            addToast('Thất bại', e.message, 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <UserCog size={20} className="text-indigo-400" />
                        <h3 className="text-lg font-bold text-white">Cài đặt Studio</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="flex border-b border-white/5 bg-zinc-900/30 px-6">
                    <button onClick={() => setActiveTab('ai')} className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'ai' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500'}`}>Hệ thống AI</button>
                    <button onClick={() => setActiveTab('cloud')} className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'cloud' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500'}`}>Đám mây (Cloud)</button>
                    <button onClick={() => setActiveTab('storage')} className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'storage' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500'}`}>Bộ nhớ máy</button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-950/20">
                    
                    {activeTab === 'ai' && (
                        <div className="space-y-6">
                            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`p-3 rounded-xl ${hasSelectedAiKey ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                        <Cpu size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">Quản lý Google API Key</h4>
                                        <p className="text-xs text-zinc-500">Cấu hình cho Gemini 3.0 & Imagen 3</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-zinc-400">Trạng thái xác thực</span>
                                            {hasSelectedAiKey ? (
                                                <span className="text-sm font-bold text-green-400 flex items-center gap-1.5 mt-1"><ShieldCheck size={16}/> Sẵn sàng hoạt động</span>
                                            ) : (
                                                <span className="text-sm font-bold text-orange-400 flex items-center gap-1.5 mt-1"><AlertTriangle size={16}/> Chưa chọn API Key</span>
                                            )}
                                        </div>
                                        <button onClick={handleSelectAiKey} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg">
                                            {hasSelectedAiKey ? "Thay đổi / Đổi Project" : "Chọn API Key ngay"}
                                        </button>
                                    </div>
                                    <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl space-y-3">
                                        <div className="flex gap-2">
                                            <Sparkles size={16} className="text-indigo-400 shrink-0"/>
                                            <p className="text-xs text-indigo-200 leading-relaxed">Để sử dụng các tính năng cao cấp (Tạo ảnh 4K/8K, Ghép ảnh Studio), bạn cần chọn một API Key từ một <b>Dự án Google Cloud đã kích hoạt thanh toán (Paid Project)</b>.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'cloud' && (
                        <div className="space-y-6">
                            {/* Hướng dẫn sửa lỗi 403 Nổi bật */}
                            <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 space-y-3">
                                <div 
                                    className="flex justify-between items-center cursor-pointer"
                                    onClick={() => setShow403Guide(!show403Guide)}
                                >
                                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase">
                                        <AlertCircle size={16}/> Fix Lỗi 403: access_denied
                                    </div>
                                    {show403Guide ? <ChevronUp size={16} className="text-red-400"/> : <ChevronDown size={16} className="text-red-400"/>}
                                </div>
                                
                                {show403Guide && (
                                    <div className="text-[11px] text-zinc-300 space-y-3 pt-2 border-t border-red-500/10 animate-in fade-in">
                                        <p className="font-bold text-red-300">Nguyên nhân: Ứng dụng Google Cloud của bạn đang ở chế độ "Testing" nên chặn người lạ.</p>
                                        <div className="space-y-2">
                                            <p><b>Bước 1:</b> Truy cập <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" className="text-blue-400 underline inline-flex items-center gap-0.5">OAuth Consent Screen <ExternalLink size={10}/></a></p>
                                            <p><b>Bước 2:</b> Kéo xuống mục <b>"Test users"</b> -> Bấm <b>"+ ADD USERS"</b>.</p>
                                            <p><b>Bước 3:</b> Nhập chính xác địa chỉ Gmail bạn dùng để đăng nhập -> Bấm <b>SAVE</b>.</p>
                                            <p className="text-zinc-500 italic">Hoặc bấm nút <b>"PUBLISH APP"</b> ở trên cùng để cho phép mọi Gmail (Lưu ý: Google sẽ báo "App unverified", bạn chỉ cần bấm Advanced -> Go to ... là được).</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isSandboxed && (
                                <div className="bg-orange-900/20 border border-orange-500/50 rounded-xl p-4 flex gap-3 items-start">
                                    <ShieldAlert size={24} className="text-orange-500 shrink-0" />
                                    <div className="text-xs text-orange-200 leading-relaxed">
                                        <p className="font-bold mb-1 text-orange-400">Cảnh báo: Đang chạy Sandbox!</p>
                                        Google không cho phép mở cửa sổ đăng nhập bên trong iframe. Vui lòng truy cập trực tiếp bằng trình duyệt.
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                                    <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowFixGuide(!showFixGuide)}>
                                        <h4 className="text-xs font-bold text-blue-400 uppercase flex items-center gap-2"><Info size={14}/> Cách khắc phục lỗi 400 (Redirect URI)</h4>
                                        {showFixGuide ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    </div>
                                    {showFixGuide && (
                                        <div className="mt-3 text-[10px] text-zinc-400 space-y-2 border-t border-blue-500/10 pt-2 animate-in fade-in">
                                            <p>Nếu gặp lỗi 400, kiểm tra cấu hình trong <b>Google Cloud Console</b>:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li>Vào mục <b>APIs & Services > Credentials</b>.</li>
                                                <li>Mở <b>OAuth 2.0 Client ID</b> đang sử dụng.</li>
                                                <li>Mục <b>Authorized JavaScript origins</b>, thêm:<br/><code>https://www.ultraedit8k.shop</code></li>
                                                <li>Mục <b>Authorized redirect URIs</b>, thêm:<br/><code>https://www.ultraedit8k.shop</code></li>
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Google Client ID</label>
                                    <input type="text" value={driveClientId} onChange={e => setDriveClientId(e.target.value)} placeholder="0000-xxxx.apps.googleusercontent.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 outline-none font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Google API Key</label>
                                    <input type="password" value={driveApiKey} onChange={e => setDriveApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 outline-none font-mono" />
                                </div>
                                <button onClick={handleLinkDrive} disabled={isProcessing} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:bg-zinc-800 disabled:text-zinc-600">
                                    {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <LogIn size={16}/>}
                                    {isDriveLinked ? 'Cập nhật liên kết Drive' : 'Kết nối Google Drive'}
                                </button>
                                {statusMessage && <p className="text-[10px] text-center text-zinc-500 italic">{statusMessage}</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'storage' && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={async () => {
                                const data = await exportDatabase();
                                const blob = new Blob([data], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
                                a.click();
                            }} className="flex flex-col items-center justify-center gap-3 p-6 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-green-500/50 transition-all">
                                <Download size={24} className="text-zinc-500" />
                                <span className="font-bold text-zinc-300 text-xs">Xuất file Backup</span>
                            </button>
                            <label className="flex flex-col items-center justify-center gap-3 p-6 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-blue-500/50 transition-all cursor-pointer">
                                <Upload size={24} className="text-zinc-500" />
                                <span className="font-bold text-zinc-300 text-xs">Nhập từ file</span>
                                <input type="file" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = async (ev) => {
                                        try {
                                            await importDatabase(ev.target?.result as string);
                                            addToast('Thành công', 'Dữ liệu đã được nhập.', 'success');
                                            setTimeout(() => window.location.reload(), 500);
                                        } catch { addToast('Lỗi', 'File không hợp lệ.', 'error'); }
                                    };
                                    reader.readAsText(file);
                                }} />
                            </label>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/5 bg-zinc-900/50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200">Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
