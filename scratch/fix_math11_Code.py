import re

with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix ma_4_11
content = content.replace('"ma_4_11": { ans: "[-2; -1,5] ∪ (1,75; +∞)", pts: 1 }', '"ma_4_11": { ans: "[-2;-1,5]u(1,75;+infty)", pts: 1 }')

# Fix ma_6_11
content = content.replace('"ma_6_11": { ans: "6xcos x - 3x^2sin x", pts: 1 }', '"ma_6_11": { ans: "6xcosx-3x^2sinx", pts: 1 }')

# Add normalizeString for U
content = content.replace('s = s.replace(/\\\\text/g, "").replace(/[{}]/g, "");', 's = s.replace(/\\\\text/g, "").replace(/[{}]/g, "");\n  s = s.replace(/∪/g, "u");')

with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)

