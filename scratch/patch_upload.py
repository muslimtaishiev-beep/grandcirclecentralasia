with open('scratch/Code_Fixed.gs', 'r') as f:
    code = f.read()

upload_logic = """
    if (action === "uploadPdf") {
      const { shortId, childName, base64Data } = data;
      const FOLDER_NAME = "Аналитика Академия Будущих Лидеров";
      let folders = DriveApp.getFoldersByName(FOLDER_NAME);
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(FOLDER_NAME);
      }
      
      let base64String = base64Data;
      if (base64String.indexOf("base64,") !== -1) {
        base64String = base64String.split("base64,")[1];
      }
      
      const decoded = Utilities.base64Decode(base64String);
      const safeName = sanitize(childName || shortId);
      const blob = Utilities.newBlob(decoded, "application/pdf", `Аналитика_${safeName}_${shortId}.pdf`);
      
      const file = folder.createFile(blob);
      const fileUrl = file.getUrl();
      
      // Update CRM sheet with the PDF link (Column 22 - V)
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (String(crmData[i][4]) === String(shortId)) {
          safeSetValue(crmSheet, i + 1, 22, fileUrl);
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, url: fileUrl })).setMimeType(ContentService.MimeType.JSON);
    }
"""

if "uploadPdf" not in code:
    code = code.replace('return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);', upload_logic + '\n    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);')

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(code)

print("Added uploadPdf back")
