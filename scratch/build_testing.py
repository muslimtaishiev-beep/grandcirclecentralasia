import re

with open("scratch/Testing_patched.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the login UI part to add Resume English button
login_ui = """
          <div className="pt-4">
            {!isResumingEnglish ? (
              <>
                <button
                  type="button"
                  onClick={startTest}
                  disabled={!grade || !studentName.trim() || !enteredPin.trim() || !consentGiven}
                  className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Начать тест
                </button>
                <button
                  type="button"
                  onClick={() => setIsResumingEnglish(true)}
                  className="w-full mt-3 font-bold bg-white border-2 border-blue-600 text-blue-600 py-3 rounded-xl text-lg transition-all hover:bg-blue-50"
                >
                  Продолжить тест по английскому
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 text-left">
                  <label className="block text-sm font-medium mb-2 text-slate-700">Ваш Test ID:</label>
                  <input
                    type="text"
                    value={resumeShortId}
                    onChange={(e) => setResumeShortId(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors font-mono tracking-wider"
                    placeholder="Например: 123456"
                  />
                </div>
                <button
                  type="button"
                  onClick={startTest}
                  disabled={!resumeShortId.trim() || !enteredPin.trim()}
                  className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Начать английский
                </button>
                <button
                  type="button"
                  onClick={() => setIsResumingEnglish(false)}
                  className="w-full mt-3 font-bold text-slate-500 hover:text-slate-700 py-2"
                >
                  Назад
                </button>
              </>
            )}
          </div>
"""

content = re.sub(r'<button\s+type="button"\s+onClick=\{startTest\}.*?Начать тест\s*</button>', login_ui, content, flags=re.DOTALL)

# Handle intermediate and final phases in return block
# We have `if (finished)` and `if (disqualified)` logic.
# Replace `if (finished)` block completely!
finished_block = """
  if (phase === "intermediate") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center select-none">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100">
          <h1 className="text-4xl font-extrabold text-blue-900 mb-6">Отлично! Основной тест сдан 🎉</h1>
          <p className="text-xl text-slate-600 mb-8">
            Ваш уникальный номер (Test ID): <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded">{shortId}</span>
          </p>
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 mb-8 text-amber-800 text-left">
            <h3 className="font-bold text-lg mb-2">Что дальше?</h3>
            <p>Остался тест по английскому языку. Вы можете немного отдохнуть и сдать его прямо сейчас, либо завершить сессию и сдать его позже, введя свой Test ID на главном экране.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setPhase("english");
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Сдать английский сейчас
            </button>
            <button
              onClick={() => {
                setPhase("final");
                if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-4 px-6 rounded-xl text-lg transition-all"
            >
              Завершить и выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "final" || finished) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          
          {disqualified ? (
            <>
              <h1 className="text-4xl font-black text-red-600 mb-4 uppercase tracking-wider">Дисквалификация</h1>
              <p className="text-lg text-slate-600 mb-8 font-medium">Ваш тест был принудительно завершен из-за нарушения правил.</p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-extrabold text-blue-900 mb-4">Тест завершен!</h1>
              <p className="text-lg text-slate-600 mb-8 font-medium">Спасибо за участие. Ваши ответы сохранены.</p>
            </>
          )}

          {resultData ? (
            <div className="mb-6">
              {(() => {
                let maxRu = 0, maxMa = 0, maxLo = 0, maxEn = 0;
                if (grade && testsData[grade]) {
                  maxRu = testsData[grade].russian.reduce((sum, q) => sum + (q.points || 1), 0);
                  maxMa = testsData[grade].math.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (testsData[grade].logic) maxLo = testsData[grade].logic.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (testsData[grade].english) maxEn = testsData[grade].english.reduce((sum, q) => sum + (q.points || 1), 0);
                }
                const totalMax = maxRu + maxMa + maxLo;
                const percent = totalMax > 0 ? Math.round((resultData.totalScore / totalMax) * 100) : 0;
                
                return (
                  <>
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-left">
                    <h3 className="font-bold text-green-800 text-lg mb-3 text-center">Основной тест:</h3>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Русский язык:</span><span className="font-bold">{resultData.scores.russian || 0} из {maxRu}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Математика:</span><span className="font-bold">{resultData.scores.math || 0} из {maxMa}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Логика:</span><span className="font-bold">{resultData.scores.logic || 0} из {maxLo}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex flex-col items-end font-bold text-green-900 text-lg">
                      <div className="w-full flex justify-between"><span>Общий балл:</span><span>{resultData.totalScore || 0} из {totalMax}</span></div>
                      <div className="text-sm text-green-700 font-medium">({percent}% верных)</div>
                    </div>
                  </div>
                  
                  {resultData.scores.english !== undefined && resultData.scores.english !== "" && maxEn > 0 && (
                    <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-left">
                      <h3 className="font-bold text-indigo-800 text-lg mb-3 text-center">Английский язык:</h3>
                      {(() => {
                        const cefr = getCEFRLevel(grade!, maxEn, Number(resultData.scores.english));
                        if (!cefr) return null;
                        return (
                          <div className="flex flex-col items-center">
                            <div className="text-3xl mb-2">{cefr.icon}</div>
                            <div className="font-bold text-indigo-900 text-xl text-center">{cefr.actualLevel}</div>
                            <div className="text-indigo-700 mt-1 font-medium">Усвоено: {cefr.percent}%</div>
                            {cefr.icon !== "✅" && (
                              <div className="text-xs text-indigo-500 mt-2 text-center">Ожидаемый уровень: {cefr.targetLevel}</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-6">Результаты обрабатываются. Ожидайте вердикт от менеджера.</p>
          )}

          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm font-medium text-blue-800 mb-2">ID Теста для менеджера:</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-blue-600">{shortId}</p>
          </div>
          
          <button onClick={() => window.location.reload()} className="w-full font-bold text-slate-500 hover:text-slate-700 py-2">
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }
"""

content = re.sub(r'if \(finished\) \{.*?(?=if \(!started\))', finished_block + "\n  ", content, flags=re.DOTALL)

# Phase filtering for tabs and questions rendering
tabs_replace = """
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex gap-4 overflow-x-auto no-scrollbar">
          {[
            { title: "Русский язык", q: test.russian, hide: phase === "english" },
            { title: "Математика", q: test.math, hide: phase === "english" },
            { title: "Логика", q: test.logic, hide: phase === "english" },
            { title: "Английский язык", q: test.english, hide: phase === "core" }
          ].filter(s => s.q && s.q.length > 0 && !s.hide).map((section, idx) => (
            <button
              key={idx}
              onClick={() => {
                document.getElementById(`section-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="whitespace-nowrap py-4 px-2 font-bold text-sm text-slate-500 hover:text-blue-600 hover:border-blue-600 border-b-2 border-transparent transition-colors"
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
        {[
            { title: "Русский язык", q: test.russian, hide: phase === "english" },
            { title: "Математика", q: test.math, hide: phase === "english" },
            { title: "Логика", q: test.logic, hide: phase === "english" },
            { title: "Английский язык", q: test.english, hide: phase === "core" }
        ].filter(s => s.q && s.q.length > 0 && !s.hide).map((section, idx) => (
          <div key={idx} id={`section-${idx}`}>
"""
content = re.sub(r'<div className="bg-white border-b sticky top-0 z-10 shadow-sm">.*?<div className="max-w-3xl mx-auto px-6 py-8 space-y-12">\s*\{\[\s*\{ title: "Русский язык", q: test.russian \}.*?\]\.filter\(s => s\.q && s\.q\.length > 0\)\.map\(\(section, idx\) => \(\s*<div key=\{idx\}>', tabs_replace, content, flags=re.DOTALL)

# Submit button change in UI
submit_button = """
      <div className="max-w-3xl mx-auto px-6 pb-16">
        <button
          onClick={() => phase === "english" ? submitEnglishTest(false) : submitCoreTest(false)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl text-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
        >
          {phase === "english" ? "Завершить английский" : "Завершить тест"}
        </button>
      </div>
"""
content = re.sub(r'<div className="max-w-3xl mx-auto px-6 pb-16">\s*<button\s*onClick=\{.*?submitTest\(false\).*?Завершить тест\s*</button>\s*</div>', submit_button, content, flags=re.DOTALL)

with open("scratch/Testing_final.tsx", "w", encoding="utf-8") as f:
    f.write(content)
