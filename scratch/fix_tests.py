with open("src/data/testsData.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix en_10_11_q41
content = content.replace(
    'dragItems: ["for", "been", "has", "she", "looking", "job", "a", "months", "six"]',
    'dragItems: ["for", "been", "has", "she", "looking", "job", "a", "months", "six", "for"]'
)
content = content.replace(
    'text: "for / been / has / she / looking / job / a / months / six",',
    'text: "for / been / has / she / looking / job / a / months / six / for",'
)

# Fix en_10_11_q43
content = content.replace(
    'dragItems: ["to", "would", "I", "rather", "home", "stay", "than", "go", "out"]',
    'dragItems: ["at", "would", "I", "rather", "home", "stay", "than", "go", "out"]'
)
content = content.replace(
    'text: "to / would / I / rather / home / stay / than / go / out",',
    'text: "at / would / I / rather / home / stay / than / go / out",'
)

# Fix en_10_11_q45
content = content.replace(
    'dragItems: ["try", "button", "press", "this", "to", "see", "if", "works", "it"]',
    'dragItems: ["try", "button", "pressing", "this", "to", "see", "if", "works", "it"]'
)
content = content.replace(
    'text: "try / button / press / this / to / see / if / works / it",',
    'text: "try / button / pressing / this / to / see / if / works / it",'
)

with open("src/data/testsData.ts", "w", encoding="utf-8") as f:
    f.write(content)
