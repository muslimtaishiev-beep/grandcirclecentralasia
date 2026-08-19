import re
import json

with open("/Users/muslimtaishiev/antigravity/The-Main-Educational-Event-of-the-Year/src/data/testsData.ts", "r", encoding="utf-8") as f:
    tests_code = f.read()

with open("/Users/muslimtaishiev/antigravity/The-Main-Educational-Event-of-the-Year/scratch/Code_final.gs", "r", encoding="utf-8") as f:
    gs_code = f.read()

# Let's extract ANSWER_KEYS from Code_final.gs
# We can evaluate or parse ANSWER_KEYS block
keys_match = re.search(r'const ANSWER_KEYS = (\{.*?\n\};)', gs_code, re.DOTALL)
if not keys_match:
    print("Could not find ANSWER_KEYS")
    exit(1)

keys_raw = keys_match.group(1)

# Let's write a python script that will parse JS objects safely or use Node.js to get exact objects!
# Node.js can import/eval both js objects directly or convert to JSON!
