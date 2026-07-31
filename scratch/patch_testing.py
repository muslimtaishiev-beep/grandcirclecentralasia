with open("src/pages/Testing.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# 1. Add "Английский язык" tab
old_tabs = r'\{title: "Русский язык", q: test\.russian\}, \{title: "Математика", q: test\.math\}, \{title: "Логика", q: test\.logic\}'
new_tabs = r'{title: "Русский язык", q: test.russian}, {title: "Математика", q: test.math}, {title: "Логика", q: test.logic}, {title: "Английский язык", q: test.english || []}'
content = re.sub(old_tabs, new_tabs, content)

# 2. Add inline_dropdown renderer logic inside the questions map
# Find the end of "two_step" or the start of "logic_matrix"
old_render = r'                  \) : q\.type === "logic_matrix" \? \('

new_render = r'''                  ) : q.type === "inline_dropdown" ? (
                    <div className="mt-4 text-slate-800 text-lg leading-relaxed">
                      {q.text.split("[gap]").map((part, pIdx, arr) => (
                        <React.Fragment key={pIdx}>
                          <span dangerouslySetInnerHTML={{ __html: part }} />
                          {pIdx < arr.length - 1 && (
                            <select
                              value={answers[q.id] || ""}
                              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                              className="mx-2 p-1 border-b-2 border-blue-400 bg-blue-50/50 outline-none focus:border-blue-600 focus:bg-blue-100 rounded-t transition-colors text-blue-800 font-medium cursor-pointer"
                            >
                              <option value="" disabled>---</option>
                              {q.inlineOptions?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : q.type === "logic_matrix" ? ('''

content = re.sub(old_render, new_render, content)

# 3. Add instruction renderer
# Right before {q.html ?
old_qtext = r'                    \{q\.html \? \('
new_qtext = r'''                    {q.instruction && (
                      <div className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3 bg-blue-50 inline-block px-3 py-1 rounded">
                        {q.instruction}
                      </div>
                    )}
                    {q.html ? ('''
content = re.sub(old_qtext, new_qtext, content)

with open("src/pages/Testing.tsx", "w", encoding="utf-8") as f:
    f.write(content)

