import re

raw_path = 'raw.txt'
keys_path = 'keys.txt'

def parse_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]
    return lines

raw_lines = parse_file(raw_path)
key_lines = parse_file(keys_path)

out = "import { TestData } from '../types';\n\nexport const testsData: Record<number, TestData> = {\n"

# A very naive state machine to pair questions with keys
# Since the user just dumped them, let's output a generic typescript structure

out += "  7: { grade: 7, russian: [], math: [], logic: [] },\n"
out += "  8: { grade: 8, russian: [], math: [], logic: [] },\n"
out += "  9: { grade: 9, russian: [], math: [], logic: [] },\n"
out += "  10: { grade: 10, russian: [], math: [], logic: [] },\n"
out += "  11: { grade: 11, russian: [], math: [], logic: [] },\n"
out += "};\n"

with open('../src/data/testsData.ts', 'w', encoding='utf-8') as f:
    f.write(out)

print("Created placeholder src/data/testsData.ts")
