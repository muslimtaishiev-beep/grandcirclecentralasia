import re

with open("src/pages/Testing.tsx", "r") as f:
    content = f.read()

# 1. State Variables
state_vars = """
  const [totalBlurTime, setTotalBlurTime] = useState<number>(() => {
    const saved = safeGetSession("totalBlurTime", "0");
    return Number(saved);
  });
  const [isFullscreenViolation, setIsFullscreenViolation] = useState(() => safeGetSession("isFullscreenViolation", "") === "true");
"""
content = re.sub(r'const \[resultData, setResultData\](.*?);\n', r'const [resultData, setResultData]\1;\n' + state_vars, content, flags=re.DOTALL)

# 2. Sync array
content = content.replace(
    'sessionStorage.setItem("phase", phase);\n    } catch(e) {}\n  }, [studentName, grade, started, finished, disqualified, consentGiven, answers, testId, shortId, qrToken, pendingSubmission, resultData]);',
    'sessionStorage.setItem("phase", phase);\n    } catch(e) {}\n  }, [studentName, grade, started, finished, disqualified, consentGiven, answers, testId, shortId, qrToken, pendingSubmission, resultData, phase]);'
)

# 3. Anti-Cheat Logic
old_anti_cheat = """  // --- ANTI-CHEAT LOGIC ---
  useEffect(() => {
    if (!started || finished || disqualified) return;

    const handleCheating = () => {
      // 15 seconds grace period to prevent false positives from notifications/accidental clicks
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
      blurTimeout.current = setTimeout(() => {
        // Use ref to check CURRENT phase, not stale closure value
        const currentPhase = phaseRef.current;
        if (currentPhase !== 'core' && currentPhase !== 'english') return; // Already submitted, don't overwrite
        
        // Safety net for mobile: if a spurious blur fired (e.g., keyboard closed) but the user is still active on the page, ignore
        if (document.hasFocus && document.hasFocus() && !document.hidden) {
          return;
        }

        currentPhase === 'english' ? submitEnglishTest(true) : submitCoreTest(true);
      }, 15000);
    };

    const handleFocus = () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const currentPhase = phaseRef.current;
        if (currentPhase === "core" || currentPhase === "english") handleCheating();
      } else {
        handleFocus();
      }
    };

    window.addEventListener("blur", handleCheating);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleCheating);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [started, finished, disqualified, answers, phase]); // Add answers to dependencies so submitTest gets latest"""

new_anti_cheat = """  // --- ANTI-CHEAT LOGIC V2 ---
  useEffect(() => {
    // Restore and check cumulative blur time on mount/reload
    if (started && !finished && !disqualified) {
      const lastBlur = safeGetSession("lastBlurTime", null);
      if (lastBlur) {
        const elapsed = Date.now() - parseInt(lastBlur, 10);
        const newTotal = totalBlurTime + Math.max(0, elapsed);
        setTotalBlurTime(newTotal);
        sessionStorage.setItem("totalBlurTime", newTotal.toString());
        sessionStorage.removeItem("lastBlurTime");
        if (newTotal > 15000) {
           phase === 'english' ? submitEnglishTest(true) : submitCoreTest(true);
        }
      }
    }
  }, [started]);

  useEffect(() => {
    if (!started || finished || disqualified) return;

    const handleCheating = () => {
      // 1. For mobile: ignore blur if document is still visible (avoids native dropdown/keyboard bugs)
      const isMobile = window.innerWidth < 768;
      if (isMobile && !document.hidden) return;

      // 2. Log when they left
      if (!safeGetSession("lastBlurTime", null)) {
        sessionStorage.setItem("lastBlurTime", Date.now().toString());
      }
      
      // 3. Start a timer just in case they don't trigger focus/visibilitychange (desktop hover bug)
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
      
      const timeRemaining = Math.max(0, 15000 - totalBlurTime);
      blurTimeout.current = setTimeout(() => {
        const currentPhase = phaseRef.current;
        if (currentPhase !== 'core' && currentPhase !== 'english') return;
        
        // Safety net: if the document actually has focus right now (spurious blur event), ignore
        if (document.hasFocus && document.hasFocus() && !document.hidden) {
          sessionStorage.removeItem("lastBlurTime");
          return;
        }

        // Time is up!
        currentPhase === 'english' ? submitEnglishTest(true) : submitCoreTest(true);
      }, timeRemaining);
    };

    const handleFocus = () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
      
      const lastBlur = safeGetSession("lastBlurTime", null);
      if (lastBlur) {
        const elapsed = Date.now() - parseInt(lastBlur, 10);
        const newTotal = totalBlurTime + Math.max(0, elapsed);
        setTotalBlurTime(newTotal);
        sessionStorage.setItem("totalBlurTime", newTotal.toString());
        sessionStorage.removeItem("lastBlurTime");
        
        if (newTotal > 15000) {
          const currentPhase = phaseRef.current;
          if (currentPhase === 'core' || currentPhase === 'english') {
            currentPhase === 'english' ? submitEnglishTest(true) : submitCoreTest(true);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleCheating();
      else handleFocus();
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setIsFullscreenViolation(true);
      }
    };

    window.addEventListener("blur", handleCheating);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("blur", handleCheating);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [started, finished, disqualified, phase, totalBlurTime]); // Added totalBlurTime"""

