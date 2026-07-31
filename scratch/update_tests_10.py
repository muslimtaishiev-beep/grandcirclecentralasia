import json

with open('scratch/math10_questions.json', 'r', encoding='utf-8') as f:
    math_q = json.load(f)

# Build the JS string for testsData.ts
ts_str = "    math: [\n"
for q in math_q:
    ts_str += "      {\n"
    ts_str += f'        id: "{q["id"]}",\n'
    ts_str += f'        type: "multiple_choice",\n'
    ts_str += f'        points: 1,\n'
    # text
    text_escaped = q["text"].replace('"', '\\"')
    ts_str += f'        text: "{text_escaped}",\n'
    # html
    html_escaped = q["html"].replace('"', '\\"')
    ts_str += f'        html: "{html_escaped}",\n'
    # options
    options_arr = []
    if "optionsHtml" in q:
        for opt_text, opt_html in zip(q["options"], q["optionsHtml"]):
            opt_text_esc = opt_text.replace('"', '\\"')
            opt_html_esc = opt_html.replace('"', '\\"')
            # We can't use optionsHtml in testsData since the type only has string options, wait! We can pass an array of objects if the UI supports it, but the UI only supports strings. 
            # WAIT. The UI Testing.tsx uses dangerouslySetInnerHTML on the option text directly? Let me check Testing.tsx
            options_arr.append(f'"{opt_html_esc}"')
    else:
        for opt_text in q["options"]:
            opt_text_esc = opt_text.replace('"', '\\"')
            options_arr.append(f'"{opt_text_esc}"')
    
    ts_str += f'        options: [{", ".join(options_arr)}]\n'
    ts_str += "      },\n"
ts_str += "    ],\n"

# Replace in testsData.ts
with open('src/data/testsData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the math array inside "10": {
import re

start_idx = content.find('"10": {')
if start_idx != -1:
    math_start = content.find('math: [', start_idx)
    # find the matching closing bracket for math: [
    bracket_count = 0
    math_end = -1
    for i in range(math_start + 6, len(content)):
        if content[i] == '[':
            bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                math_end = i + 1
                # Check for trailing comma
                if content[math_end] == ',':
                    math_end += 1
                break
    
    new_content = content[:math_start] + ts_str + content[math_end:]
    with open('src/data/testsData.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("testsData.ts updated successfully.")
else:
    print("Could not find '10': { in testsData.ts")


# Now update Code.gs
with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    code_content = f.read()

gs_str = "    math: {\n"
for q in math_q:
    ans_text_esc = q["options"][int(q["ans"]) - 1].replace('"', '\\"')
    gs_str += f'      "{q["id"]}": {{ ans: "{ans_text_esc}", pts: 1 }},\n'
gs_str += "    },\n"

start_idx_gs = code_content.find('"10": {')
if start_idx_gs != -1:
    math_start_gs = code_content.find('math: {', start_idx_gs)
    bracket_count_gs = 0
    math_end_gs = -1
    for i in range(math_start_gs + 6, len(code_content)):
        if code_content[i] == '{':
            bracket_count_gs += 1
        elif code_content[i] == '}':
            bracket_count_gs -= 1
            if bracket_count_gs == 0:
                math_end_gs = i + 1
                if code_content[math_end_gs] == ',':
                    math_end_gs += 1
                break
    new_code_content = code_content[:math_start_gs] + gs_str + code_content[math_end_gs:]
    with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
        f.write(new_code_content)
    print("Code.gs updated successfully.")
else:
    print("Could not find '10': { in Code.gs")

