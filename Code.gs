
// --- CẤU HÌNH ---
var BOT_TOKEN = ""; // Sẽ được set qua action setup_bot hoặc hardcode nếu cần
var SCRIPT_ID = ScriptApp.getScriptId();
var WEB_URL = ScriptApp.getService().getUrl();

// Tên các Sheet
var SHEET_USERS = "Account";
var SHEET_BACKUP = "BackUpUser";

// --- XỬ LÝ REQUEST (DO POST) ---
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Đợi tối đa 10s để tránh xung đột ghi

  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'save') {
      // Lưu danh sách user từ Client lên Sheet
      var sheet = ss.getSheetByName(SHEET_USERS);
      if (!sheet) sheet = ss.insertSheet(SHEET_USERS);
      
      var data = params.data; // Mảng User
      if (!data || data.length === 0) return createJSONOutput("success", "No data to save");

      // Xóa dữ liệu cũ (trừ header)
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      } else if (sheet.getLastRow() === 0) {
        // Tạo header nếu chưa có
        sheet.appendRow(["DATA"]); 
      }

      // Ghi dữ liệu mới (Lưu toàn bộ JSON object vào cột A để đơn giản hóa)
      // Cách này giúp tránh việc phải map từng cột, và hỗ trợ cấu trúc dữ liệu linh động
      var rows = data.map(function(user) {
        return [JSON.stringify(user)];
      });
      
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 1).setValues(rows);
      }
      
      return createJSONOutput("success", "Saved " + rows.length + " users.");
    }

    if (action === 'move_to_backup') {
      var username = params.username;
      var sheetUser = ss.getSheetByName(SHEET_USERS);
      var sheetBackup = ss.getSheetByName(SHEET_BACKUP);
      if (!sheetBackup) sheetBackup = ss.insertSheet(SHEET_BACKUP);

      var data = sheetUser.getDataRange().getValues();
      var newData = [];
      var found = false;

      // Header
      newData.push(data[0]);

      for (var i = 1; i < data.length; i++) {
        var rowContent = data[i][0];
        try {
          var userObj = JSON.parse(rowContent);
          if (userObj.username.toLowerCase() === username.toLowerCase()) {
            // Move to backup
            userObj.deletedAt = new Date().toISOString();
            sheetBackup.appendRow([JSON.stringify(userObj)]);
            found = true;
          } else {
            newData.push([rowContent]);
          }
        } catch (e) {
          newData.push([rowContent]); // Giữ lại dòng lỗi
        }
      }

      if (found) {
        // Ghi lại Sheet User
        sheetUser.clearContents();
        sheetUser.getRange(1, 1, newData.length, 1).setValues(newData);
        return createJSONOutput("success", "User moved to backup");
      }
      return createJSONOutput("error", "User not found");
    }

    if (action === 'restore_from_backup') {
      var username = params.username;
      var sheetBackup = ss.getSheetByName(SHEET_BACKUP);
      var sheetUser = ss.getSheetByName(SHEET_USERS);
      
      var data = sheetBackup.getDataRange().getValues();
      var newData = [];
      var userToRestore = null;

      // Header
      newData.push(data[0]);

      for (var i = 1; i < data.length; i++) {
        var rowContent = data[i][0];
        try {
          var userObj = JSON.parse(rowContent);
          if (userObj.username.toLowerCase() === username.toLowerCase()) {
            userToRestore = rowContent; // JSON string
          } else {
            newData.push([rowContent]);
          }
        } catch (e) {
          newData.push([rowContent]);
        }
      }

      if (userToRestore) {
        // Cập nhật lại sheet Backup (đã xóa user đó)
        sheetBackup.clearContents();
        if (newData.length > 0) {
            sheetBackup.getRange(1, 1, newData.length, 1).setValues(newData);
        }
        // Thêm vào sheet User
        sheetUser.appendRow([userToRestore]);
        return createJSONOutput("success", "User restored");
      }
      return createJSONOutput("error", "User not found in backup");
    }

    // TELEGRAM WEBHOOK HANDLER
    // Telegram gửi update object trực tiếp, không bọc trong `params`
    try {
        var update = JSON.parse(e.postData.contents);
        if (update.message) {
            handleTelegramMessage(update.message);
            return ContentService.createTextOutput("OK");
        }
    } catch(err) {
        // Bỏ qua nếu không phải telegram update
    }

  } catch (e) {
    return createJSONOutput("error", e.toString());
  } finally {
    lock.releaseLock();
  }
}

