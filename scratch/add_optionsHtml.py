import json
import re

with open('scratch/math_updates.json', 'r', encoding='utf-8') as f:
    updates = json.load(f)

# Wait, we need to check if scratch/math10_questions.json exists, to do it for grade 10 as well!
# The user said "в матеше 8-11 классов".
with open('scratch/math10_questions.json', 'r', encoding='utf-8') as f:
    math10_updates = json.load(f)

updates["10"] = math10_updates

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
                opt_text_esc = opt_text.replace('"', '\\"')
                options_arr.append(f'"{opt_text_esc}"')
            ts_str += f'        options: [{", ".join(options_arr)}],\n'
            
            if "optionsHtml" in q:
                options_html_arr = []
                for opt_html in q["optionsHtml"]:
                    opt_html_esc = opt_html.replace('"', '\\"')
                    options_html_arr.append(f'"{opt_html_esc}"')
                ts_str += f'        optionsHtml: [{", ".join(options_html_arr)}]\n'
        
        # Remove trailing comma on last item before `}`
        if ts_str.endswith(',\n'):
            ts_str = ts_str[:-2] + '\n'
            
        ts_str += "      },"
        
    ts_str += "\n    ],\n    logic: commonLogicQuestions,"

    pattern = rf'"{grade}":\s*\{{.*?math:\s*\[.*?],\s*logic:\s*commonLogicQuestions,'
    
    def repl(m):
        full_match = m.group(0)
        math_idx = full_match.find('math: [')
        return full_match[:math_idx] + ts_str

    ts_content, count = re.subn(pattern, repl, ts_content, flags=re.DOTALL)
    print(f"testsData grade {grade}: replaced {count} times.")

with open('src/data/testsData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

