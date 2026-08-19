import json

with open("/Users/muslimtaishiev/antigravity/The-Main-Educational-Event-of-the-Year/scratch/report_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for g in ["7", "8"]:
    print(f"=== GRADE {g} CORE PAYLOAD ===")
    print(data["samplePayloads"][g]["corePayloadStr"])
    print(f"\n=== GRADE {g} ENGLISH PAYLOAD ===")
    print(data["samplePayloads"][g]["englishPayloadStr"])
    print("\n" + "="*50 + "\n")
