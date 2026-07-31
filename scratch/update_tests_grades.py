import json

with open('scratch/math_updates.json', 'r', encoding='utf-8') as f:
    updates = json.load(f)

with open('src/data/testsData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

for grade, math_q in updates.items():
    # Build the JS string for testsData.ts
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
                    opt_text_esc = opt_text.replace('"', '\\"')
                    opt_html_esc = opt_html.replace('"', '\\"')
                    options_arr.append(f'"{opt_html_esc}"')
            else:
                for opt_text in q["options"]:
                    opt_text_esc = opt_text.replace('"', '\\"')
                    options_arr.append(f'"{opt_text_esc}"')
            ts_str += f'        options: [{", ".join(options_arr)}]\n'
        ts_str += "      },\n"
    ts_str += "    ],\n"

    # Replace in testsData.ts
    start_idx = content.find(f'"{grade}": {{')
    if start_idx != -1:
        math_start = content.find('math: [', start_idx)
        if math_start != -1:
            bracket_count = 0
            math_end = -1
            for i in range(math_start + 6, len(content)):
                if content[i] == '[':
                    bracket_count += 1
                elif content[i] == ']':
                    bracket_count -= 1
                    if bracket_count == 0:
                        math_end = i + 1
                        if content[math_end] == ',':
                            math_end += 1
                        break
            
            content = content[:math_start] + ts_str + content[math_end:]
            print(f"testsData.ts updated for grade {grade}.")
        else:
            print(f"Could not find math: [ for grade {grade} in testsData.ts")
    else:
        print(f"Could not find '{grade}': {{ in testsData.ts")

with open('src/data/testsData.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# Now update Code.gs
with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    code_content = f.read()

for grade, math_q in updates.items():
    gs_str = '    "math": {\n'
    for q in math_q:
        if q.get("type") == "free_text":
            ans_text_esc = q["ans"].replace('"', '\\"')
        else:
            ans_text_esc = q["options"][int(q["ans"]) - 1].replace('"', '\\"')
        gs_str += f'      "{q["id"]}": {{ ans: "{ans_text_esc}", pts: 1 }},\n'
    gs_str += "    },\n"

    start_idx_gs = code_content.find(f'"{grade}": {{')
    if start_idx_gs != -1:
        math_start_gs = code_content.find('"math": {', start_idx_gs)
        if math_start_gs == -1:
            math_start_gs = code_content.find('math: {', start_idx_gs)
            
        if math_start_gs != -1:
            bracket_count_gs = 0
            math_end_gs = -1
            for i in range(math_start_gs + 8, len(code_content)):
                if code_content[i] == '{':
                    bracket_count_gs += 1
                elif code_content[i] == '}':
                    bracket_count_gs -= 1
                    if bracket_count_gs == 0:
                        math_end_gs = i + 1
                        if code_content[math_end_gs] == ',':
                            math_end_gs += 1
                        break
            code_content = code_content[:math_start_gs] + gs_str + code_content[math_end_gs:]
            print(f"Code.gs updated for grade {grade}.")
        else:
            print(f"Could not find math block in Code.gs for grade {grade}")
    else:
        print(f"Could not find '{grade}': {{ in Code.gs")

with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
    f.write(code_content)

