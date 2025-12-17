
// URL của Google Apps Script (Đã cập nhật theo yêu cầu của bạn)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzMumXFKOnLOr-R6VJlF7pTw9JL9Ynh92573Dpbc4ztfRLnQHjRhooa2israF_lAnW6hw/exec";

// Local storage cache username bot
const LS_BOT_USERNAME = 'ue_cached_bot_username';

export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getBotInfo = async (): Promise<{ username: string; firstName: string } | null> => {
    const cachedUsername = localStorage.getItem(LS_BOT_USERNAME);
    if (cachedUsername) {
        return { username: cachedUsername, firstName: "UltraEdit Bot" };
    }

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_bot_info&t=${Date.now()}`, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' }
        });
        
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (data.result && data.result.username) {
                localStorage.setItem(LS_BOT_USERNAME, data.result.username);
                return { username: data.result.username, firstName: data.result.first_name || "Bot" };
            }
        } catch (e) {
            console.warn("getBotInfo invalid JSON:", text);
        }
        return null;
    } catch (e) {
        console.error("Failed to get bot info", e);
        return null;
    }
};

export const sendTelegramMessage = async (chatId: string, message: string, type: string = 'generic'): Promise<{ success: boolean; error?: string }> => {
    try {
        const params = new URLSearchParams({
            action: 'send_telegram_otp',
            chatId: chatId,
            message: message,
            type: type
        });

        const url = `${GOOGLE_SCRIPT_URL}?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow', 
            headers: { 'Content-Type': 'text/plain' } // Quan trọng để tránh CORS preflight
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Telegram Response Error (Not JSON):", text);
            return { success: false, error: `Lỗi Server: ${text.substring(0, 50)}...` };
        }

        if (data.status === 'success') {
            return { success: true };
        } else {
            return { success: false, error: data.error || data.message || "Lỗi từ Server" };
        }

    } catch (e: any) {
        console.error("Telegram Send Error:", e);
        return { success: false, error: "Không thể kết nối đến Bot Server." };
    }
};

export const setupBotWebhook = async (): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=setup_bot&t=${Date.now()}`, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' }
        });
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.warn("Setup Webhook Response not JSON:", text);
            // Relaxed check: if text contains "success" or similar positive keywords
            const lower = text.toLowerCase();
            if (lower.includes("success") || lower.includes("done") || lower.includes("ok") || lower.includes("hook set")) {
                 return { success: true, message: `Kết nối thành công! Server: ${text}` };
            }
            return { 
                success: false, 
                message: `Server trả về lỗi định dạng: "${text.substring(0, 100)}..."` 
            };
        }

        if (data.status === 'success') {
            return { success: true, message: "Đã kết nối Bot thành công!" };
        } else {
            return { success: false, message: data.message || "Lỗi kết nối Webhook." };
        }
    } catch (e: any) {
        return { success: false, message: "Lỗi mạng hoặc Server không phản hồi." };
    }
};

export const sendOTP = async (chatId: string, code: string, type: 'register' | 'recovery' | 'admin'): Promise<{ success: boolean; error?: string }> => {
    let title = "";
    if (type === 'register') title = "🔐 <b>UltraEdit 8K - Gemini Pro Suite: OTP Xác Thực Bảo Mật</b>";
    if (type === 'recovery') title = "🆘 <b>Khôi phục Mật khẩu</b>";
    if (type === 'admin') title = "🛡️ <b>Xác thực Admin</b>";

    const message = `${title}\n\nMã OTP: <code>${code}</code>\n\n(Hết hạn sau 5 phút)`;
    
    return await sendTelegramMessage(chatId, message, type);
};

export const sendMaintenanceNotification = async (chatIds: string[], durationMinutes: number): Promise<{ success: boolean; count: number }> => {
    const title = "⚠️ <b>THÔNG BÁO BẢO TRÌ HỆ THỐNG</b>";
    const endTime = new Date(Date.now() + durationMinutes * 60000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const message = `${title}\n\nỨng dụng UltraEdit 8K sẽ tạm dừng để bảo trì và nâng cấp.\n\n⏱️ <b>Thời gian dự kiến:</b> ${durationMinutes} phút\n⏰ <b>Hoạt động lại lúc:</b> ${endTime}\n\nTrong thời gian này, quý khách sẽ không thể đăng nhập hoặc đăng ký mới.\n\nXin lỗi vì sự bất tiện này.`;
    
    let successCount = 0;
    // Broadcast loop - with small delay to avoid browser blocking
    for (const id of chatIds) {
        const res = await sendTelegramMessage(id, message, 'maintenance');
        if (res.success) successCount++;
        // Tiny delay
        await new Promise(r => setTimeout(r, 100));
    }
    return { success: true, count: successCount };
};

export const sendUpdateNotification = async (chatIds: string[], version: string, notes: string): Promise<{ success: boolean; count: number }> => {
    const title = "🚀 <b>BẢN CẬP NHẬT MỚI ĐÃ HOẠT ĐỘNG!</b>";
    
    // 1. Get Bot Username to construct Mini App Deep Link
    // Priority: Env Variable -> Local Cache -> Network Fetch
    let botUsername = process.env.TELEGRAM_BOT_USERNAME;
    
    if (!botUsername) {
        botUsername = localStorage.getItem(LS_BOT_USERNAME) || undefined;
    }
    
    if (!botUsername) {
        const info = await getBotInfo();
        if (info) botUsername = info.username;
    }

    // 2. Construct Link: https://t.me/<bot_username>/app 
    // This deep link format forces Telegram to open the Mini App internal window
    const appLink = botUsername 
        ? `https://t.me/${botUsername}/app` 
        : "https://gemini-ultraedit-8k.web.app";

    // Format notes to be bullet points if needed or respect newlines
    const formattedNotes = notes.split('\n').map(line => line.trim().startsWith('-') ? line : `• ${line}`).join('\n');
    
    const message = `${title}\n\n<b>Phiên bản:</b> ${version}\n\n<b>Chi tiết thay đổi:</b>\n${formattedNotes}\n\n✅ Hệ thống đã hoạt động bình thường.\n👉 Truy cập ngay: <a href="${appLink}">UltraEdit 8K</a>`;
    
    let successCount = 0;
    for (const id of chatIds) {
        const res = await sendTelegramMessage(id, message, 'update');
        if (res.success) successCount++;
        await new Promise(r => setTimeout(r, 100));
    }
    return { success: true, count: successCount };
};
