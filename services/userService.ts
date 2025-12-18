
import { RegisteredUser, ModuleType, AppNotification, SystemConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

// --- CẤU HÌNH HỆ THỐNG ---
const STORAGE_KEY_USERS = 'ue_registered_users';
const DEVICE_ID_KEY = 'ue_device_fingerprint';

// URL Google Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzMumXFKOnLOr-R6VJlF7pTw9JL9Ynh92573Dpbc4ztfRLnQHjRhooa2israF_lAnW6hw/exec";

let saveTimeout: any = null;

// --- 1. HELPERS ---

const normalizeStr = (str: string): string => str.trim().toLowerCase();

const isValidUsernameFormat = (username: string): boolean => {
    const regex = /^[a-zA-Z0-9]+$/;
    return regex.test(username);
};

const isValidEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const isValidPassword = (password: string): boolean => {
    // Relaxed requirement: Just minimum 6 characters
    return password.length >= 6;
};

const getLocalAdmin = (): RegisteredUser => {
    return {
        username: 'admin', 
        email: 'admin@ultraedit.ai',
        password: 'Aa147258!@#!',
        role: 'admin',
        isVerified: true, 
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
        // Merge stored admin data but ensure credentials stay correct
        // Keep systemConfig if it exists in local storage
        const storedConfig = users[adminIdx].systemConfig;
        users[adminIdx] = { 
            ...users[adminIdx], 
            ...systemAdmin, 
            credits: 999999,
            systemConfig: storedConfig // Preserve config
        };
    }
    return users;
};

const saveLocalUsers = (users: RegisteredUser[]) => {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('user_data_updated'));
};

export const getDeviceId = (): string => {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = uuidv4();
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
};

// --- SYSTEM CONFIG (MAINTENANCE) ---

export const getSystemConfig = (): SystemConfig | undefined => {
    // Always read fresh from LS to avoid stale closure issues in UI components
    const usersStr = localStorage.getItem(STORAGE_KEY_USERS);
    const users: RegisteredUser[] = usersStr ? JSON.parse(usersStr) : [];
    const admin = users.find(u => normalizeStr(u.username) === 'admin');
    
    if (admin && admin.systemConfig) {
        // Auto-disable maintenance if time expired
        if (admin.systemConfig.maintenanceMode && Date.now() > admin.systemConfig.maintenanceEndTime) {
            console.log("[System] Maintenance expired. Auto-opening.");
            return { ...admin.systemConfig, maintenanceMode: false };
        }
        return admin.systemConfig;
    }
    return undefined;
};

export const setSystemMaintenance = async (enabled: boolean, durationMinutes: number = 0): Promise<void> => {
    const users = getLocalUsers();
    const adminIdx = users.findIndex(u => normalizeStr(u.username) === 'admin');
    
    if (adminIdx !== -1) {
        const currentConfig = users[adminIdx].systemConfig || { maintenanceMode: false, maintenanceEndTime: 0 };
        
        users[adminIdx].systemConfig = {
            ...currentConfig,
            maintenanceMode: enabled,
            maintenanceEndTime: enabled ? Date.now() + (durationMinutes * 60 * 1000) : 0
        };
        
        // Critical: Save locally immediately so UI updates
        saveLocalUsers(users);
        // Then push to cloud
        await pushToCloud(users, true);
    }
};

// --- 2. SYNC ENGINE ---

const pushToCloud = async (users: RegisteredUser[], immediate: boolean = false) => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("XXXXXXXXXXXX")) return;

    const performPush = async () => {
        try {
            console.log("[Cloud] Pushing data...");
            const sortedUsers = [
                ...users.filter(u => normalizeStr(u.username) === 'admin'),
                ...users.filter(u => normalizeStr(u.username) !== 'admin').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            ];

            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 
                    'Content-Type': 'text/plain'
                }, 
                body: JSON.stringify({
                    action: 'save', 
                    data: sortedUsers
                })
            });
            console.log("[Cloud] Push signal sent (No-CORS).");
        } catch (err) {
            console.error("[Cloud] Push error:", err);
        }
    };

    if (saveTimeout) clearTimeout(saveTimeout);
    if (immediate) {
        return performPush();
    } else {
        saveTimeout = setTimeout(performPush, 2000);
    }
};

