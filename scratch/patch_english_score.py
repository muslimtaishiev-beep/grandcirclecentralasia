import re

with open('scratch/Code.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace initialization
code = code.replace("let ru = 0, ma = 0, lo = 0, en = 0;", "let ru = 0, ma = 0, lo = 0, en = \"\";")

# Replace english evaluation logic
target = r"""    if (keys.english) {
      Object.keys(keys.english).forEach(qId => {
        let userAns = answers[qId] ? String(answers[qId]).trim() : "";"""

replacement = r"""    if (keys.english) {
      let hasEnglish = false;
      Object.keys(keys.english).forEach(qId => {
        if (answers[qId] !== undefined) hasEnglish = true;
      });
      if (hasEnglish) {
        en = 0;
        Object.keys(keys.english).forEach(qId => {
          let userAns = answers[qId] ? String(answers[qId]).trim() : "";"""

code = code.replace(target, replacement)

# Add closing brace for if (hasEnglish)
target2 = r"""        let normalizedCorrect = correctAns.toLowerCase().replace(/[.,!?;]/g, "").replace(/\s+/g, " ");
        if (normalizedUser === normalizedCorrect) en += keys.english[qId].pts;
      });
    }"""

replacement2 = r"""        let normalizedCorrect = correctAns.toLowerCase().replace(/[.,!?;]/g, "").replace(/\s+/g, " ");
        if (normalizedUser === normalizedCorrect) en += keys.english[qId].pts;
        });
      }
    }"""

code = code.replace(target2, replacement2)

with open('scratch/Code.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Applied English score patch to Code.js")
