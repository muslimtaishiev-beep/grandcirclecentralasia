with open("server.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix tester pin check
content = content.replace(
    'if (TESTER_PIN && payload.action === "submitTest" && payload.testerPin) {',
    'if (TESTER_PIN && (payload.action === "submitTest" || payload.action === "submitEnglishTest") && payload.testerPin) {'
)

# Fix public actions
content = content.replace(
    'const publicActions = ["submitTest", "getStudentByShortId",',
    'const publicActions = ["submitTest", "submitEnglishTest", "getStudentByShortId",'
)

with open("server.ts", "w", encoding="utf-8") as f:
    f.write(content)
