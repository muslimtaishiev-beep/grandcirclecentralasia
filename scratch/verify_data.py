import re
import json

# Let's read testsData.ts and Code_final.gs
with open("/Users/muslimtaishiev/antigravity/The-Main-Educational-Event-of-the-Year/src/data/testsData.ts", "r", encoding="utf-8") as f:
    tests_code = f.read()

with open("/Users/muslimtaishiev/antigravity/The-Main-Educational-Event-of-the-Year/scratch/Code_final.gs", "r", encoding="utf-8") as f:
    gs_code = f.read()

print("Files loaded successfully.")
