import re

with open('src/data/testsData.ts', 'r') as f:
    code = f.read()

# Replace logic: commonLogicQuestions, with logic: commonLogicQuestions, english: english_grade_X,
code = re.sub(r'7: \{\s*russian: (.*?),(\s*)math: (.*?),(\s*)logic: commonLogicQuestions,?\s*\}', r'7: {\n    russian: \1,\2math: \3,\4logic: commonLogicQuestions,\n    english: [],\n  }', code)
code = re.sub(r'8: \{\s*russian: (.*?),(\s*)math: (.*?),(\s*)logic: commonLogicQuestions,?\s*\}', r'8: {\n    russian: \1,\2math: \3,\4logic: commonLogicQuestions,\n    english: english_grade_8,\n  }', code)
code = re.sub(r'9: \{\s*russian: (.*?),(\s*)math: (.*?),(\s*)logic: commonLogicQuestions,?\s*\}', r'9: {\n    russian: \1,\2math: \3,\4logic: commonLogicQuestions,\n    english: english_grade_9,\n  }', code)
code = re.sub(r'10: \{\s*russian: (.*?),(\s*)math: (.*?),(\s*)logic: commonLogicQuestions,?\s*\}', r'10: {\n    russian: \1,\2math: \3,\4logic: commonLogicQuestions,\n    english: english_grade_10_11,\n  }', code)
code = re.sub(r'11: \{\s*russian: (.*?),(\s*)math: (.*?),(\s*)logic: commonLogicQuestions,?\s*\}', r'11: {\n    russian: \1,\2math: \3,\4logic: commonLogicQuestions,\n    english: english_grade_10_11,\n  }', code)

with open('src/data/testsData.ts', 'w') as f:
    f.write(code)