export const forceSyncUp = async (): Promise<boolean> => {
    const users = getLocalUsers();
    await pushToCloud(users, true);
    return true;
};

export const syncUsersFromCloud = async (): Promise<RegisteredUser[]> => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("XXXXXXXXXXXX")) return getLocalUsers();

    const localUsers = getLocalUsers();
    
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_users&t=${Date.now()}`, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' }
        });

        if (res.ok) {
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.warn("[Sync] Server response is not JSON:", text.substring(0, 100));
                return localUsers;
            }

            if (json.status === 'success' && Array.isArray(json.data)) {
                const cloudUsers = json.data as RegisteredUser[];
                const RECENT_THRESHOLD = 5 * 60 * 1000; // 5 phút
                const now = Date.now();

                // 1. Update System Config from Cloud Admin
                const cloudAdmin = cloudUsers.find(u => normalizeStr(u.username) === 'admin');
                const localAdmin = getLocalAdmin();
                
                // If cloud admin has a config, respect it (Server authority)
                if (cloudAdmin && cloudAdmin.systemConfig) {
                    localAdmin.systemConfig = cloudAdmin.systemConfig;
                    
                    // Auto turn off maintenance if time passed (Clean up cloud)
                    if (localAdmin.systemConfig.maintenanceMode && now > localAdmin.systemConfig.maintenanceEndTime) {
                        localAdmin.systemConfig.maintenanceMode = false;
                        // We will push this update back to cloud at the end of function
                    }
                }

                const pendingSyncUsers = localUsers.filter(localU => {
                    if (normalizeStr(localU.username) === 'admin') return false;
                    const existsInCloud = cloudUsers.some(cloudU => normalizeStr(cloudU.username) === normalizeStr(localU.username));
                    const isRecent = (now - (localU.createdAt || 0)) < RECENT_THRESHOLD;
                    return !existsInCloud && isRecent;
                });

                const cleanCloudUsers = cloudUsers.filter(u => normalizeStr(u.username) !== 'admin');
                const mergedUsers = [localAdmin, ...cleanCloudUsers, ...pendingSyncUsers];
                
                saveLocalUsers(mergedUsers);
                
                // If we auto-turned off maintenance OR have pending users, push back
                if (pendingSyncUsers.length > 0 || (cloudAdmin?.systemConfig?.maintenanceMode && now > (cloudAdmin.systemConfig.maintenanceEndTime || 0))) {
                    console.log("[Sync] Pushing back to cloud (Maintenance update or Pending users)...");
                    pushToCloud(mergedUsers, true);
                }
                return mergedUsers;
            }
        }
    } catch (e) {
        console.warn("[Sync] Network Error:", e);
    }
    return localUsers;
};

// --- 3. USER ACTIONS ---

export const getAllUsers = (): RegisteredUser[] => getLocalUsers();

export const getBroadcastAudience = async (): Promise<string[]> => {
    // Force sync to get latest users before broadcasting
    const users = await syncUsersFromCloud();
    return users
        .filter(u => u.telegramChatId && u.username !== 'admin') // Exclude admin if wanted, or include
        .map(u => u.telegramChatId as string);
};

export const registerUser = async (userData: RegisteredUser): Promise<{ success: boolean; message: string; user?: RegisteredUser }> => {
    let currentUsers = await syncUsersFromCloud();
    
    // Check Maintenance
    const config = getSystemConfig();
    if (config?.maintenanceMode) {
        const diff = config.maintenanceEndTime - Date.now();
        if (diff > 0) {
            const minutes = Math.ceil(diff / 60000);
            return { success: false, message: `Hệ thống đang bảo trì. Quay lại sau ${minutes} phút.` };
        }
    }

    const finalUsername = normalizeStr(userData.username);
    const finalEmail = normalizeStr(userData.email);

    if (!isValidUsernameFormat(userData.username)) {
        return { success: false, message: "Tên đăng nhập không hợp lệ (Chỉ chữ cái và số, không dấu, không khoảng trắng)." };
    }

    if (!isValidEmail(userData.email)) {
        return { success: false, message: "Định dạng Email không hợp lệ." };
    }

    if (userData.password && !isValidPassword(userData.password)) {
        return { success: false, message: "Mật khẩu quá ngắn (Tối thiểu 6 ký tự)." };
    }

    if (currentUsers.some(u => normalizeStr(u.email) === finalEmail)) return { success: false, message: "Email này đã được sử dụng." };
    if (currentUsers.some(u => normalizeStr(u.username) === finalUsername)) return { success: false, message: "Tên đăng nhập đã tồn tại." };
    
    if (userData.telegramChatId) {
        if (currentUsers.some(u => u.telegramChatId === userData.telegramChatId)) {
            return { success: false, message: "Telegram ID này đã dùng." };
        }
    }

    const allowedModules = [ModuleType.NEW_CREATION, ModuleType.STUDIO, ModuleType.THUMBNAIL, ModuleType.VEO_IDEAS];
    const defaultPermissions: Record<string, boolean> = {};
    Object.values(ModuleType).forEach(m => {
        defaultPermissions[m] = allowedModules.includes(m);
    });
    
    const newUser: RegisteredUser = {
        ...userData,
        username: finalUsername, // Store normalized username for consistency
        email: finalEmail,
        permissions: defaultPermissions,
        deviceId: getDeviceId(),
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

// UPDATED LOGIN LOGIC
export const loginUser = async (identifier: string, password?: string): Promise<{ success: boolean; user?: RegisteredUser; message: string; requireOtp?: boolean }> => {
    // 1. Sync first to get latest data
    await syncUsersFromCloud();
    const users = getLocalUsers();
    
    const normalizedId = normalizeStr(identifier);

    const user = users.find(u => 
        (normalizeStr(u.username) === normalizedId || normalizeStr(u.email) === normalizedId) && 
        (!password || u.password === password)
    );
    
    if (user) {
        // CASE 1: Admin - Login immediately, no OTP, no Session Lock check, BYPASS MAINTENANCE
        if (user.role === 'admin') {
            user.currentSessionId = 'admin-session'; // Static session for admin
            return { success: true, user: user, message: "Đăng nhập thành công (Admin)" };
        }

        // Check Maintenance for Normal Users (STRICT)
        const config = getSystemConfig();
        if (config?.maintenanceMode) {
            const diff = config.maintenanceEndTime - Date.now();
            if (diff > 0) {
                const minutes = Math.ceil(diff / 60000);
                return { success: false, message: `Hệ thống đang bảo trì. Quay lại sau ${minutes} phút.` };
            }
        }

        // CASE 2: User - Check Telegram, Return requireOtp
        if (!user.telegramChatId) {
            return { success: false, message: "Tài khoản chưa liên kết Telegram. Vui lòng liên hệ Admin." };
        }

        // Return user found, but require OTP. Do NOT set session ID yet.
        return { success: true, user: user, message: "Vui lòng xác thực OTP", requireOtp: true };
    }
    return { success: false, message: "Thông tin đăng nhập không chính xác" };
};

// NEW FUNCTION: Finalize Login (Called after OTP)
export const finalizeUserLogin = async (username: string): Promise<RegisteredUser | null> => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(username));
    
    if (idx !== -1) {
        // 1. Generate NEW Session ID (This invalidates any old sessions on other devices)
        const newSessionId = uuidv4();
        users[idx].currentSessionId = newSessionId;
        users[idx].deviceId = getDeviceId(); // Update Last Device ID

        // 2. Save Local
        saveLocalUsers(users);

        // 3. PUSH IMMEDIATELY TO CLOUD (Critical for locking out other devices)
        await pushToCloud(users, true);

        return users[idx];
    }
    return null;
}

// --- SESSION CHECK ---

export const isSessionValid = (username: string, sessionId: string | undefined): boolean => {
    const users = getLocalUsers(); // This reads from localStorage which implies syncUsersFromCloud updated it
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    
    if (!user) return false;
    if (user.role === 'admin') return true;

    // Strict check: Local session ID must match the one in the (synced) user object
    return user.currentSessionId === sessionId;
};

// --- DELETE & BACKUP LOGIC (SERVER-SIDE ACTIONS) ---

export const deleteUser = async (username: string): Promise<boolean> => {
    if (normalizeStr(username) === 'admin') return false;
    
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'move_to_backup',
                username: username
            })
        });
        
        const users = getLocalUsers();
        const newUsers = users.filter(u => normalizeStr(u.username) !== normalizeStr(username));
        saveLocalUsers(newUsers);
        
        return true;
    } catch (e) {
        console.error("Delete failed", e);
        return false;
    }
};

export const getBackupUsers = async (): Promise<any[]> => {
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_backups&t=${Date.now()}`, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' }
        });
        if (res.ok) {
            const json = await res.json();
            return json.status === 'success' ? json.data : [];
        }
    } catch (e) {
        console.error("Get backups failed", e);
    }
    return [];
};

