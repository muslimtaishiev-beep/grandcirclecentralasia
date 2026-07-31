with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# I want to replace:
#   },
#         "logic": {
# with:
#     },
#         "logic": {

content = content.replace('  },\n        "logic": {', '    },\n        "logic": {')

with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)