content = content.replace(old_anti_cheat, new_anti_cheat)

# 4. Keyboard shortcuts
old_shortcuts = """  // Block copy/paste/context menu globally when test is active
  useEffect(() => {
    if (!started || finished) return;
    const preventAction = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", preventAction);
    document.addEventListener("copy", preventAction);
    document.addEventListener("paste", preventAction);
    document.addEventListener("selectstart", preventAction);

    return () => {
      document.removeEventListener("contextmenu", preventAction);
      document.removeEventListener("copy", preventAction);
      document.removeEventListener("paste", preventAction);
      document.removeEventListener("selectstart", preventAction);
    };
  }, [started, finished]);"""

new_shortcuts = """  // Block copy/paste/context menu globally when test is active
  useEffect(() => {
    if (!started || finished) return;
    const preventAction = (e: Event) => e.preventDefault();
    const preventShortcuts = (e: KeyboardEvent) => {
      if (e.key === "F12") e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (["p", "s", "c", "v", "u"].includes(k)) e.preventDefault();
      }
    };
    
    document.addEventListener("contextmenu", preventAction);
    document.addEventListener("copy", preventAction);
    document.addEventListener("paste", preventAction);
    document.addEventListener("selectstart", preventAction);
    document.addEventListener("keydown", preventShortcuts);

    return () => {
      document.removeEventListener("contextmenu", preventAction);
      document.removeEventListener("copy", preventAction);
      document.removeEventListener("paste", preventAction);
      document.removeEventListener("selectstart", preventAction);
      document.removeEventListener("keydown", preventShortcuts);
    };
  }, [started, finished]);"""
content = content.replace(old_shortcuts, new_shortcuts)

# 5. Drag-and-drop
content = content.replace('active:cursor-grabbing select-none hover:border-blue-300', 'active:cursor-grabbing select-none touch-none hover:border-blue-300')

# 6. Fullscreen violation overlay
overlay_jsx = """
  // Fullscreen Violation UI
  if (isFullscreenViolation) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center z-50">
        <h1 className="text-3xl font-bold mb-4">Нарушение режима</h1>
        <p className="text-lg text-slate-300 mb-8 max-w-md">Вы покинули полноэкранный режим. Тестирование должно проходить только в полноэкранном режиме, чтобы избежать списывания.</p>
        <button 
          onClick={() => {
            const doc = document.documentElement as any;
            if (doc.requestFullscreen) doc.requestFullscreen().catch(()=>{});
            else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen().catch(()=>{});
            setIsFullscreenViolation(false);
          }}
          className="px-6 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition-colors"
        >
          Вернуться к тесту
        </button>
      </div>
    );
  }
"""

# Insert overlay just before the main return for core/english phase
content = content.replace('  if (disqualified) {', overlay_jsx + '\n  if (disqualified) {')

with open("src/pages/Testing.tsx", "w") as f:
    f.write(content)

print("Done")