// --- XỬ LÝ REQUEST (DO GET) ---
function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'get_users') {
    var sheet = ss.getSheetByName(SHEET_USERS);
    if (!sheet) return createJSONOutput("success", [], []); // Sheet chưa tồn tại
    
    var data = sheet.getDataRange().getValues();
    var users = [];
    
    // Bỏ qua header (row 0), bắt đầu từ row 1
    for (var i = 1; i < data.length; i++) {
      var jsonStr = data[i][0];
      if (jsonStr) {
        try {
          users.push(JSON.parse(jsonStr));
        } catch (err) {}
      }
    }
    return createJSONOutput("success", "Fetched", users);
  }

  if (action === 'get_backups') {
    var sheet = ss.getSheetByName(SHEET_BACKUP);
    if (!sheet) return createJSONOutput("success", [], []);
    
    var data = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      var jsonStr = data[i][0];
      if (jsonStr) {
        try {
          users.push(JSON.parse(jsonStr));
        } catch (err) {}
      }
    }
    return createJSONOutput("success", "Fetched backups", users);
  }

  if (action === 'send_telegram_otp') {
    var chatId = e.parameter.chatId;
    var message = e.parameter.message;
    var type = e.parameter.type || 'generic'; // 'register', 'admin', 'maintenance', 'update'
    
    // Lấy Bot Token từ Script Properties (Cài đặt thủ công lần đầu hoặc qua setup_bot)
    var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    if (!token) return createJSONOutput("error", "Bot Token not configured");

    var url = "https://api.telegram.org/bot" + token + "/sendMessage";
    var payload = {
      "chat_id": chatId,
      "text": message,
      "parse_mode": "HTML"
    };

    try {
      var response = UrlFetchApp.fetch(url, {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload)
      });
      return createJSONOutput("success", "Message sent");
    } catch (err) {
      return createJSONOutput("error", err.toString());
    }
  }

  if (action === 'setup_bot') {
    // Hàm này giúp set Webhook tự động nếu chưa set
    // Cần truyền bot token vào param hoặc nó sẽ lấy từ Properties
    var token = e.parameter.token || PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    if (!token) return createJSONOutput("error", "Missing token");
    
    PropertiesService.getScriptProperties().setProperty('BOT_TOKEN', token);
    
    var url = "https://api.telegram.org/bot" + token + "/setWebhook?url=" + WEB_URL;
    var response = UrlFetchApp.fetch(url);
    return createJSONOutput("success", response.getContentText());
  }

  if (action === 'get_bot_info') {
    var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    if (!token) return createJSONOutput("error", "Bot Token missing");
    
    var url = "https://api.telegram.org/bot" + token + "/getMe";
    try {
        var response = UrlFetchApp.fetch(url);
        return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return createJSONOutput("error", e.toString());
    }
  }

  return createJSONOutput("error", "Invalid action");
}

// --- HELPER FUNCTIONS ---

function createJSONOutput(status, message, data) {
  var output = {
    status: status,
    message: message,
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}

function handleTelegramMessage(msg) {
    // Xử lý khi user chat với bot (ví dụ: /start để lấy ID)
    var chatId = msg.chat.id;
    var text = msg.text;
    var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    
    if (text === '/start' || text.indexOf('/start') === 0) {
        var reply = "👋 Chào mừng bạn đến với <b>UltraEdit 8K Bot</b>!\n\n🆔 Chat ID của bạn là: <code>" + chatId + "</code>\n\n(Sao chép số trên và dán vào ứng dụng để xác thực)";
        var url = "https://api.telegram.org/bot" + token + "/sendMessage";
        UrlFetchApp.fetch(url, {
            "method": "post",
            "contentType": "application/json",
            "payload": JSON.stringify({
                "chat_id": chatId,
                "text": reply,
                "parse_mode": "HTML"
            })
        });
    }
}
