with open("src/pages/Testing.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update max calculation
old_max = """                let maxRu = 0, maxMa = 0, maxLo = 0;
                if (grade && testsData[grade]) {
                  maxRu = testsData[grade].russian.reduce((sum, q) => sum + (q.points || 1), 0);
                  maxMa = testsData[grade].math.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (testsData[grade].logic) {
                    maxLo = testsData[grade].logic.reduce((sum, q) => sum + (q.points || 1), 0);
                  }
                }
                const totalMax = maxRu + maxMa + maxLo;"""
new_max = """                let maxRu = 0, maxMa = 0, maxLo = 0, maxEn = 0;
                if (grade && testsData[grade]) {
                  maxRu = testsData[grade].russian.reduce((sum, q) => sum + (q.points || 1), 0);
                  maxMa = testsData[grade].math.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (testsData[grade].logic) {
                    maxLo = testsData[grade].logic.reduce((sum, q) => sum + (q.points || 1), 0);
                  }
                  if (testsData[grade].english) {
                    maxEn = testsData[grade].english.reduce((sum, q) => sum + (q.points || 1), 0);
                  }
                }
                const totalMax = maxRu + maxMa + maxLo + maxEn;"""
content = content.replace(old_max, new_max)

# 2. Update result rendering
old_result = """                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Логика:</span>
                      <span className="font-bold">{resultData.scores.logic} из {maxLo}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex flex-col items-end font-bold text-green-900 text-lg relative">"""
new_result = """                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Логика:</span>
                      <span className="font-bold">{resultData.scores.logic} из {maxLo}</span>
                    </div>
                    {testsData[grade]?.english && (
                      <div className="flex justify-between items-center mb-1 text-green-700">
                        <span>Английский язык:</span>
                        <span className="font-bold">{resultData.scores.english} из {maxEn}</span>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-green-200 flex flex-col items-end font-bold text-green-900 text-lg relative">"""
content = content.replace(old_result, new_result)

# 3. Update sections mapping
old_map = """{[{ title: "Русский язык", q: test.russian }, { title: "Математика", q: test.math }, { title: "Логика", q: test.logic }].map((section, idx) => ("""
new_map = """{[{ title: "Русский язык", q: test.russian }, { title: "Математика", q: test.math }, { title: "Логика", q: test.logic }, { title: "Английский язык", q: test.english }].filter(s => s.q && s.q.length > 0).map((section, idx) => ("""
content = content.replace(old_map, new_map)

with open("src/pages/Testing.tsx", "w", encoding="utf-8") as f:
    f.write(content)
