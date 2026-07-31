import json
import re

with open('scratch/math_updates.json', 'r', encoding='utf-8') as f:
    updates = json.load(f)

with open('src/data/testsData.ts', 'r', encoding='utf-8') as f:
    ts_content = f.read()

for grade, math_q in updates.items():
    ts_str = '    math: [\n'
    for q in math_q:
        ts_str += "      {\n"
        ts_str += f'        id: "{q["id"]}",\n'
        qtype = q.get("type", "multiple_choice")
        ts_str += f'        type: "{qtype}",\n'
        ts_str += f'        points: 1,\n'
        text_escaped = q["text"].replace('"', '\\"')
        ts_str += f'        text: "{text_escaped}",\n'
        html_escaped = q["html"].replace('"', '\\"')
        ts_str += f'        html: "{html_escaped}",\n'
        
        if "options" in q:
            options_arr = []
            for opt_text in q["options"]:
                # ONLY use plain text options for testsData.ts
                opt_text_esc = opt_text.replace('"', '\\"')
                options_arr.append(f'"{opt_text_esc}"')
            ts_str += f'        options: [{", ".join(options_arr)}]\n'
        ts_str += "      },"
    ts_str += "\n    ],\n    logic: commonLogicQuestions,"

    # Find the section and replace it
    pattern = rf'"{grade}":\s*\{{.*?math:\s*\[.*?],\s*logic:\s*commonLogicQuestions,'
    
    def repl(m):
        full_match = m.group(0)
        math_idx = full_match.find('math: [')
        return full_match[:math_idx] + ts_str

    ts_content, count = re.subn(pattern, repl, ts_content, flags=re.DOTALL)
    print(f"testsData grade {grade}: replaced {count} times.")

with open('src/data/testsData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

