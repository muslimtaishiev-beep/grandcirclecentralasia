import re

with open("src/pages/Testing.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Resume UI
login_ui = """
          {!isResumingEnglish ? (
            <>
              <button 
                onClick={startTest}
                disabled={!grade || !studentName.trim() || !enteredPin.trim() || !consentGiven}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-blue-700 transition shadow-lg mb-3"
              >
                Начать тест
              </button>
              <button 
                onClick={() => setIsResumingEnglish(true)}
                className="w-full py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition"
              >
                Продолжить тест по английскому
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ваш Test ID:</label>
                <input
                  type="text"
                  value={resumeShortId}
                  onChange={(e) => setResumeShortId(e.target.value)}
                  className="w-full border rounded-xl p-3 bg-slate-50 font-mono tracking-widest text-center"
                  placeholder="Например: 123456"
                />
              </div>
              <button 
                onClick={startTest}
                disabled={!resumeShortId.trim() || !enteredPin.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-indigo-700 transition shadow-lg"
              >
                Войти и начать английский
              </button>
              <button 
                onClick={() => setIsResumingEnglish(false)}
                className="w-full py-2 text-slate-500 font-bold hover:text-slate-700 transition"
              >
                Назад
              </button>
            </div>
          )}
"""
content = re.sub(r'<button\s*onClick=\{startTest\}\s*disabled=\{!grade.*?Начать тест\s*</button>', login_ui, content, flags=re.DOTALL)

# Fix 2 & 3: Anti-cheat dependency & condition
# Currently it is:
#     const handleVisibilityChange = () => {
#       if (document.hidden) {
#         handleCheating();
#       } else {
#         handleFocus();
#       }
#     };
# We need to wrap handleCheating with `if (phase === "core" || phase === "english")`
content = content.replace(
    'if (document.hidden) {\n        handleCheating();',
    'if (document.hidden) {\n        if (phase === "core" || phase === "english") handleCheating();'
)
# And the ESC listener
content = content.replace(
    'submitCoreTest(true);\n          }',
    'if (phase === "core" || phase === "english") { phase === "english" ? submitEnglishTest(true) : submitCoreTest(true); }\n          }'
)
# And the useEffect dependencies
content = content.replace(
    '[started, finished, disqualified, answers]',
    '[started, finished, disqualified, answers, phase]'
)

# Fix 4: setFinished on Intermediate screen
content = content.replace(
    'setPhase("final");\n                if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});',
    'setFinished(true);\n                setPhase("final");\n                if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});'
)

with open("src/pages/Testing.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Testing.tsx patched successfully")
