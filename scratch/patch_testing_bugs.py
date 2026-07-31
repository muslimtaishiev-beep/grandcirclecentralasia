import re

with open('src/pages/Testing.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add a submit button at the bottom of the test page
target_bottom_button = r"""        ))}
      </div>
    </div>
  );
}"""

replacement_bottom_button = """        ))}
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12 flex justify-end">
        <button 
          onClick={() => phase === "english" ? submitEnglishTest(false) : submitCoreTest(false)}
          className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all"
        >
          Завершить тест
        </button>
      </div>
    </div>
  );
}"""
code = code.replace(target_bottom_button, replacement_bottom_button)

# Add null safety to resultData
target_result_data = r"""                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-left">
                    <h3 className="font-bold text-green-800 text-lg mb-3 text-center">Основной тест:</h3>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Русский язык:</span><span className="font-bold">{resultData.scores?.russian || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Математика:</span><span className="font-bold">{resultData.scores?.math || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Логика:</span><span className="font-bold">{resultData.scores?.logic || 0}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex flex-col items-end font-bold text-green-900 text-lg">
                      <div className="w-full flex justify-between"><span>Общий балл:</span><span>{resultData.totalScore || 0} из {totalMax}</span></div>
                      <div className="text-sm text-green-700 font-medium">({percent}% верных)</div>
                    </div>
                  </div>"""

replacement_result_data = """                  {resultData && resultData.scores && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-left">
                    <h3 className="font-bold text-green-800 text-lg mb-3 text-center">Основной тест:</h3>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Русский язык:</span><span className="font-bold">{resultData.scores.russian || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Математика:</span><span className="font-bold">{resultData.scores.math || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Логика:</span><span className="font-bold">{resultData.scores.logic || 0}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex flex-col items-end font-bold text-green-900 text-lg">
                      <div className="w-full flex justify-between"><span>Общий балл:</span><span>{resultData.totalScore || 0} из {totalMax}</span></div>
                      <div className="text-sm text-green-700 font-medium">({percent}% верных)</div>
                    </div>
                  </div>
                  )}"""
code = code.replace(target_result_data, replacement_result_data)

# Also fix the english checking block to check if resultData.scores exists
target_english_scores = r"""                  {resultData.scores?.english !== undefined && resultData.scores?.english !== "" && maxEn > 0 && ("""
replacement_english_scores = r"""                  {resultData && resultData.scores && resultData.scores.english !== undefined && resultData.scores.english !== "" && maxEn > 0 && ("""
code = code.replace(target_english_scores, replacement_english_scores)

with open('src/pages/Testing.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Applied bugfixes to Testing.tsx")
