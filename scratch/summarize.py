import json

with open("/Users/muslimtaishiev/antigravity/The-Main-Educational-Event-of-the-Year/scratch/report_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("=== DENOMINATORS SUMMARY ===")
for g, info in data["denominators"].items():
    print(f"Grade {g}: FE Core = {info['totalFeCorePts']}, BE Core = {info['totalBeCorePts']} | FE Eng = {info['totalFeEngPts']}, BE Eng = {info['totalBeEngPts']}")
    for s, sinfo in info["subjDenoms"].items():
        print(f"   - {s}: FE {sinfo['feCount']} q ({sinfo['fePoints']} pts) vs BE {sinfo['beCount']} k ({sinfo['bePoints']} pts)")

print("\n=== ORPHAN KEYS IN BE (10 TOTAL) ===")
for o in data["orphanKeys"]:
    print(f"Grade {o['grade']} [{o['subject']}] {o['id']}: key = '{o['keyAns']}'")

print("\n=== QUESTION VS KEY TABLE COUNT ===", len(data["questionVsKeyTable"]))
