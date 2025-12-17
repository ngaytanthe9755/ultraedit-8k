
import React, { useState, useEffect } from 'react';
import { RegisteredUser, ModuleType, ModelTier } from '../types';
import { getAllUsers, updateUserPermissions, verifyUser, addCredits, syncUsersFromCloud, deleteUser, adminUpdateUserInfo, forceSyncUp, upgradeUserTier } from '../services/userService';
import { Shield, User, ToggleLeft, ToggleRight, Search, BadgeCheck, Coins, RefreshCw, Trash2, Loader2, Wrench, Send, Edit2, X, Mail, Globe, Zap, Cpu, Sparkles, Star, Lock, Unlock, ShieldAlert, CheckCircle2, ChevronRight, LayoutGrid, Eye, AlertTriangle, CheckSquare, Square } from 'lucide-react';

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
            setSelectedUser({ ...selectedUser, permissions: currentPerms });
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

    // Fix: Added missing handleAddCredits function to handle credit addition
    const handleAddCredits = async () => {
        if (!selectedUser || isUpdatingUser) return;
        setIsUpdatingUser(true);
        try {
            await addCredits(selectedUser.username, creditAmount);
            addToast("Thành công", `Đã cộng ${creditAmount} credits cho @${selectedUser.username}`, "success");
            refreshUsers();
        } catch (e) {
            addToast("Lỗi", "Không thể cộng credits", "error");
        } finally {
            setIsUpdatingUser(false);
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
            </div>

            {activeTab === 'users' && (
                <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden">
                    <div className="w-full lg:w-[360px] flex flex-col bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden shrink-0">
                        <div className="p-4 bg-zinc-900/50 border-b border-white/5">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" placeholder="Tìm user..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"/>
                                    <Search className="absolute left-3 top-3 text-zinc-500" size={16}/>
                                </div>
                                <button onClick={refreshUsers} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 border border-white/5"><RefreshCw size={20} className={isSyncing ? "animate-spin" : ""}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 p-2">
                            {filteredUsers.map(user => (
                                <div key={user.username} onClick={() => setSelectedUser(user)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${selectedUser?.username === user.username ? 'bg-indigo-900/20 border-indigo-500' : 'bg-transparent border-transparent hover:bg-zinc-800/50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${user.role === 'admin' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
                                            {user.role === 'admin' ? <Shield size={20}/> : <User size={20}/>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white truncate">@{user.username}</p>
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${user.modelTier === '3.0-pro' ? 'bg-purple-600 text-white' : user.modelTier === '2.5-verified' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{user.modelTier}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className={`transition-transform ${selectedUser?.username === user.username ? 'translate-x-0 text-indigo-500' : '-translate-x-2 opacity-0'}`}/>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-3xl p-6 overflow-y-auto custom-scrollbar relative flex flex-col gap-8 shadow-inner">
                        {selectedUser ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                <div className="flex justify-between items-center pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-2xl"><User size={32} /></div>
                                        <div>
                                            <h3 className="text-4xl font-black text-white tracking-tight">@{selectedUser.username}</h3>
                                            <p className="text-zinc-500 text-sm font-medium">{selectedUser.email}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    <div className="space-y-8">
                                        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-white/5 space-y-6 shadow-xl relative overflow-hidden group">
                                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Cpu size={16} className="text-indigo-400"/> AI Engine Authorization</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                {(['1.5-free', '2.5-verified', '3.0-pro'] as ModelTier[]).map(t => (
                                                    <button 
                                                        key={t} 
                                                        onClick={() => handleUpdateTier(t)}
                                                        className={`py-6 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all relative ${selectedUser.modelTier === t ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600 grayscale hover:grayscale-0'}`}
                                                    >
                                                        <span className="text-[10px] font-black uppercase tracking-tighter mb-1">{t.replace('-', ' ')}</span>
                                                        {t === '3.0-pro' ? <Star size={24} className="text-yellow-400"/> : t === '2.5-verified' ? <BadgeCheck size={24} className="text-blue-400"/> : <Globe size={24}/>}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                                                <p className="text-[10px] text-zinc-400 font-bold italic">
                                                    * <span className="text-white">Pro Tier (8K)</span> yêu cầu API Key thanh toán từ project GCP.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-8 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                                            <div>
                                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Credits Wallet</h4>
                                                <p className="text-5xl font-black text-white flex items-center gap-4"><Coins size={44} className="text-yellow-500"/> {selectedUser.credits}</p>
                                            </div>
                                            <div className="flex bg-black p-1.5 rounded-2xl border border-zinc-800">
                                                <input type="number" value={creditAmount} onChange={e => setCreditAmount(parseInt(e.target.value) || 0)} className="w-24 bg-transparent px-4 py-2 text-white font-black text-center focus:outline-none outline-none"/>
                                                <button onClick={handleAddCredits} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Add Credits</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col space-y-6">
                                        <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={16} className="text-emerald-400"/> Module Permission Manager</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto custom-scrollbar">
                                            {Object.keys(MODULE_NAMES).map(moduleId => {
                                                const isAllowed = selectedUser.permissions?.[moduleId] !== false;
                                                return (
                                                    <div 
                                                        key={moduleId} 
                                                        onClick={() => togglePermission(moduleId)}
                                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${isAllowed ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}
                                                    >
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isAllowed ? 'bg-emerald-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-600'}`}>
                                                                {isAllowed ? <Unlock size={18}/> : <Lock size={18}/>}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className={`text-[10px] font-black uppercase leading-tight truncate block ${isAllowed ? 'text-white' : 'text-zinc-500'}`}>{MODULE_NAMES[moduleId]}</span>
                                                                <span className={`text-[8px] font-bold block mt-1 ${isAllowed ? 'text-emerald-400' : 'text-zinc-600'}`}>{isAllowed ? 'Authorized' : 'Restricted'}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-full border-2 ${isAllowed ? 'bg-emerald-500 border-emerald-400' : 'border-zinc-800'}`}></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-40">
                                <ShieldAlert size={120} className="mb-6 animate-pulse"/>
                                <p className="text-3xl font-black uppercase tracking-[0.3em]">SECURE ADMIN CONSOLE</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'system' && (
                <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in py-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-zinc-900/60 border border-white/5 p-8 rounded-[3rem] shadow-2xl space-y-10 backdrop-blur-xl relative overflow-hidden">
                        <div className="flex items-center gap-8 relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl"><Cpu size={48}/></div>
                            <div>
                                <h3 className="text-4xl font-black text-white uppercase tracking-tight">System AI Core</h3>
                                <p className="text-lg text-zinc-500 font-medium mt-1">Global model prioritization for Admin account.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 relative z-10">
                            {(['1.5-free', '2.5-verified', '3.0-pro'] as ModelTier[]).map(t => {
                                const isActive = users.find(u => u.username === 'admin')?.modelTier === t;
                                return (
                                    <button 
                                        key={t}
                                        onClick={() => { upgradeUserTier('admin', t); refreshUsers(); }}
                                        className={`flex items-center justify-between p-8 rounded-3xl border-2 transition-all group ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className={`p-4 rounded-2xl ${isActive ? 'bg-white/20' : 'bg-zinc-900 border border-white/5'}`}>
                                                {t === '3.0-pro' ? <Sparkles size={32}/> : t === '2.5-verified' ? <Zap size={32}/> : <Globe size={32}/>}
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black uppercase tracking-widest text-xl">{t.replace('-', ' ')}</div>
                                                <div className="text-xs font-bold opacity-60 uppercase mt-1">{t === '3.0-pro' ? 'Gemini 3.0 Pro + 8K Ultra' : t === '2.5-verified' ? 'Gemini 2.5 Flash + 4K High' : 'Legacy Engine'}</div>
                                            </div>
                                        </div>
                                        {isActive && <div className="bg-white/20 p-2 rounded-full"><CheckCircle2 size={32} className="text-white"/></div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
