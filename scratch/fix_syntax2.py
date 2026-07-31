import re
with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace any occurrence of two closing braces where the logic block starts
# i.e. 
#   },
#         "logic": {
# with:
#     },
#         "logic": {
# This is equivalent to removing the indentation difference. But wait, if it was `},` followed by `"logic": {` with any whitespace:
content = re.sub(r'  \},\s*"logic": \{', r'    },\n        "logic": {', content)

with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)

