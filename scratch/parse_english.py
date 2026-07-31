import json

with open("scratch/english_raw.json", "r", encoding="utf-8") as f:
    data = json.load(f)

ts_output = ""

def esc(s):
    return s.replace('"', '\\"')

for grade_key in ["8", "9", "10_11"]:
    grade_data = data[grade_key]
    ts_output += f"const english_grade_{grade_key}: Question[] = [\n"
    for task in grade_data["tasks"]:
        instruction = task.get("instruction", "")
        task_type = task.get("type", "")
        options_list = task.get("optionsList", [])
        
        for q in task["questions"]:
            q_id = f"en_{grade_key}_{q['id']}"
            text = esc(q["text"])
            
            ts_output += "  {\n"
            ts_output += f'    id: "{q_id}",\n'
            ts_output += f'    text: "{text}",\n'
            ts_output += f'    instruction: "{esc(instruction)}",\n'
            ts_output += "    points: 1,\n"
            
            if task_type == "TYPE_RADIO" or task_type == "TYPE_SENTENCE_CORRECTION":
                ts_output += '    type: "multiple_choice",\n'
                options_str = ", ".join([f'"{esc(opt)}"' for opt in q["options"]])
                ts_output += f'    options: [{options_str}]\n'
            elif task_type == "TYPE_INLINE_DROPDOWN":
                ts_output += '    type: "inline_dropdown",\n'
                if options_list:
                    options_str = ", ".join([f'"{esc(opt)}"' for opt in options_list])
                    ts_output += f'    inlineOptions: [{options_str}]\n'
                elif "options" in q:
                    options_str = ", ".join([f'"{esc(opt)}"' for opt in q["options"]])
                    ts_output += f'    inlineOptions: [{options_str}]\n'
            elif task_type == "TYPE_DRAG_DROP":
                ts_output += '    type: "drag_and_drop",\n'
                options_str = ", ".join([f'"{esc(opt)}"' for opt in q["options"]])
                ts_output += f'    dragItems: [{options_str}]\n'
            
            ts_output += "  },\n"
    ts_output += "];\n\n"

with open("src/data/testsData.ts", "r", encoding="utf-8") as f:
    tests_content = f.read()

tests_content = tests_content.replace(
    "export const testsData: Record<number, TestData> = {",
    ts_output + "export const testsData: Record<number, TestData> = {"
)

for grade_num, grade_key in [(8, "8"), (9, "9"), (10, "10_11"), (11, "10_11")]:
    target = f"  {grade_num}: {{"
    replacement = f"  {grade_num}: {{\n    english: english_grade_{grade_key},"
    tests_content = tests_content.replace(target, replacement)

with open("src/data/testsData.ts", "w", encoding="utf-8") as f:
    f.write(tests_content)

print("Parsed and updated testsData.ts successfully.")
