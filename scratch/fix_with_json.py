import re
import json

with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# We know the grades are "11", "10", "9", "8", "7".
# They are all inside ANSWER_KEYS.
# The syntax error is because there are too many closing brackets.
# Let's just fix the trailing comma / bracket issue directly.
# The bad pattern in Code.gs is:
#     "ma_22_8": { ans: "156000", pts: 1 },
#    }
#  },
#        "logic": {

content = content.replace("    }\n  },\n        \"logic\": {", "    },\n        \"logic\": {")
content = content.replace("    }\n  },\n    \"logic\": {", "    },\n    \"logic\": {")
content = content.replace("    }\n  },\n  \"logic\": {", "    },\n  \"logic\": {")
content = content.replace("    }\n  },\n\"logic\": {", "    },\n\"logic\": {")

# Let's try matching with regex
content = re.sub(r'    \}\n  \},\n\s*"logic": \{', r'    },\n        "logic": {', content)

with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)

