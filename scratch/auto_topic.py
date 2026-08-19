import re
import json

with open('src/data/testsData.ts', 'r') as f:
    ts_data = f.read()

# very naive parser to extract qid and text
q_texts = {}
for match in re.finditer(r'id:\s*["\'](.*?)["\'].*?text:\s*["\'](.*?)["\']', ts_data, re.DOTALL):
    q_texts[match.group(1)] = match.group(2)

def guess_topic(qid, text, subject):
    text_lower = text.lower()
    if subject == "russian":
        if "запят" in text_lower or "пунктуаци" in text_lower or "тире" in text_lower or "вводн" in text_lower or "сложн" in text_lower:
            return "Пунктуация"
        elif "синтаксис" in text_lower or "сказуем" in text_lower or "основа" in text_lower or "грамматик" in text_lower:
            return "Синтаксис"
        else:
            return "Орфография"
    elif subject == "math":
        if "уравнен" in text_lower or "неравенств" in text_lower or "систем" in text_lower:
            return "Алгебра: Уравнения и неравенства"
        elif "геометр" in text_lower or "угол" in text_lower or "треугольник" in text_lower or "площадь" in text_lower:
            return "Геометрия"
        elif "функц" in text_lower or "график" in text_lower:
            return "Функции и графики"
        elif "задач" in text_lower or "мотоциклист" in text_lower or "процент" in text_lower:
            return "Текстовые задачи и Прогрессии"
        else:
            return "Алгебра: Вычисления и преобразования"
    elif subject == "logic":
        if "утвержден" in text_lower or "истин" in text_lower or "лож" in text_lower:
            return "Анализ данных и множества"
        else:
            return "Логико-математические задачи"
    elif subject == "english":
        if "tense" in text_lower or "verb" in text_lower:
            return "Grammar: Basic Tenses (Present/Past)"
        else:
            return "Vocabulary & Prepositions"
    return "Основные навыки"

with open('scratch/Code_Fixed.gs', 'r') as f:
    code = f.read()

# We need to find all ans: lines without topic:
def replacer(match):
    full_line = match.group(0)
    if "topic:" in full_line:
        return full_line
    # extract qid
    # e.g. "ru_7_new": { ans: "...", pts: 1 }
    qid = match.group(1)
    
    # guess subject from qid
    subj = "russian"
    if qid.startswith("ma") or "math" in qid: subj = "math"
    if qid.startswith("lo") or "logic" in qid: subj = "logic"
    if qid.startswith("en") or "english" in qid: subj = "english"
    
    q_text = q_texts.get(qid, "")
    topic = guess_topic(qid, q_text, subj)
    
    # insert topic: "..." before the closing brace
    # match.group(2) is the content of the curly braces without the last brace
    return f'"{qid}": {{{match.group(2)}, topic: "{topic}"}}'

new_code = re.sub(r'"([a-zA-Z0-9_]+)":\s*\{([^}]+)\}', replacer, code)

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(new_code)

print("Topics injected!")
