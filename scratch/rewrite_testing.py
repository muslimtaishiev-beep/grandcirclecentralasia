import re

with open("src/pages/Testing.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add new imports
content = content.replace(
    'import { getHourlyPIN, formatMathText } from "../lib/utils";',
    'import { getHourlyPIN, formatMathText, getCEFRLevel } from "../lib/utils";'
)

# 2. Add new states
state_injection = """
  const [phase, setPhase] = useState<"login" | "core" | "intermediate" | "english" | "final">(
    () => (sessionStorage.getItem("phase") as any) || "login"
  );
  const [isResumingEnglish, setIsResumingEnglish] = useState(false);
  const [resumeShortId, setResumeShortId] = useState("");
"""
content = content.replace(
    'const [enteredPin, setEnteredPin] = useState("");',
    'const [enteredPin, setEnteredPin] = useState("");' + state_injection
)

# Update useEffect for sessionStorage sync
content = content.replace(
    'if (resultData) sessionStorage.setItem("resultData", JSON.stringify(resultData));',
    'if (resultData) sessionStorage.setItem("resultData", JSON.stringify(resultData));\n    sessionStorage.setItem("phase", phase);'
)

# 3. Update submitTest to submitCoreTest
submit_core = """
  const submitCoreTest = async (isDisqualified = false) => {
    if (isDisqualified) {
      setDisqualified(true);
    }
    const payloadTestId = testId || crypto.randomUUID();
    if (!testId) setTestId(payloadTestId);

    const tokenUrl = `https://studyfreeforum.com/manager/form?shortId=${shortId}`;
    setQrToken(tokenUrl);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    // Send only russian, math, logic answers
    const coreAnswers = {};
    if (grade && testsData[grade]) {
        [...(testsData[grade].russian||[]), ...(testsData[grade].math||[]), ...(testsData[grade].logic||[])].forEach(q => {
            if (answers[q.id]) coreAnswers[q.id] = answers[q.id];
        });
    }

    const payload = {
      action: "submitTest",
      testId: payloadTestId,
      shortId: shortId,
      studentName,
      grade,
      answers: coreAnswers,
      cheated: isDisqualified,
      testerPin: isTester ? enteredPin : undefined
    };

    if (!isTester) localStorage.setItem("lastTestTime", Date.now().toString());

    try {
      const res = await fetch("/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setResultData({
          totalScore: data.totalScore,
          scores: data.scores,
          cheated: data.cheated
        });
        setPendingSubmission(false);
        // Do not set finished here! We move to intermediate phase.
        setPhase("intermediate");
      } else {
        if (data.error && data.error.includes("уже сдавали")) {
             alert(data.error);
             return;
        }
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      alert("Ошибка отправки теста: " + e.message);
    }
  };

  const submitEnglishTest = async (isDisqualified = false) => {
    setFinished(true);
    if (isDisqualified) setDisqualified(true);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    const engAnswers = {};
    if (grade && testsData[grade] && testsData[grade].english) {
        testsData[grade].english.forEach(q => {
            if (answers[q.id]) engAnswers[q.id] = answers[q.id];
        });
    }

    const payload = {
      action: "submitEnglishTest",
      shortId: shortId,
      grade,
      answers: engAnswers,
      cheated: isDisqualified,
      testerPin: isTester ? enteredPin : undefined
    };

    try {
      const res = await fetch("/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setResultData((prev: any) => ({
           ...prev,
           scores: { ...(prev?.scores || {}), english: data.scores.english }
        }));
        setPhase("final");
        if (document.exitFullscreen) await document.exitFullscreen().catch(()=>{});
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      alert("Ошибка отправки английского: " + e.message);
    }
  };
"""

content = re.sub(r'const submitTest = async \(isDisqualified = false\) => \{.*?\n  \};\n', submit_core, content, flags=re.DOTALL)
# Also fix handleCheating references
content = content.replace("submitTest(true)", "phase === 'english' ? submitEnglishTest(true) : submitCoreTest(true)")

start_test = """
  const startTest = async () => {
    if (isResumingEnglish) {
       if (!resumeShortId.trim()) return alert("Введите Test ID");
       if (!enteredPin.trim()) return alert("Введите PIN");
       const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
       const isTester = TESTER_PIN && enteredPin === TESTER_PIN;
       if (!isTester && enteredPin !== getHourlyPIN(0) && enteredPin !== getHourlyPIN(-1) && enteredPin !== getHourlyPIN(1)) {
         return alert("Неверный PIN-код.");
       }
       
       try {
         const res = await fetch("/api/gas", {
           method: "POST", headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ action: "getStudentByShortId", shortId: resumeShortId })
         });
         const data = await res.json();
         if (!data.success) return alert(data.error || "Не найдено");
         
         const student = data.student;
         setShortId(student.shortId);
         setGrade(student.grade);
         setStudentName(student.studentName);
         setResultData({
           totalScore: student.totalScore,
           scores: { russian: student.russian, math: student.math, logic: student.logic, english: student.english }
         });
         if (student.english !== "") {
           return alert("Английский тест уже был сдан для этого Test ID!");
         }
         if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(()=>{});
         setStarted(true);
         setPhase("english");
       } catch (e:any) { alert("Ошибка: " + e.message); }
       return;
    }

    if (!grade) return alert("Выберите класс");
    if (!studentName.trim()) return alert("Введите ФИО");
    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;
    if (!isTester && enteredPin !== getHourlyPIN(0) && enteredPin !== getHourlyPIN(-1) && enteredPin !== getHourlyPIN(1)) {
      return alert("Неверный PIN-код. Узнайте актуальный PIN у менеджера.");
    }

    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(()=>{});
    if (!testId) setTestId(crypto.randomUUID());
    setStarted(true);
    setPhase("core");
  };
"""
content = re.sub(r'const startTest = async \(\) => \{.*?\n  \};\n', start_test, content, flags=re.DOTALL)

with open("scratch/Testing_patched.tsx", "w", encoding="utf-8") as f:
    f.write(content)
