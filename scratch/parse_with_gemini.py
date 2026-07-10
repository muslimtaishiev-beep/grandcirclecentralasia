import os
import json
import urllib.request
import urllib.parse

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    with open(".env") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip()

with open("scratch/raw_tests.txt", "r") as f:
    text = f.read()

prompt = """
You are an expert data parser. You are given the raw text of 5 tests (grades 7, 8, 9, 10, 11).
Your task is to parse this ENTIRE text into a valid JSON object matching the `Record<number, TestData>` structure.
DO NOT shorten, summarize, or truncate the questions. Keep the exact text the user provided.
If there are options (e.g. A, B, C, D or listed out), put them in the `options` array and set `type` to "multiple_choice".
If there are no explicit options, set `type` to "free_text".
The correctAnswer for free text should just be left blank or put a placeholder if not found. But the user did provide some keys earlier, just put something logical or empty string if you aren't sure. The text contains the questions.
IMPORTANT: Return ONLY valid JSON. No markdown formatting, no ` ```json `, just the raw JSON object.
Structure:
{
  "7": {
    "grade": 7,
    "russian": [{"id": "ru_7_1", "type": "multiple_choice", "points": 1, "text": "...", "options": ["A", "B", "C"], "correctAnswer": ""}, ...],
    "math": [...],
    "logic": [...]
  },
  "8": { ... },
  "9": { ... },
  "10": { ... },
  "11": { ... }
}

Raw Text:
""" + text

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={API_KEY}"
data = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {"temperature": 0.1}
}

req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
with urllib.request.urlopen(req, context=ctx) as response:
    result = json.loads(response.read().decode("utf-8"))

output_text = result["candidates"][0]["content"]["parts"][0]["text"]
if output_text.startswith("```json"):
    output_text = output_text[7:]
if output_text.endswith("```"):
    output_text = output_text[:-3]
output_text = output_text.strip()

out = "import { TestData } from '../types';\n\nexport const testsData: Record<number, TestData> = "
out += output_text
out += ";\n"

with open("src/data/testsData.ts", "w", encoding="utf-8") as f:
    f.write(out)

print("Successfully generated testsData.ts")
