
import { RegisteredUser, ModuleType, AppNotification, SystemConfig, ModelTier } from '../types';
import { v4 as uuidv4 } from 'uuid';

// --- CẤU HÌNH HỆ THỐNG ---
const STORAGE_KEY_USERS = 'ue_registered_users';
const DEVICE_ID_KEY = 'ue_device_fingerprint';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzMumXFKOnLOr-R6VJlF7pTw9JL9Ynh92573Dpbc4ztfRLnQHjRhooa2israF_lAnW6hw/exec";

let saveTimeout: any = null;

const normalizeStr = (str: string): string => str.trim().toLowerCase();

const getLocalAdmin = (): RegisteredUser => {
    return {
        username: 'admin', 
        email: 'admin@ultraedit.ai',
        password: 'Aa147258!@#!',
        role: 'admin',
        isVerified: true, 
        modelTier: '2.5-verified', // Mặc định Admin là 2.5 theo yêu cầu
        permissions: {}, 
        credits: 999999, 
        createdAt: 0, 
        deviceId: 'admin-device',
        currentSessionId: 'admin-session'
    };
};

const getLocalUsers = (): RegisteredUser[] => {
    const usersStr = localStorage.getItem(STORAGE_KEY_USERS);
    let users: RegisteredUser[] = usersStr ? JSON.parse(usersStr) : [];
    
    const adminIdx = users.findIndex(u => normalizeStr(u.username) === 'admin');
    const systemAdmin = getLocalAdmin();

    if (adminIdx === -1) {
        users.unshift(systemAdmin);
    } else {
        const storedConfig = users[adminIdx].systemConfig;
        const storedTier = users[adminIdx].modelTier;
        users[adminIdx] = { 
            ...users[adminIdx], 
            ...systemAdmin, 
            credits: 999999,
            modelTier: storedTier || systemAdmin.modelTier,
            systemConfig: storedConfig 
        };
    }
    return users;
};

const saveLocalUsers = (users: RegisteredUser[]) => {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('user_data_updated'));
};

export const getSystemConfig = (): SystemConfig | undefined => {
    const usersStr = localStorage.getItem(STORAGE_KEY_USERS);
    const users: RegisteredUser[] = usersStr ? JSON.parse(usersStr) : [];
    const admin = users.find(u => normalizeStr(u.username) === 'admin');
    return admin?.systemConfig;
};

// --- SYNC ENGINE ---

const pushToCloud = async (users: RegisteredUser[], immediate: boolean = false) => {
    if (!GOOGLE_SCRIPT_URL) return;
    const performPush = async () => {
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 'Content-Type': 'text/plain' }, 
                body: JSON.stringify({ action: 'save', data: users })
            });
        } catch (err) { console.error("[Cloud] Push error:", err); }
    };
    if (saveTimeout) clearTimeout(saveTimeout);
    if (immediate) return performPush();
    else saveTimeout = setTimeout(performPush, 2000);
};

