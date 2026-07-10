import json
import re

files = ["scratch/raw_7_10.txt", "scratch/raw_11.txt"]
lines = []
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        lines.extend(file.read().splitlines())

data = {}
current_grade = None
current_subject = None
current_q = None

def finalize_q():
    if current_q and current_grade and current_subject:
        raw_text_lines = current_q['text_lines']
        opts = []
        q_text = ""
        
        has_explicit_variants = any(l.startswith("Варианты:") for l in raw_text_lines)
        
        if has_explicit_variants:
            q_text_lines = []
            variants_str = ""
            for l in raw_text_lines:
                if l.startswith("Варианты:"):
                    variants_str = l.replace("Варианты:", "").strip()
                else:
                    q_text_lines.append(l)
            q_text = "\n".join(q_text_lines)
            
            if '|' in variants_str:
                opts = [o.strip() for o in variants_str.split('|') if o.strip()]
            else:
                split_opts = re.split(r'\d+\)|\b[a-d]\)', variants_str)
                opts = [o.strip() for o in split_opts if o.strip()]
        else:
            combined_text = " ".join(raw_text_lines)
            if re.search(r'\d+\)', combined_text) and len(re.findall(r'\d+\)', combined_text)) > 1:
                parts = re.split(r'(\d+\))', combined_text)
                q_text = parts[0].strip()
                opts_raw = "".join(parts[1:])
                split_opts = re.split(r'\d+\)', opts_raw)
                opts = [o.strip() for o in split_opts if o.strip()]
            elif len(raw_text_lines) > 1:
                q_text = raw_text_lines[0]
                opts = [l.strip() for l in raw_text_lines[1:] if l.strip()]
            else:
                q_text = raw_text_lines[0] if raw_text_lines else ""
                
        opts = [re.sub(r'^\d+\)\s*', '', o) for o in opts]
        opts = [o for o in opts if o]
        
        if len(opts) > 1:
            current_q['type'] = 'multiple_choice'
        else:
            current_q['type'] = 'free_text'
            
        ans = current_q['correct_raw'].strip()
        ans = re.sub(r'^\d+\)\s*', '', ans) 
        
        if current_q['type'] == 'multiple_choice':
            if ans.isdigit() and 1 <= int(ans) <= len(opts):
                current_q['correctAnswer'] = opts[int(ans)-1]
            else:
                best_match = None
                for o in opts:
                    if ans.lower() in o.lower() or o.lower() in ans.lower():
                        best_match = o
                        break
                
                m = re.match(r'^(\d+)\s*\(.*?\)$', ans)
                if m:
                    idx = int(m.group(1)) - 1
                    if 0 <= idx < len(opts):
                        best_match = opts[idx]
                        
                current_q['correctAnswer'] = best_match if best_match else ans
        else:
            current_q['correctAnswer'] = ans

        q_obj = {
            "id": f"{current_subject}_{len(data[current_grade][current_subject]) + 1}",
            "type": current_q['type'],
            "points": 1,
            "text": q_text.strip(),
            "correctAnswer": current_q['correctAnswer']
        }
        if current_q['type'] == 'multiple_choice':
            q_obj["options"] = opts
            
        data[current_grade][current_subject].append(q_obj)

subject_map = {
    "Русский язык": "russian",
    "Математика": "math",
    "Логика": "logic"
}

i = 0
while i < len(lines):
    line = lines[i].strip()
    i += 1
    if not line:
        continue
        
    if "КЛАСС" in line.upper() and len(line) < 30:
        m_grade = re.search(r'(\d+)', line)
        if m_grade:
            finalize_q()
            current_q = None
            current_grade = int(m_grade.group(1))
            if current_grade not in data:
                data[current_grade] = {"grade": current_grade, "russian": [], "math": [], "logic": []}
            continue
    
    matched_subject = False
    for k, v in subject_map.items():
        if line.startswith(k) or (k in line and "КЛАСС" not in line.upper()):
            finalize_q()
            current_q = None
            current_subject = v
            matched_subject = True
            break
    if matched_subject:
        continue
        
    if line.startswith("Задание №") or line.startswith("Задание ") or re.match(r'^\d+\.\s', line):
        finalize_q()
        current_q = {
            "text_lines": [line],
            "correct_raw": "",
            "state": "text"
        }
        continue
        
    if line.startswith("Решение:"):
        if current_q:
            current_q["state"] = "solution"
        continue
        
    if line.startswith("Правильный ответ:") or line.startswith("Ответ:"):
        if current_q:
            current_q["state"] = "correct"
            ans_str = line.replace("Правильный ответ:", "").replace("Ответ:", "").replace("->", "").strip()
            current_q["correct_raw"] = ans_str
        continue
        
    if current_q:
        if current_q["state"] == "text":
            current_q["text_lines"].append(line)

finalize_q()

ts_output = "import { TestData } from '../types';\n\nexport const testsData: Record<number, TestData> = "
ts_output += json.dumps(data, ensure_ascii=False, indent=2)
ts_output += ";\n"

with open("src/data/testsData.ts", "w", encoding="utf-8") as f:
    f.write(ts_output)
    
print("testsData.ts generated successfully!")