export const restoreUserFromBackup = async (user: any): Promise<boolean> => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'restore_from_backup',
                username: user.username
            })
        });

        const users = getLocalUsers();
        if (!users.some(u => normalizeStr(u.username) === normalizeStr(user.username))) {
            const restoredUser: RegisteredUser = {
                username: user.username,
                email: user.email,
                password: user.password,
                role: user.role || 'user',
                isVerified: user.isVerified,
                credits: user.credits,
                permissions: user.permissions,
                createdAt: user.createdAt,
                deviceId: user.deviceId,
                telegramChatId: user.telegramChatId,
                currentSessionId: uuidv4()
            };
            users.push(restoredUser);
            saveLocalUsers(users);
        }
        
        return true;
    } catch (e) {
        console.error("Restore failed", e);
        return false;
    }
};

// --- 4. ADMIN & UTILS ---

export const adminUpdateUserInfo = async (targetUsername: string, data: { email?: string, password?: string, telegramChatId?: string }): Promise<{ success: boolean; message: string }> => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(targetUsername));
    if (idx === -1) return { success: false, message: "User not found" };
    
    if (data.email) {
        const newEmail = normalizeStr(data.email);
        if (!isValidEmail(newEmail)) return { success: false, message: "Email không hợp lệ." };
        if (newEmail !== normalizeStr(users[idx].email)) {
            if (users.some(u => normalizeStr(u.email) === newEmail)) return { success: false, message: "Email trùng." };
            users[idx].email = newEmail;
        }
    }
    if (data.telegramChatId && data.telegramChatId !== users[idx].telegramChatId) {
        if (users.some(u => u.telegramChatId === data.telegramChatId)) return { success: false, message: "Telegram ID trùng." };
        users[idx].telegramChatId = data.telegramChatId;
    } else if (data.telegramChatId === "") {
        delete users[idx].telegramChatId;
    }
    if (data.password && data.password.trim() !== "") {
        if (!isValidPassword(data.password)) return { success: false, message: "Mật khẩu không đủ mạnh." };
        users[idx].password = data.password;
    }

    saveLocalUsers(users);
    pushToCloud(users, true);
    return { success: true, message: "Cập nhật thành công" };
};