export const syncUsersFromCloud = async (): Promise<RegisteredUser[]> => {
    if (!GOOGLE_SCRIPT_URL) return getLocalUsers();
    const localUsers = getLocalUsers();
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_users&t=${Date.now()}`, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' }
        });
        if (res.ok) {
            const text = await res.text();
            let json = JSON.parse(text);
            if (json.status === 'success' && Array.isArray(json.data)) {
                const cloudUsers = json.data as RegisteredUser[];
                const localAdmin = getLocalAdmin();
                const cloudAdmin = cloudUsers.find(u => normalizeStr(u.username) === 'admin');
                if (cloudAdmin) localAdmin.modelTier = cloudAdmin.modelTier || localAdmin.modelTier;
                const cleanCloudUsers = cloudUsers.filter(u => normalizeStr(u.username) !== 'admin');
                const mergedUsers = [localAdmin, ...cleanCloudUsers];
                saveLocalUsers(mergedUsers);
                return mergedUsers;
            }
        }
    } catch (e) { console.warn("[Sync] Network Error:", e); }
    return localUsers;
};

// --- USER ACTIONS ---

// Added: getAllUsers for admin panel and list fetching
export const getAllUsers = (): RegisteredUser[] => {
    return getLocalUsers();
};

// Added: getUserNotifications to retrieve unread/read messages for a user
export const getUserNotifications = (username: string): AppNotification[] => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    return user?.notifications || [];
};

// Added: markNotificationsRead for UI notification management
export const markNotificationsRead = (username: string) => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(username));
    if (idx !== -1) {
        users[idx].notifications = (users[idx].notifications || []).map(n => ({ ...n, read: true }));
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

// Added: isSessionValid for security multi-login prevention
export const isSessionValid = (username: string, sessionId?: string): boolean => {
    if (!sessionId) return false;
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    return user?.currentSessionId === sessionId;
};

// Added: findUserByContact for recovery or search
export const findUserByContact = (contact: string): RegisteredUser | undefined => {
    const users = getLocalUsers();
    const normalized = normalizeStr(contact);
    return users.find(u => normalizeStr(u.username) === normalized || normalizeStr(u.email) === normalized);
};

// Added: resetPassword for admin or self-recovery
export const resetPassword = async (username: string, newPass: string) => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(username));
    if (idx !== -1) {
        users[idx].password = newPass;
        saveLocalUsers(users);
        await pushToCloud(users, true);
    }
};

// Added: finalizeUserLogin to initialize session after OTP/Credentials
export const finalizeUserLogin = async (username: string): Promise<RegisteredUser | undefined> => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(username));
    if (idx !== -1) {
        const newSessionId = uuidv4();
        users[idx].currentSessionId = newSessionId;
        saveLocalUsers(users);
        await pushToCloud(users, true);
        return users[idx];
    }
    return undefined;
};

// Added: updateUserPermissions for admin management
export const updateUserPermissions = async (username: string, permissions: Record<string, boolean>) => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(username));
    if (idx !== -1) {
        users[idx].permissions = permissions;
        saveLocalUsers(users);
        await pushToCloud(users, true);
    }
};

// Added: deleteUser for admin clean up
export const deleteUser = async (username: string) => {
    let users = getLocalUsers();
    users = users.filter(u => normalizeStr(u.username) !== normalizeStr(username));
    saveLocalUsers(users);
    await pushToCloud(users, true);
};

// Added: forceSyncUp to push data to cloud script immediately
export const forceSyncUp = async () => {
    const users = getLocalUsers();
    await pushToCloud(users, true);
};

export const registerUser = async (userData: RegisteredUser): Promise<{ success: boolean; message: string; user?: RegisteredUser }> => {
    let currentUsers = await syncUsersFromCloud();
    const finalUsername = normalizeStr(userData.username);
    const finalEmail = normalizeStr(userData.email);

    if (currentUsers.some(u => normalizeStr(u.email) === finalEmail)) return { success: false, message: "Email này đã được sử dụng." };
    if (currentUsers.some(u => normalizeStr(u.username) === finalUsername)) return { success: false, message: "Tên đăng nhập đã tồn tại." };
    
    const newUser: RegisteredUser = {
        ...userData,
        username: finalUsername,
        email: finalEmail,
        modelTier: '1.5-free', // Mặc định tài khoản mới là 1.5 free
        isVerified: false,
        credits: 10,
        createdAt: Date.now(),
        currentSessionId: uuidv4()
    };

    currentUsers.push(newUser);
    saveLocalUsers(currentUsers);
    await pushToCloud(currentUsers, true);
    return { success: true, message: "Đăng ký thành công!", user: newUser };
};

export const loginUser = async (identifier: string, password?: string): Promise<{ success: boolean; user?: RegisteredUser; message: string; requireOtp?: boolean }> => {
    await syncUsersFromCloud();
    const users = getLocalUsers();
    const normalizedId = normalizeStr(identifier);
    const user = users.find(u => (normalizeStr(u.username) === normalizedId || normalizeStr(u.email) === normalizedId) && (!password || u.password === password));
    
    if (user) {
        if (user.role === 'admin') return { success: true, user: user, message: "Đăng nhập thành công (Admin)" };
        return { success: true, user: user, message: "Vui lòng xác thực OTP", requireOtp: true };
    }
    return { success: false, message: "Thông tin đăng nhập không chính xác" };
};

export const verifyUser = async (username: string, status: boolean) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user) {
        user.isVerified = status;
        // Tự động nâng cấp lên 2.5 nếu được xác minh, hoặc hạ về 1.5 nếu hủy xác minh
        if (status) user.modelTier = '2.5-verified';
        else user.modelTier = '1.5-free';
        
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

export const upgradeUserTier = async (username: string, tier: ModelTier) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user) {
        user.modelTier = tier;
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

export const adminUpdateUserInfo = async (targetUsername: string, data: any) => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(targetUsername));
    if (idx === -1) return { success: false, message: "User not found" };
    
    if (data.modelTier) users[idx].modelTier = data.modelTier;
    if (data.email) users[idx].email = data.email;
    if (data.password) users[idx].password = data.password;
    if (data.telegramChatId) users[idx].telegramChatId = data.telegramChatId;

    saveLocalUsers(users);
    pushToCloud(users, true);
    return { success: true, message: "Cập nhật thành công" };
};

export const addCredits = async (username: string, amount: number) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user) {
        user.credits = (user.credits || 0) + amount;
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

export const checkUsageLimit = (username: string, module: string, cost: number = 1): { allowed: boolean; message?: string } => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (!user) return { allowed: false, message: "User not found" };
    if (user.role === 'admin' || user.credits >= cost) return { allowed: true };
    return { allowed: false, message: "Số dư không đủ." };
};

export const incrementUsage = (username: string, module: string, cost: number = 1) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user && user.role !== 'admin') {
        user.credits = Math.max(0, (user.credits || 0) - cost);
    }
    saveLocalUsers(users);
    pushToCloud(users, false);
};
