const fs = require('fs');
const p = 'scratch/Code.gs';
let content = fs.readFileSync(p, 'utf8');

const target = `function doPost(e) {
  // CORS setup
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    const spreadsheetId = "1aZ7O1F7m-yN8K-pX4a6T3r0Z_jL9kE6c_uI2_qR5";`;

const replacement = `const VALID_API_KEY = "GRAND_CIRCLE_SECURE_API_KEY_2026";

function doPost(e) {
  // CORS setup
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    const publicActions = ["submitTest", "getStudentByShortId"];
    if (!publicActions.includes(action)) {
      if (payload.apiKey !== VALID_API_KEY) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const spreadsheetId = "1aZ7O1F7m-yN8K-pX4a6T3r0Z_jL9kE6c_uI2_qR5";`;

content = content.replace(target, replacement);
fs.writeFileSync(p, content);
console.log('Done');