export const updateUserPermissions = async (username: string, permissions: Record<string, boolean>) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user) {
        user.permissions = permissions;
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

export const verifyUser = async (username: string, status: boolean) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user) {
        user.isVerified = status;
        if (!user.notifications) user.notifications = [];
        user.notifications.unshift({
            id: uuidv4(),
            title: status ? 'Đã Xác Minh' : 'Hủy Xác Minh',
            message: status ? 'Tài khoản được Admin xác minh.' : 'Trạng thái xác minh bị hủy.',
            type: status ? 'success' : 'warning',
            timestamp: Date.now(),
            read: false
        });
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

export const addCredits = async (username: string, amount: number) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user) {
        if (user.role === 'admin') user.credits = 999999;
        else {
            user.credits = (user.credits || 0) + amount;
            if (!user.notifications) user.notifications = [];
            user.notifications.unshift({
                id: uuidv4(),
                title: 'Biến động số dư',
                message: `${amount > 0 ? '+' : ''}${amount} điểm. Số dư: ${user.credits}.`,
                type: amount > 0 ? 'success' : 'warning',
                timestamp: Date.now(),
                read: false
            });
        }
        saveLocalUsers(users);
        pushToCloud(users, true);
    }
};

export const checkUsageLimit = (username: string, module: string, cost: number = 1): { allowed: boolean; message?: string } => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (!user) return { allowed: false, message: "User not found" };
    if (user.role === 'admin' || user.isVerified) return { allowed: true };
    if ((user.credits || 0) >= cost) return { allowed: true };
    return { allowed: false, message: "Số dư không đủ." };
};

