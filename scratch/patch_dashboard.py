with open("src/pages/ManagerDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Update interface Student
old_student = r'''  ru: string | number;
  ma: string | number;
  lo: string | number;'''
new_student = r'''  ru: string | number;
  ma: string | number;
  lo: string | number;
  en: string | number;'''
content = re.sub(old_student, new_student, content)

# Update getMaxScore
old_getmax = r'''const getMaxScore = \(gradeStr: string \| undefined, subject: "russian" \| "math" \| "logic"\) => \{
    if \(!gradeStr\) return "\?";
    const grade = parseInt\(gradeStr, 10\);
    const d = testsData\[grade\];
    if \(!d\) return "\?";
    if \(subject === "logic"\) return d\.logic\?\.reduce\(\(acc, curr\) => acc \+ \(curr\.points \|\| 1\), 0\) \|\| "\?";
    if \(subject === "math"\) return d\.math\?\.reduce\(\(acc, curr\) => acc \+ \(curr\.points \|\| 1\), 0\) \|\| "\?";
    if \(subject === "russian"\) return d\.russian\?\.reduce\(\(acc, curr\) => acc \+ \(curr\.points \|\| 1\), 0\) \|\| "\?";
    return "\?";
  \};'''
new_getmax = r'''const getMaxScore = (gradeStr: string | undefined, subject: "russian" | "math" | "logic" | "english") => {
    if (!gradeStr) return "?";
    const grade = parseInt(gradeStr, 10);
    const d = testsData[grade];
    if (!d) return "?";
    if (subject === "logic") return d.logic?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    if (subject === "math") return d.math?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    if (subject === "russian") return d.russian?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    if (subject === "english") return d.english?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    return "?";
  };'''
content = re.sub(old_getmax, new_getmax, content)

# Display english score
# Old: Р:{s.ru}/{getMaxScore(s.grade, "russian")} М:{s.ma}/{getMaxScore(s.grade, "math")} Л:{s.lo}/{getMaxScore(s.grade, "logic")}
old_display = r'Р:\{s\.ru\}/\{getMaxScore\(s\.grade, "russian"\)\} М:\{s\.ma\}/\{getMaxScore\(s\.grade, "math"\)\} Л:\{s\.lo\}/\{getMaxScore\(s\.grade, "logic"\)\}'
new_display = r'Р:{s.ru}/{getMaxScore(s.grade, "russian")} М:{s.ma}/{getMaxScore(s.grade, "math")} Л:{s.lo}/{getMaxScore(s.grade, "logic")} А:{s.en}/{getMaxScore(s.grade, "english")}'
content = re.sub(old_display, new_display, content)

# Same for selected student details modal
# Old: const maxRu = gradeData.russian.reduce((sum, q) => sum + (q.points || 1), 0);
old_maxru = r'const maxLo = gradeData\.logic\.reduce\(\(sum, q\) => sum \+ \(q\.points \|\| 1\), 0\);'
new_maxru = r'const maxLo = gradeData.logic.reduce((sum, q) => sum + (q.points || 1), 0);\n                    const maxEn = gradeData.english?.reduce((sum, q) => sum + (q.points || 1), 0) || "?";'
content = re.sub(old_maxru, new_maxru, content)

old_stat = r'<div className="bg-white p-3 rounded shadow-sm border border-slate-200 text-center">\s*<div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Логика</div>\s*<div className="text-xl font-bold text-slate-800">\{student\.lo\} / \{maxLo\}</div>\s*</div>'
new_stat = r'<div className="bg-white p-3 rounded shadow-sm border border-slate-200 text-center">\n                        <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Логика</div>\n                        <div className="text-xl font-bold text-slate-800">{student.lo} / {maxLo}</div>\n                      </div>\n                      <div className="bg-white p-3 rounded shadow-sm border border-slate-200 text-center">\n                        <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Английский</div>\n                        <div className="text-xl font-bold text-slate-800">{student.en || 0} / {maxEn}</div>\n                      </div>'
content = re.sub(old_stat, new_stat, content)

with open("src/pages/ManagerDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
