with open("src/data/testsData.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 8
content = content.replace(
    "    math: math_grade_8,\n    logic: commonLogicQuestions,\n  },",
    "    math: math_grade_8,\n    logic: commonLogicQuestions,\n    english: english_grade_8,\n  },"
)

# Fix 9
content = content.replace(
    "    math: math_grade_9,\n    logic: commonLogicQuestions,\n  },",
    "    math: math_grade_9,\n    logic: commonLogicQuestions,\n    english: english_grade_9,\n  },"
)

# Fix 10
content = content.replace(
    "    math: math_grade_10,\n    logic: commonLogicQuestions,\n  },",
    "    math: math_grade_10,\n    logic: commonLogicQuestions,\n    english: english_grade_10_11,\n  },"
)

# Fix 11
content = content.replace(
    "    math: math_grade_11,\n    logic: commonLogicQuestions,\n  },\n};",
    "    math: math_grade_11,\n    logic: commonLogicQuestions,\n    english: english_grade_10_11,\n  },\n};"
)

with open("src/data/testsData.ts", "w", encoding="utf-8") as f:
    f.write(content)