export const incrementUsage = (username: string, module: string, cost: number = 1) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user && user.role !== 'admin' && !user.isVerified) {
        const newBalance = (user.credits || 0) - cost;
        user.credits = Math.max(0, newBalance);
    }
    saveLocalUsers(users);
    pushToCloud(users, false);
};

export const getUserNotifications = (username: string): AppNotification[] => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    return user?.notifications || [];
};

export const markNotificationsRead = (username: string) => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (user && user.notifications) {
        user.notifications = user.notifications.map(n => ({...n, read: true}));
        saveLocalUsers(users);
        pushToCloud(users, false);
    }
};

export const updateUserCredentials = async (currentUsername: string, newUsername?: string, newPassword?: string, telegramChatId?: string): Promise<{ success: boolean; message: string; user?: RegisteredUser }> => {
    const users = getLocalUsers();
    const idx = users.findIndex(u => normalizeStr(u.username) === normalizeStr(currentUsername));
    if (idx === -1) return { success: false, message: "User not found" };

    if (newUsername) {
        const finalNewUsername = normalizeStr(newUsername);
        if (finalNewUsername !== normalizeStr(currentUsername)) {
            if (!isValidUsernameFormat(finalNewUsername)) return { success: false, message: "Tên mới chứa ký tự không hợp lệ (Chỉ a-z, 0-9)." };
            if (users.some(u => normalizeStr(u.username) === finalNewUsername)) return { success: false, message: "Tên đăng nhập đã tồn tại" };
            users[idx].username = finalNewUsername;
        }
    }
    
    if (newPassword) {
        if (!isValidPassword(newPassword)) return { success: false, message: "Mật khẩu mới quá ngắn." };
        users[idx].password = newPassword;
    }
    
    if (telegramChatId !== undefined) {
        if (telegramChatId === "") delete users[idx].telegramChatId;
        else {
            if (users.some(u => u.telegramChatId === telegramChatId && normalizeStr(u.username) !== normalizeStr(currentUsername))) {
                return { success: false, message: "Telegram ID này đã liên kết tài khoản khác." };
            }
            users[idx].telegramChatId = telegramChatId;
        }
    }

    saveLocalUsers(users);
    pushToCloud(users, true);
    return { success: true, message: "Cập nhật thành công", user: users[idx] };
};

export const resetPassword = async (username: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const users = getLocalUsers();
    const user = users.find(u => normalizeStr(u.username) === normalizeStr(username));
    if (!user) return { success: false, message: "Không tìm thấy người dùng." };
    user.password = newPassword;
    saveLocalUsers(users);
    pushToCloud(users, true);
    return { success: true, message: "Đã đặt lại mật khẩu thành công." };
};

export const findUserByContact = async (input: string): Promise<RegisteredUser | null> => {
    const users = await syncUsersFromCloud();
    const normalizedInput = normalizeStr(input);
    return users.find(u => normalizeStr(u.username) === normalizedInput || normalizeStr(u.email) === normalizedInput) || null;
};
