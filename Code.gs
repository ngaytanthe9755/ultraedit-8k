
// Google Apps Script Proxy for UltraEdit 8K
// This file is used to sync data between the App and Google Sheets

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'get_users') {
    return handleGetUsers();
  }
  
  if (action === 'get_backups') {
    return handleGetBackups();
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "ok", message: "Service is online"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    
    if (action === 'save') {
      return handleSaveData(requestData.data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Unknown action"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleGetUsers() {
  // Logic to read from spreadsheet
  return ContentService.createTextOutput(JSON.stringify({status: "success", data: []}))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSaveData(data) {
  // Logic to write to spreadsheet
  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}
