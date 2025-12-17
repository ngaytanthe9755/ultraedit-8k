
import React, { useState, useEffect } from 'react';
import { RegisteredUser, ModuleType, ModelTier } from '../types';
import { getAllUsers, updateUserPermissions, verifyUser, addCredits, syncUsersFromCloud, deleteUser, adminUpdateUserInfo, forceSyncUp, upgradeUserTier } from '../services/userService';
import { Shield, User, ToggleLeft, ToggleRight, Search, BadgeCheck, Coins, RefreshCw, Trash2, Loader2, Wrench, Send, Edit2, X, Mail, Globe, Zap, Cpu, Sparkles, Star, Lock, Unlock, ShieldAlert, CheckCircle2, ChevronRight, LayoutGrid, Eye, AlertTriangle } from 'lucide-react';

interface AdminPanelProps {
    currentUser: RegisteredUser | null;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const MODULE_NAMES: Record<string, string> = {
    [ModuleType.NEW_CREATION]: "Vision Generator (Tạo Ảnh)",
    [ModuleType.CHARACTER_CREATOR]: "Character Lab (Nhân Vật)",
    [ModuleType.STORY_CREATOR]: "Story Architect (Cốt Truyện)",
    [ModuleType.VEO_IDEAS]: "Veo Director (Kịch Bản)",
    [ModuleType.IMAGE_TO_VIDEO]: "Veo Motion (Video)",
    [ModuleType.STUDIO]: "Composition Studio (Ghép Ảnh)",
    [ModuleType.THUMBNAIL]: "Viral Thumbnails",
    [ModuleType.POSTER]: "Pro Posters",
    [ModuleType.CHANNEL_BUILDER]: "Channel Architect",
    [ModuleType.LIBRARY]: "Thư Viện"
};

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, addToast }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'system'>('users');
    const [users, setUsers] = useState<RegisteredUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [creditAmount, setCreditAmount] = useState<number>(10);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);
    
    useEffect(() => { refreshUsers(); }, []);

    const refreshUsers = async () => {
        setIsSyncing(true);
        const allUsers = await syncUsersFromCloud();
        const sorted = allUsers.sort((a, b) => a.username === 'admin' ? -1 : (b.createdAt || 0) - (a.createdAt || 0));
        setUsers(sorted);
        if (selectedUser) {
            const updated = sorted.find(u => u.username === selectedUser.username);
            if (updated) setSelectedUser(updated);
        }
        setIsSyncing(false);
    };

    const togglePermission = async (moduleId: string) => {
        if (!selectedUser || isUpdatingUser) return;
        setIsUpdatingUser(true);
        const currentPerms = { ...(selectedUser.permissions || {}) };
        currentPerms[moduleId] = currentPerms[moduleId] === false ? true : false;
        
        try {
            await updateUserPermissions(selectedUser.username, currentPerms);
            addToast("Thành công", `Đã cập nhật quyền truy cập ${MODULE_NAMES[moduleId]}`, "success");
            // Optimistic UI update for selected user
            setSelectedUser({ ...selectedUser, permissions: currentPerms });
            refreshUsers();
        } finally { setIsUpdatingUser(false); }
    };

    const toggleVerification = async () => {
        if (!selectedUser || isUpdatingUser) return;
        setIsUpdatingUser(true);
        try {
            await verifyUser(selectedUser.username, !selectedUser.isVerified);
            addToast("Thành công", "Đã cập nhật trạng thái xác minh.", "success");
            refreshUsers();
        } finally { setIsUpdatingUser(false); }
    };

    const handleAddCredits = async () => {
        if (!selectedUser || isUpdatingUser) return;
        setIsUpdatingUser(true);
        try {
            await addCredits(selectedUser.username, creditAmount);
            addToast("Thành công", "Đã cập nhật tín dụng.", "success");
            refreshUsers();
        } finally { setIsUpdatingUser(false); }
    };

    const handleUpdateTier = async (tier: ModelTier) => {
        if (!selectedUser || isUpdatingUser) return;
        setIsUpdatingUser(true);
        try {
            await upgradeUserTier(selectedUser.username, tier);
            addToast("Thành công", `Đã nâng cấp lên ${tier}`, "success");
            refreshUsers();
        } finally { setIsUpdatingUser(false); }
    };

    const handleDeleteUser = async (username: string) => {
        if (confirm(`Xóa vĩnh viễn user @${username}?`)) {
            setIsUpdatingUser(true);
            try {
                await deleteUser(username);
                addToast("Đã xóa", "Người dùng đã bị loại bỏ khỏi hệ thống.", "success");
                setSelectedUser(null);
                refreshUsers();
            } finally { setIsUpdatingUser(false); }
        }
    };

    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full w-full p-4 lg:p-6 gap-6 relative bg-zinc-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}><User size={18}/> User Management</button>
                    <button onClick={() => setActiveTab('system')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'system' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}><Cpu size={18}/> AI Models Config</button>
                </div>
                <div className="hidden md:flex items-center gap-2">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Admin Console v2.0</span>
                </div>
            </div>

            {activeTab === 'users' && (
                <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden">
                    {/* User List Sidebar */}
                    <div className="w-full lg:w-[360px] flex flex-col bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden shrink-0">
                        <div className="p-4 bg-zinc-900/50 border-b border-white/5">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" placeholder="Tìm user..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"/>
                                    <Search className="absolute left-3 top-3 text-zinc-500" size={16}/>
                                </div>
                                <button onClick={refreshUsers} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 transition-all border border-white/5"><RefreshCw size={20} className={isSyncing ? "animate-spin" : ""}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 p-2">
                            {filteredUsers.map(user => (
                                <div key={user.username} onClick={() => setSelectedUser(user)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${selectedUser?.username === user.username ? 'bg-indigo-900/20 border-indigo-500' : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-zinc-700'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${user.role === 'admin' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 group-hover:border-indigo-500/30'}`}>
                                            {user.role === 'admin' ? <Shield size={20}/> : <User size={20}/>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-white truncate">@{user.username}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${user.modelTier === '3.0-pro' ? 'bg-purple-600 text-white' : user.modelTier === '2.5-verified' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{user.modelTier}</span>
                                                {user.isVerified && <BadgeCheck size={10} className="text-blue-400"/>}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className={`transition-transform duration-300 ${selectedUser?.username === user.username ? 'translate-x-0 opacity-100 text-indigo-500' : '-translate-x-2 opacity-0'}`}/>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detail Inspector Area */}
                    <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-3xl p-6 overflow-y-auto custom-scrollbar relative flex flex-col gap-8 shadow-inner backdrop-blur-sm">
                        {selectedUser ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                {/* Header Section */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-2xl">
                                            <User size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black text-white tracking-tight">@{selectedUser.username}</h3>
                                            <p className="text-zinc-500 text-sm font-medium flex items-center gap-2 mt-1"><Mail size={14}/> {selectedUser.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        {selectedUser.role !== 'admin' && (
                                            <>
                                                <button onClick={toggleVerification} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${selectedUser.isVerified ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'bg-green-600 text-white hover:bg-green-500'}`}>
                                                    {selectedUser.isVerified ? 'Hủy Xác Minh' : 'Xác Minh User'}
                                                </button>
                                                <button onClick={() => handleDeleteUser(selectedUser.username)} className="p-2.5 bg-red-950/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-xl transition-all shadow-lg">
                                                    <Trash2 size={20}/>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Main Inspector Content */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    {/* Column 1: Core Tiers & Economy */}
                                    <div className="space-y-8">
                                        {/* Tier Selection */}
                                        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-white/5 space-y-6 shadow-xl relative overflow-hidden group">
                                            <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Cpu size={120}/></div>
                                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Cpu size={16} className="text-indigo-400"/> AI Engine Authorization</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                {(['1.5-free', '2.5-verified', '3.0-pro'] as ModelTier[]).map(t => (
                                                    <button 
                                                        key={t} 
                                                        onClick={() => handleUpdateTier(t)}
                                                        className={`py-6 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all relative ${selectedUser.modelTier === t ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700 grayscale hover:grayscale-0'}`}
                                                    >
                                                        <span className="text-[10px] font-black uppercase tracking-tighter mb-1">{t.replace('-', ' ')}</span>
                                                        {t === '3.0-pro' ? <Star size={24} className="text-yellow-400"/> : t === '2.5-verified' ? <BadgeCheck size={24} className="text-blue-400"/> : <Globe size={24}/>}
                                                        {selectedUser.modelTier === t && <CheckCircle2 size={14} className="absolute top-2 right-2 text-indigo-400"/>}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                                                <p className="text-[10px] text-zinc-400 leading-relaxed font-bold italic">
                                                    * <span className="text-white">Pro Tier</span> mở khóa quyền render 4K/8K và bộ máy Gemini 3.0 Pro Image.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Credits Manager */}
                                        {selectedUser.role !== 'admin' && (
                                            <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-8 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                                                <div className="text-center sm:text-left">
                                                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Studio Wallet Balance</h4>
                                                    <p className="text-5xl font-black text-white flex items-center justify-center sm:justify-start gap-4"><Coins size={44} className="text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]"/> {selectedUser.credits}</p>
                                                </div>
                                                <div className="flex flex-col gap-3 w-full sm:w-auto">
                                                    <div className="flex bg-black p-1.5 rounded-2xl border border-zinc-800">
                                                        <input type="number" value={creditAmount} onChange={e => setCreditAmount(parseInt(e.target.value) || 0)} className="w-full sm:w-24 bg-transparent px-4 py-2 text-white font-black text-center focus:outline-none outline-none"/>
                                                        <button onClick={handleAddCredits} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 whitespace-nowrap">Add Credits</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Column 2: Module Permissions Dashboard */}
                                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={16} className="text-emerald-400"/> Module Access Dashboard</h4>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-zinc-600 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950">Active: {Object.values(selectedUser.permissions || {}).filter(v => v !== false).length}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                                            {Object.keys(MODULE_NAMES).map(moduleId => {
                                                const isAllowed = selectedUser.permissions?.[moduleId] !== false;
                                                return (
                                                    <div 
                                                        key={moduleId} 
                                                        onClick={() => togglePermission(moduleId)}
                                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group h-[72px] ${isAllowed ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}
                                                    >
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${isAllowed ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-zinc-800 text-zinc-600'}`}>
                                                                {isAllowed ? <Unlock size={18}/> : <Lock size={18}/>}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className={`text-[10px] font-black uppercase leading-tight truncate block ${isAllowed ? 'text-white' : 'text-zinc-500'}`}>{MODULE_NAMES[moduleId]}</span>
                                                                <span className={`text-[8px] font-bold block mt-1 ${isAllowed ? 'text-emerald-400' : 'text-zinc-600'}`}>{isAllowed ? 'Authorized' : 'Restricted'}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center shrink-0 ${isAllowed ? 'bg-emerald-500 border-emerald-400' : 'border-zinc-800'}`}>
                                                            {isAllowed && <CheckCircle2 size={12} className="text-white"/>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="p-4 bg-zinc-950/50 border border-white/5 rounded-2xl flex gap-4 items-start">
                                            <AlertTriangle size={20} className="text-yellow-600 shrink-0"/>
                                            <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-tight">
                                                Lưu ý: Mọi thay đổi về quyền Module sẽ có hiệu lực ngay lập tức sau khi người dùng làm mới phiên làm việc.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-40">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-indigo-500/10 blur-[80px] rounded-full"></div>
                                    <ShieldAlert size={120} className="relative z-10 animate-pulse"/>
                                </div>
                                <p className="text-3xl font-black uppercase tracking-[0.3em]">SECURE ACCESS CONTROL</p>
                                <p className="text-sm font-bold uppercase mt-4">Select a user from the sidebar to manage identity & permissions</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'system' && (
                <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-6 py-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-zinc-900/60 border border-white/5 p-8 rounded-[3rem] shadow-2xl space-y-10 backdrop-blur-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5"><Cpu size={300}/></div>
                        
                        <div className="flex items-center gap-8 relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl"><Cpu size={48}/></div>
                            <div>
                                <h3 className="text-4xl font-black text-white uppercase tracking-tight">System AI Core</h3>
                                <p className="text-lg text-zinc-500 font-medium mt-1">Configure global model prioritization for Admin tasks.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 relative z-10">
                            {(['1.5-free', '2.5-verified', '3.0-pro'] as ModelTier[]).map(t => {
                                const isActive = users.find(u => u.username === 'admin')?.modelTier === t;
                                return (
                                    <button 
                                        key={t}
                                        onClick={() => { upgradeUserTier('admin', t); refreshUsers(); }}
                                        className={`flex items-center justify-between p-8 rounded-3xl border-2 transition-all relative overflow-hidden group ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_40px_rgba(79,70,229,0.3)] scale-[1.02]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                    >
                                        <div className="flex items-center gap-6 relative z-10">
                                            <div className={`p-4 rounded-2xl ${isActive ? 'bg-white/20' : 'bg-zinc-900 border border-white/5'}`}>
                                                {t === '3.0-pro' ? <Sparkles size={32} className={isActive ? 'text-yellow-300' : ''}/> : t === '2.5-verified' ? <Zap size={32} className={isActive ? 'text-blue-300' : ''}/> : <Globe size={32}/>}
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black uppercase tracking-widest text-xl">{t.replace('-', ' ')}</div>
                                                <div className="text-xs font-bold opacity-60 uppercase mt-1">{t === '3.0-pro' ? 'Ultimate Performance • Gemini 3.0 Pro Infinite' : t === '2.5-verified' ? 'High Speed Core • Gemini 2.5 Flash Optimized' : 'Legacy Engine • Gemini 1.5 Compatibility Mode'}</div>
                                            </div>
                                        </div>
                                        {isActive && <div className="bg-white/20 p-2 rounded-full"><CheckCircle2 size={32} className="text-white animate-in zoom-in"/></div>}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="p-6 bg-red-900/10 border border-red-500/20 rounded-3xl flex gap-6 items-center relative z-10">
                            <AlertTriangle size={32} className="text-red-500 shrink-0"/>
                            <div>
                                <p className="text-xs text-red-200/80 leading-relaxed font-bold uppercase tracking-tight">
                                    Cảnh báo bảo mật: Việc thay đổi cấu hình Model Core cho Admin sẽ ảnh hưởng trực tiếp đến chất lượng sinh ảnh và video trong toàn bộ Suite. Admin cấp 3.0 Pro là bắt buộc để xử lý 8K Ultra.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
