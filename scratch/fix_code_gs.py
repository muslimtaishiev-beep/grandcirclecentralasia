import json

with open('scratch/math10_questions.json', 'r', encoding='utf-8') as f:
    math_q = json.load(f)

with open('scratch/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# First remove the junk from the end
junk_start = content.find('}    math: {\n      "ma_1_10":')
if junk_start != -1:
    content = content[:junk_start + 1] + "\n"

# Now find the real "10": {
start_idx = content.find('"10": {')
if start_idx != -1:
    math_start = content.find('"math": {', start_idx)
    if math_start == -1:
        math_start = content.find('math: {', start_idx)
    
    if math_start != -1:
        bracket_count = 0
        math_end = -1
        for i in range(math_start + 8, len(content)):
            if content[i] == '{':
                bracket_count += 1
            elif content[i] == '}':
                bracket_count -= 1
                if bracket_count == 0:
                    math_end = i + 1
                    if content[math_end] == ',':
                        math_end += 1
                    break
        
        # Build the new math string
        gs_str = '    "math": {\n'
        for q in math_q:
            ans_text_esc = q["options"][int(q["ans"]) - 1].replace('"', '\\"')
            gs_str += f'      "{q["id"]}": {{ ans: "{ans_text_esc}", pts: 1 }},\n'
        gs_str += "    },\n"
        
        new_content = content[:math_start] + gs_str + content[math_end:]
        with open('scratch/Code.gs', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Code.gs fixed successfully.")
    else:
        print("Could not find math block.")
else:
    print("Could not find 10 block.")
