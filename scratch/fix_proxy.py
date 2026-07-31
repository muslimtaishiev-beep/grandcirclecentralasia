with open('server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

import re
old_fetch = r'''    const fetchRes = await fetch\(gasUrl, \{
      method: "POST",
      headers: \{ "Content-Type": "text/plain;charset=utf-8" \},
      body: JSON.stringify\(payload\)
    \}\);
    const data = await fetchRes.json\(\);'''

new_fetch = r'''    const fetchRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    
    const rawText = await fetchRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch(e) {
      console.error("GAS Proxy parse error. Raw HTML:", rawText.substring(0, 500));
      return res.status(500).json({ error: "GAS returned an invalid response (likely an HTML error page). This usually means the Google Apps Script crashed, hit a quota, or requires re-deployment." });
    }'''

content = re.sub(old_fetch, new_fetch, content)

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(content)
