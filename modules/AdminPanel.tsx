
import React, { useState, useEffect } from 'react';
import { RegisteredUser, ModuleType } from '../types';
import { getAllUsers, updateUserPermissions, verifyUser, addCredits, syncUsersFromCloud, deleteUser, adminUpdateUserInfo, forceSyncUp, getBackupUsers, restoreUserFromBackup, getSystemConfig, setSystemMaintenance, getBroadcastAudience } from '../services/userService';
import { generateOTP, sendOTP, getBotInfo, setupBotWebhook, sendUpdateNotification, sendMaintenanceNotification } from '../services/telegramService';
import { Shield, User, ToggleLeft, ToggleRight, Search, BadgeCheck, Coins, RefreshCw, Database, Trash2, Loader2, Wrench, Send, KeyRound, CheckCircle2, XCircle, MessageCircle, Edit2, Save, X, Mail, Key, Calendar, Server, Bot, CloudUpload, Link, Archive, RotateCcw, AlertTriangle, ArrowLeft, Radio, Megaphone, Clock } from 'lucide-react';

interface AdminPanelProps {
    currentUser: RegisteredUser | null;
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const MODULE_NAMES: Record<string, string> = {
    [ModuleType.NEW_CREATION]: "Tạo Ảnh (Gen AI)",
    [ModuleType.CHARACTER_CREATOR]: "Tạo Nhân Vật",
    [ModuleType.STORY_CREATOR]: "Tạo Cốt Truyện",
    [ModuleType.VEO_IDEAS]: "Kịch Bản Veo",
    [ModuleType.IMAGE_TO_VIDEO]: "Veo Video",
    [ModuleType.STUDIO]: "Studio",
    [ModuleType.THUMBNAIL]: "Thumbnail",
    [ModuleType.POSTER]: "Poster",
    [ModuleType.LIBRARY]: "Thư Viện"
};

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, addToast }) => {
    // ... State declarations
    const [activeTab, setActiveTab] = useState<'users' | 'tools' | 'backups' | 'system'>('users');
    const [users, setUsers] = useState<RegisteredUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [creditAmount, setCreditAmount] = useState<number>(10);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);
    
    // --- RESPONSIVE STATE ---
    const [showMobileDetails, setShowMobileDetails] = useState(false);

    // ... Other states (backup, otp, modals)
    const [backupUsers, setBackupUsers] = useState<any[]>([]);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);

    const [tgChatId, setTgChatId] = useState('');
    const [tgOtpInput, setTgOtpInput] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otpStatus, setOtpStatus] = useState<'idle' | 'sent' | 'verified' | 'failed'>('idle');
    const [botUsername, setBotUsername] = useState<string | null>(null);
    const [isConnectingBot, setIsConnectingBot] = useState(false);

    // --- SYSTEM & BROADCAST STATE ---
    const [maintenanceDuration, setMaintenanceDuration] = useState(15);
    const [customDuration, setCustomDuration] = useState('');
    const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
    const [updateVersion, setUpdateVersion] = useState('');
    const [updateNotes, setUpdateNotes] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ email: '', password: '', telegramChatId: '' });

    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    // ... Effects
    useEffect(() => {
        refreshUsers();
        getBotInfo().then(info => {
            if (info) setBotUsername(info.username);
        });
    }, []);

    // Sync UI state when users list updates
    useEffect(() => {
        const adminUser = users.find(u => u.username === 'admin');
        if (adminUser && adminUser.systemConfig) {
            // Check if expired
            if (adminUser.systemConfig.maintenanceMode && Date.now() > adminUser.systemConfig.maintenanceEndTime) {
                setIsMaintenanceActive(false);
            } else {
                setIsMaintenanceActive(adminUser.systemConfig.maintenanceMode);
            }
        }
    }, [users]);

    useEffect(() => {
        if (activeTab === 'backups') {
            loadBackups();
        }
        // Reset mobile view on tab change
        setShowMobileDetails(false);
    }, [activeTab]);

    // ... Helper functions
    const refreshUsers = async () => {
        setIsSyncing(true);
        const allUsers = await syncUsersFromCloud();
        
        const sorted = allUsers.sort((a, b) => {
            if (a.username === 'Admin') return -1;
            if (b.username === 'Admin') return 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        
        setUsers(sorted);
        
        // State update handled by useEffect on [users]

        if (selectedUser) {
            const updated = sorted.find(u => u.username === selectedUser.username);
            if (updated) setSelectedUser(updated);
            else {
                setSelectedUser(null); 
            }
        }
        setIsSyncing(false);
        addToast("Đã đồng bộ", "Dữ liệu tài khoản đã cập nhật từ Sheet 'Account'.", "info");
    };

    const loadBackups = async () => {
        setIsLoadingBackups(true);
        try {
            const data = await getBackupUsers();
            setBackupUsers(data);
        } catch (e) {
            addToast("Lỗi", "Không tải được dữ liệu backup.", "error");
        } finally {
            setIsLoadingBackups(false);
        }
    };

    const handleForcePush = async () => {
        setIsSyncing(true);
        try {
            await forceSyncUp();
            addToast("Đã đẩy dữ liệu", "Dữ liệu local đã được gửi lên Sheet (kiểm tra sau 5s).", "success");
        } catch (e) {
            addToast("Lỗi", "Không thể gửi dữ liệu.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleConnectBot = async () => {
        setIsConnectingBot(true);
        try {
            const res = await setupBotWebhook();
            if (res.success) {
                addToast("Thành công", "Đã kết nối Webhook! Bot sẽ phản hồi /start ngay lập tức.", "success");
            } else {
                addToast("Lỗi", res.message, "error");
            }
        } catch (e) {
            addToast("Lỗi", "Không thể kết nối bot.", "error");
        } finally {
            setIsConnectingBot(false);
        }
    };

    // ... User Handlers
    const toggleModule = (moduleKey: string) => {
        if (!selectedUser) return;
        const currentPerms = selectedUser.permissions || {};
        const newPerms = { ...currentPerms, [moduleKey]: !currentPerms[moduleKey] };
        updateUserPermissions(selectedUser.username, newPerms);
        const updatedUser = { ...selectedUser, permissions: newPerms };
        setSelectedUser(updatedUser);
        setUsers(prev => prev.map(u => u.username === updatedUser.username ? updatedUser : u));
    };

    const toggleVerification = async () => {
        if (!selectedUser || isUpdatingUser) return;
        setIsUpdatingUser(true);
        try {
            const newStatus = !selectedUser.isVerified;
            await verifyUser(selectedUser.username, newStatus);
            const updatedUser = { ...selectedUser, isVerified: newStatus };
            setSelectedUser(updatedUser);
            setUsers(prev => prev.map(u => u.username === updatedUser.username ? updatedUser : u));
            addToast("Thành công", `Đã ${newStatus ? 'xác minh' : 'hủy xác minh'} tài khoản.`, "success");
        } finally {
            setIsUpdatingUser(false);
        }
    };

    const handleAddCredits = async () => {
        if (!selectedUser || creditAmount === 0 || isUpdatingUser) return;
        setIsUpdatingUser(true);
        try {
            await addCredits(selectedUser.username, creditAmount);
            const allUsers = await syncUsersFromCloud();
            const sorted = allUsers.sort((a, b) => {
                if (a.username === 'Admin') return -1;
                if (b.username === 'Admin') return 1;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
            setUsers(sorted);
            const updated = sorted.find(u => u.username === selectedUser.username);
            if (updated) setSelectedUser(updated);
            addToast("Thành công", `Đã cập nhật tín dụng.`, "success");
        } finally {
            setIsUpdatingUser(false);
        }
    };

    // ... Delete/Restore Logic
    const handleDeleteUserClick = (username: string, e?: React.MouseEvent) => {
        if(e) e.stopPropagation();
        if (username === 'Admin') { addToast("Lỗi", "Không thể xóa Admin.", "error"); return; }
        if (username === currentUser?.username) { addToast("Lỗi", "Không thể tự xóa.", "error"); return; }
        setUserToDelete(username);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setIsSyncing(true);
        try {
            const success = await deleteUser(userToDelete);
            if (success) {
                addToast("Thành công", "Đã chuyển tài khoản sang Backup.", "success");
                setUsers(prev => prev.filter(u => u.username !== userToDelete));
                if (selectedUser?.username === userToDelete) {
                    setSelectedUser(null);
                    setShowMobileDetails(false);
                }
            } else {
                addToast("Lỗi", "Xóa thất bại (Server error).", "error");
            }
        } catch (err) { 
            addToast("Lỗi", "Lỗi hệ thống.", "error"); 
        } finally { 
            setIsSyncing(false);
            setUserToDelete(null);
        }
    };

    const handleRestoreUser = async (user: any) => {
        setIsLoadingBackups(true);
        try {
            const success = await restoreUserFromBackup(user);
            if (success) {
                addToast("Thành công", "Tài khoản đã được khôi phục!", "success");
                setBackupUsers(prev => prev.filter(u => u.username !== user.username));
            } else {
                addToast("Lỗi", "Tài khoản có thể đã tồn tại.", "error");
            }
        } catch (e) {
            addToast("Lỗi", "Không thể khôi phục.", "error");
        } finally {
            setIsLoadingBackups(false);
        }
    }

    // ... Edit Modal Logic
    const handleOpenEditModal = () => {
        if (!selectedUser) return;
        setEditForm({ email: selectedUser.email || '', password: '', telegramChatId: selectedUser.telegramChatId || '' });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedUser) return;
        setIsUpdatingUser(true);
        try {
            const res = await adminUpdateUserInfo(selectedUser.username, editForm);
            if (res.success) {
                addToast("Thành công", "Cập nhật thành công.", "success");
                setIsEditModalOpen(false);
                refreshUsers(); 
            } else { addToast("Lỗi", res.message, "error"); }
        } catch (e) { addToast("Lỗi", "Lỗi cập nhật.", "error"); } finally { setIsUpdatingUser(false); }
    };

    // ... Telegram Logic
    const handleSendTelegramOTP = async () => {
        if (!tgChatId.trim()) { addToast("Lỗi", "Nhập Chat ID", "error"); return; }
        setIsSendingOtp(true);
        setOtpStatus('idle');
        setGeneratedOtp(null);
        setTgOtpInput('');
        const code = generateOTP();
        try {
            const res = await sendOTP(tgChatId, code, 'admin');
            if (res.success) {
                setGeneratedOtp(code);
                setOtpStatus('sent');
                addToast("Đã gửi", "OTP đã gửi!", "success");
            } else { addToast("Lỗi Telegram", res.error || "Lỗi gửi tin.", "error"); }
        } catch (e) { addToast("Lỗi mạng", "Không kết nối được Telegram.", "error"); } finally { setIsSendingOtp(false); }
    };

    const handleVerifyOTP = () => {
        if (!generatedOtp) return;
        if (tgOtpInput === generatedOtp) {
            setOtpStatus('verified');
            addToast("Thành công", "OTP Chính xác!", "success");
        } else {
            setOtpStatus('failed');
            addToast("Thất bại", "OTP Sai.", "error");
        }
    };

    // --- SYSTEM BROADCAST LOGIC ---
    const handleToggleMaintenance = async () => {
        setIsBroadcasting(true);
        try {
            const newState = !isMaintenanceActive;
            const finalDuration = customDuration ? parseInt(customDuration) : maintenanceDuration;
            
            // 1. Update Database & Local State
            await setSystemMaintenance(newState, finalDuration);
            setIsMaintenanceActive(newState); // Optimistic update
            
            // 2. Notify Telegram (Broadcast or Specific)
            if (newState) {
                let ids: string[] = [];
                if (targetAudience.trim()) {
                    ids = targetAudience.split(',').map(id => id.trim()).filter(id => id);
                } else {
                    ids = await getBroadcastAudience();
                }

                if (ids.length > 0) {
                    const res = await sendMaintenanceNotification(ids, finalDuration);
                    addToast("Thông báo bảo trì", `Đã gửi tin nhắn tới ${res.count} người dùng.`, "success");
                }
                addToast("Đã bật Bảo trì", `Hệ thống sẽ khóa Login/Register trong ${finalDuration} phút.`, "warning");
            } else {
                addToast("Đã tắt Bảo trì", "Hệ thống hoạt động bình thường.", "success");
            }
            
            // Refresh to confirm final state
            refreshUsers();

        } catch (e) {
            addToast("Lỗi", "Không thể thay đổi trạng thái bảo trì.", "error");
        } finally {
            setIsBroadcasting(false);
        }
    };

    const handleSendUpdateBroadcast = async () => {
        if (!updateVersion || !updateNotes) { addToast("Thiếu thông tin", "Nhập phiên bản và nội dung cập nhật.", "error"); return; }

        setIsBroadcasting(true);
        try {
            let ids: string[] = [];
            if (targetAudience.trim()) {
                ids = targetAudience.split(',').map(id => id.trim()).filter(id => id);
            } else {
                ids = await getBroadcastAudience();
            }

            if (ids.length > 0) {
                const res = await sendUpdateNotification(ids, updateVersion, updateNotes);
                addToast("Đã gửi", `Thông báo cập nhật đã gửi tới ${res.count} người dùng.`, "success");
                setUpdateNotes('');
            } else {
                addToast("Cảnh báo", "Không tìm thấy người dùng nào để gửi tin.", "warning");
            }
        } catch (e) {
            addToast("Lỗi", "Không gửi được thông báo.", "error");
        } finally {
            setIsBroadcasting(false);
        }
    };

    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));

    if (currentUser?.role !== 'admin') return <div className="p-10 text-center text-red-500">Access Denied</div>;

    return (
        <div className="flex flex-col h-full w-full p-4 lg:p-6 gap-6 relative">
            <div className="flex items-center gap-4 border-b border-white/5 pb-4 overflow-x-auto custom-scrollbar shrink-0">
                <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><User size={18}/> User Management</button>
                <button onClick={() => setActiveTab('backups')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'backups' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}><Archive size={18}/> Thùng Rác</button>
                <button onClick={() => setActiveTab('tools')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'tools' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}><Wrench size={18}/> Tools</button>
                <button onClick={() => setActiveTab('system')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'system' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}><Megaphone size={18}/> System</button>
                <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-green-500 bg-green-900/10 px-3 py-1.5 rounded-full border border-green-500/20"><Database size={12}/> Live Data</div>
            </div>

            {activeTab === 'users' && (
                <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden relative">
                    {/* User List - Hide on mobile if showing details */}
                    <div className={`
                        bg-zinc-900/40 border border-white/5 rounded-2xl p-4 lg:p-5 
                        flex-col h-full
                        ${showMobileDetails ? 'hidden lg:flex' : 'flex'}
                        w-full lg:w-1/3
                    `}>
                        <div className="relative mb-4 flex gap-2">
                            <div className="relative flex-1">
                                <input type="text" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none"/>
                                <Search className="absolute left-3 top-2.5 text-zinc-500" size={16}/>
                            </div>
                            <button onClick={refreshUsers} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 border border-zinc-700"><RefreshCw size={18} className={isSyncing ? "animate-spin" : ""}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                            {filteredUsers.map(user => (
                                <div key={user.username} onClick={() => { setSelectedUser(user); setShowMobileDetails(true); }} className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedUser?.username === user.username ? 'bg-red-900/20 border-red-500' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-red-500' : 'bg-zinc-800'}`}>{user.role === 'admin' ? <Shield size={18}/> : <User size={18}/>}</div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2"><p className="text-sm font-bold text-white truncate">{user.username}</p>{user.isVerified && <BadgeCheck size={12} className="text-blue-400"/>}</div>
                                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* User Details - Show on mobile if selected */}
                    <div className={`
                        bg-zinc-900/20 border border-white/5 rounded-2xl p-4 lg:p-6 
                        h-full overflow-y-auto custom-scrollbar
                        ${showMobileDetails ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}
                        flex-1
                    `}>
                        {selectedUser ? (
                            <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-right-4 lg:animate-none">
                                {/* Mobile Header with Back Button */}
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex items-start gap-3 w-full">
                                        <button 
                                            onClick={() => setShowMobileDetails(false)} 
                                            className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                                        >
                                            <ArrowLeft size={24}/>
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                                                {selectedUser.username} 
                                                {selectedUser.role === 'admin' && <Shield size={18} className="text-red-500 shrink-0"/>}
                                            </h3>
                                            <p className="text-xs text-zinc-500">{selectedUser.role === 'admin' ? "Local Admin" : "Sheet User"}</p>
                                        </div>
                                    </div>
                                    
                                    {selectedUser.role !== 'admin' && (
                                        <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                            <button
                                                onClick={toggleVerification}
                                                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                                                    selectedUser.isVerified
                                                    ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50 hover:bg-yellow-900/50'
                                                    : 'bg-green-600 hover:bg-green-500 text-white border-green-500'
                                                }`}
                                            >
                                                {selectedUser.isVerified ? <XCircle size={14}/> : <CheckCircle2 size={14}/>}
                                                {selectedUser.isVerified ? 'Hủy Xác minh' : 'Xác thực'}
                                            </button>
                                            
                                            <button onClick={handleOpenEditModal} className="flex-1 sm:flex-none px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold border border-zinc-600 flex items-center justify-center gap-1"><Edit2 size={14}/> Sửa</button>
                                            <button onClick={(e) => handleDeleteUserClick(selectedUser.username, e)} className="flex-1 sm:flex-none px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs font-bold border border-red-900/50 flex items-center justify-center gap-1"><Trash2 size={14}/> Xóa</button>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"><label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1"><Mail size={10}/> Email</label><p className="text-white font-medium truncate">{selectedUser.email}</p></div>
                                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"><label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1"><MessageCircle size={10}/> Telegram ID</label><p className="text-white font-medium truncate">{selectedUser.telegramChatId || '---'}</p></div>
                                </div>
                                {selectedUser.role !== 'admin' && (
                                    <>
                                        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl"><h3 className="text-base font-bold text-white mb-3 flex items-center gap-2"><Coins className="text-yellow-500"/> Tín dụng: {selectedUser.credits}</h3><div className="flex items-center gap-2"><input type="number" value={creditAmount} onChange={e => setCreditAmount(parseInt(e.target.value) || 0)} className="w-20 bg-zinc-800 border rounded px-2 py-1 text-white"/><button onClick={handleAddCredits} disabled={isUpdatingUser} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-600 hover:bg-yellow-500 text-white">Cập nhật</button></div></div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(MODULE_NAMES).map(([key, label]) => { if(key===ModuleType.ADMIN_PANEL)return null; const on = selectedUser.permissions?.[key]!==false; return <div key={key} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${on?'bg-indigo-900/20 border-indigo-500/50':'bg-zinc-950 border-zinc-800 opacity-60'}`} onClick={()=>toggleModule(key)}><span className="text-sm font-medium text-white">{label}</span>{on?<ToggleRight className="text-indigo-400"/>:<ToggleLeft className="text-zinc-600"/>}</div>})}</div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-600">
                                <div className="hidden lg:block"><User size={64}/></div>
                                {/* Mobile placeholder if somehow visible */}
                                <div className="lg:hidden flex flex-col items-center">
                                    <User size={48} className="opacity-50 mb-2"/>
                                    <p className="text-xs">Chọn user để xem chi tiết</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'backups' && (
                <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-2xl p-4 lg:p-6 h-full overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Archive className="text-yellow-500"/> Thùng Rác (Backup Cloud)</h3>
                        <button onClick={loadBackups} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 border border-zinc-700"><RefreshCw size={18} className={isLoadingBackups ? "animate-spin" : ""}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoadingBackups ? (
                            <div className="h-full flex items-center justify-center text-zinc-500 gap-2"><Loader2 className="animate-spin"/> Đang tải backup...</div>
                        ) : backupUsers.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-zinc-600">Thùng rác trống</div>
                        ) : (
                            <div className="min-w-full inline-block align-middle">
                                <div className="overflow-hidden md:rounded-lg">
                                    <table className="min-w-full divide-y divide-white/5">
                                        <thead className="bg-zinc-900/50 text-xs uppercase font-bold text-zinc-500">
                                            <tr>
                                                <th className="p-3 text-left">Username</th>
                                                <th className="p-3 text-left hidden sm:table-cell">Email</th>
                                                <th className="p-3 text-left hidden md:table-cell">Ngày Xóa</th>
                                                <th className="p-3 text-right">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {backupUsers.map((user, idx) => (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 font-bold text-white text-sm">{user.username}</td>
                                                    <td className="p-3 text-sm text-zinc-400 hidden sm:table-cell">{user.email}</td>
                                                    <td className="p-3 text-xs text-zinc-500 hidden md:table-cell">{new Date(user.deletedAt).toLocaleString()}</td>
                                                    <td className="p-3 text-right">
                                                        <button 
                                                            onClick={() => handleRestoreUser(user)}
                                                            className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg text-xs font-bold border border-green-500/30 flex items-center gap-1 ml-auto"
                                                        >
                                                            <RotateCcw size={12}/> <span className="hidden sm:inline">Khôi phục</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SYSTEM TAB */}
            {activeTab === 'system' && (
                <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-2xl p-4 lg:p-8 flex flex-col items-center overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl w-full space-y-8">
                        {/* Target Audience Input */}
                        <div className="w-full">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 flex items-center gap-1">
                                <MessageCircle size={12}/> Người nhận (Chat ID)
                            </label>
                            <textarea 
                                value={targetAudience}
                                onChange={e => setTargetAudience(e.target.value)}
                                placeholder="Nhập các Chat ID cách nhau bởi dấu phẩy (VD: 12345, 67890). Để trống = Gửi TẤT CẢ người dùng."
                                className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none resize-none placeholder-zinc-600 font-mono"
                            />
                        </div>

                        {/* Maintenance Control */}
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400"><Wrench size={24}/></div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">Chế độ Bảo trì (Maintenance)</h3>
                                        <p className="text-xs text-zinc-500">Khóa truy cập Login/Register tạm thời.</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded text-xs font-bold ${isMaintenanceActive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                                    {isMaintenanceActive ? 'ĐANG BẬT' : 'BÌNH THƯỜNG'}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 flex items-center gap-1">
                                        <Clock size={12}/> Thời gian bảo trì
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {[15, 30, 60, 180].map(min => (
                                            <button 
                                                key={min}
                                                onClick={() => { setMaintenanceDuration(min); setCustomDuration(''); }}
                                                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${maintenanceDuration === min && !customDuration ? 'bg-yellow-600 text-white border-yellow-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'}`}
                                            >
                                                {min} phút
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="number"
                                        value={customDuration}
                                        onChange={e => setCustomDuration(e.target.value)}
                                        placeholder="Hoặc nhập số phút tùy chỉnh..."
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-yellow-500"
                                    />
                                </div>

                                <button 
                                    onClick={handleToggleMaintenance} 
                                    disabled={isBroadcasting}
                                    className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${isMaintenanceActive ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                                >
                                    {isBroadcasting ? <Loader2 size={16} className="animate-spin"/> : (isMaintenanceActive ? 'Tắt Bảo trì & Thông báo' : 'Bật Bảo trì & Thông báo')}
                                </button>
                                <p className="text-[10px] text-zinc-500 italic text-center">* Hệ thống sẽ tự động mở lại sau khi hết thời gian cài đặt.</p>
                            </div>
                        </div>

                        {/* Update Notification */}
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Megaphone size={24}/></div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">Thông báo Cập nhật (Broadcast)</h3>
                                    <p className="text-xs text-zinc-500">Gửi thông báo Release Note về Telegram.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Phiên bản</label>
                                    <input 
                                        type="text" 
                                        value={updateVersion} 
                                        onChange={e => setUpdateVersion(e.target.value)} 
                                        placeholder="VD: v2.5.1" 
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Chi tiết thay đổi (Release Notes)</label>
                                    <textarea 
                                        value={updateNotes}
                                        onChange={e => setUpdateNotes(e.target.value)}
                                        placeholder="- Tính năng A&#10;- Sửa lỗi B&#10;- Cải thiện hiệu năng..."
                                        className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white resize-none focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={handleSendUpdateBroadcast} 
                                        disabled={isBroadcasting}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg"
                                    >
                                        {isBroadcasting ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Gửi Thông Báo Cập Nhật
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TOOLS TAB (Existing) */}
            {activeTab === 'tools' && (
                <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-2xl p-4 lg:p-8 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
                    {/* ... (Tool tab content remains largely the same, just ensured padding responsiveness) */}
                    <div className="max-w-md w-full space-y-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><Server size={24}/></div>
                                <div><h3 className="font-bold text-white">Server Trạng Thái</h3><p className="text-xs text-zinc-500">Google Apps Script Proxy</p></div>
                            </div>
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between border-b border-zinc-800 pb-2">
                                    <span className="text-zinc-400">Bot Service</span>
                                    <span className="text-green-400 font-bold">Online</span>
                                </div>
                                <div className="flex justify-between border-b border-zinc-800 pb-2">
                                    <span className="text-zinc-400">Database Sync</span>
                                    <span className="text-green-400 font-bold">Connected</span>
                                </div>
                                <div className="pt-2 space-y-2">
                                    <button 
                                        onClick={handleForcePush} 
                                        disabled={isSyncing}
                                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 border border-zinc-700 disabled:opacity-50"
                                    >
                                        {isSyncing ? <Loader2 size={14} className="animate-spin"/> : <CloudUpload size={14}/>} Lưu Dữ Liệu lên Cloud
                                    </button>
                                    
                                    <button 
                                        onClick={handleConnectBot} 
                                        disabled={isConnectingBot}
                                        className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isConnectingBot ? <Loader2 size={14} className="animate-spin"/> : <Link size={14}/>} Kết nối Webhook Bot (Sửa lỗi /start)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Send size={24}/></div>
                                <div><h3 className="font-bold text-white">Kiểm tra gửi OTP</h3><p className="text-xs text-zinc-500">Test kết nối qua Server Proxy</p></div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold flex justify-between">
                                        Chat ID
                                        {botUsername && <a href={`https://t.me/${botUsername}?start=admin_getid`} target="_blank" className="text-blue-400 hover:underline flex gap-1">Lấy ID?</a>}
                                    </label>
                                    <div className="flex gap-2">
                                        <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="Chat ID" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white"/>
                                        <button onClick={handleSendTelegramOTP} disabled={isSendingOtp} className="bg-blue-600 text-white px-3 rounded-lg text-xs font-bold disabled:opacity-50">{isSendingOtp ? <Loader2 className="animate-spin"/> : "Gửi"}</button>
                                    </div>
                                </div>
                                {otpStatus !== 'idle' && (
                                    <div className="flex gap-2 animate-in fade-in">
                                        <input type="text" value={tgOtpInput} onChange={e => setTgOtpInput(e.target.value)} placeholder="Nhập OTP" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white tracking-widest text-center"/>
                                        <button onClick={handleVerifyOTP} className="bg-green-600 text-white px-3 rounded-lg text-xs font-bold">Check</button>
                                    </div>
                                )}
                                {otpStatus === 'verified' && <div className="p-2 bg-green-500/10 text-green-400 text-xs font-bold text-center rounded">OK! Kết nối thành công.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl relative">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center"><h3 className="text-lg font-bold text-white">Sửa: {selectedUser.username}</h3><button onClick={() => setIsEditModalOpen(false)} className="text-zinc-500"><X size={20}/></button></div>
                        <div className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-zinc-500 uppercase">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm"/></div>
                            <div><label className="text-xs font-bold text-zinc-500 uppercase">Password (Mới)</label><input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm" placeholder="Để trống nếu không đổi"/></div>
                            <div><label className="text-xs font-bold text-zinc-500 uppercase">Telegram ID</label><input type="text" value={editForm.telegramChatId} onChange={e => setEditForm({...editForm, telegramChatId: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm"/></div>
                            <button onClick={handleSaveEdit} disabled={isUpdatingUser} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex justify-center gap-2">{isUpdatingUser ? <Loader2 className="animate-spin"/> : "Lưu thay đổi"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {userToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center transform transition-all scale-100">
                        <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30 text-red-500">
                            <AlertTriangle size={24}/>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Xác nhận xóa tài khoản?</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Bạn có chắc muốn xóa người dùng <span className="text-white font-bold">{userToDelete}</span>? 
                            <br/>Dữ liệu sẽ được chuyển vào 'BackUpUser'.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setUserToDelete(null)}
                                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={confirmDelete}
                                disabled={isSyncing}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isSyncing ? <Loader2 size={16} className="animate-spin"/> : "Xác nhận xóa"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
