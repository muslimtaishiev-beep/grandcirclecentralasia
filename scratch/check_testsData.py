import json

with open('src/data/testsData.ts', 'r') as f:
    data = f.read()

count = data.count('topic:')
print(f"Has topic in testsData.ts: {count}")
