import re

with open("src/pages/Testing.tsx", "r") as f:
    code = f.read()

old_sections = r'\{\[\{ title: "Русский язык", q: test\.russian \}, \{ title: "Математика", q: test\.math \}, \{ title: "Логика", q: test\.logic \}, \{ title: "Английский язык", q: test\.english \}\]\.filter\(s => s\.q && s\.q\.length > 0\)\.map\(\(section, idx\) => \('

new_sections = r"""
        {(phase === "core" 
          ? [
              { title: "Русский язык", q: test.russian }, 
              { title: "Математика", q: test.math }, 
              { title: "Логика", q: test.logic }
            ]
          : [
              { title: "Английский язык", q: test.english }
            ]
        ).filter(s => s.q && s.q.length > 0).map((section, idx) => ("""

new_code = re.sub(old_sections, new_sections.strip(), code)

with open("src/pages/Testing.tsx", "w") as f:
    f.write(new_code)

