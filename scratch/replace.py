import json
import re

with open('scratch/math_updates.json', 'r', encoding='utf-8') as f:
    updates = json.load(f)

# Update testsData.ts
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
            if "optionsHtml" in q:
                for opt_text, opt_html in zip(q["options"], q["optionsHtml"]):
                    opt_html_esc = opt_html.replace('"', '\\"')
                    options_arr.append(f'"{opt_html_esc}"')
            else:
                for opt_text in q["options"]:
                    opt_text_esc = opt_text.replace('"', '\\"')
                    options_arr.append(f'"{opt_text_esc}"')
            ts_str += f'        options: [{", ".join(options_arr)}]\n'
        ts_str += "      },"
    ts_str += "\n    ],\n    logic: commonLogicQuestions,"

    # Find the section and replace it
    pattern = rf'"{grade}":\s*\{{.*?math:\s*\[.*?],\s*logic:\s*commonLogicQuestions,'
    
    def repl(m):
        full_match = m.group(0)
        # Find where math: [ starts inside this match
        math_idx = full_match.find('math: [')
        # return everything before math: [ + new math array
        return full_match[:math_idx] + ts_str

    ts_content, count = re.subn(pattern, repl, ts_content, flags=re.DOTALL)
    print(f"testsData grade {grade}: replaced {count} times.")

with open('src/data/testsData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

# Update Code.gs
with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    gs_content = f.read()

for grade, math_q in updates.items():
    gs_str = '    "math": {\n'
    for q in math_q:
        if q.get("type") == "free_text":
            ans_text_esc = q["ans"].replace('"', '\\"')
        else:
            ans_text_esc = q["options"][int(q["ans"]) - 1].replace('"', '\\"')
        gs_str += f'      "{q["id"]}": {{ ans: "{ans_text_esc}", pts: 1 }},\n'
    gs_str += "    }\n  },"

    # Pattern to match the whole grade block in GS:
    # "11": {
    #   "russian": { ... },
    #   "math": { ... }
    # },
    # Since grade blocks end with `  },`, we match up to that.
    
    pattern_gs = rf'"{grade}":\s*\{{.*?"math":\s*\{{.*?\}}\s*\}},'
    
    def repl_gs(m):
        full_match = m.group(0)
        # If there's an issue matching exactly, find where "math": { starts
        math_idx = full_match.find('"math": {')
        if math_idx == -1:
            math_idx = full_match.find('math: {')
        return full_match[:math_idx] + gs_str

    gs_content_new, count = re.subn(pattern_gs, repl_gs, gs_content, flags=re.DOTALL)
    if count == 0:
        # Try without the trailing comma
        pattern_gs = rf'"{grade}":\s*\{{.*?"math":\s*\{{.*?\}}\s*\}}'
        gs_content_new, count = re.subn(pattern_gs, repl_gs, gs_content, flags=re.DOTALL)
    gs_content = gs_content_new
    print(f"Code.gs grade {grade}: replaced {count} times.")

with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
    f.write(gs_content)

