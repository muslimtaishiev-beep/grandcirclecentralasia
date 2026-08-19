const https = require('https');
const scriptUrl = "https://script.google.com/macros/s/AKfycbymI1U53npCYIscbcWG-0Cflkop2u7KocPvXY_yUSjJlDscQ8FkoYDXOTh2uNlpQHPr/exec";

// Try a couple common shortIds or ask for one?
// Let's just getAllStudents!
const payload = {
  action: "getAllStudents",
  apiKey: "GRAND_CIRCLE_SECURE_API_KEY_2026"
};

const req = https.request(scriptUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    https.request(res.headers.location, { method: 'GET' }, (redirectRes) => {
      let data = '';
      redirectRes.on('data', chunk => data += chunk);
      redirectRes.on('end', () => console.log('Students:', data.substring(0, 1000) + '...'));
    }).end();
  }
});
req.write(JSON.stringify(payload));
req.end();
