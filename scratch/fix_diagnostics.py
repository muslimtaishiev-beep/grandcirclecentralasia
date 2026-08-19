with open('scratch/Code_Fixed.gs', 'r') as f:
    code = f.read()

# Remove the early returns that skip items without a topic
code = code.replace('if (!qData.topic || qData.topic === "Общая тема") return;', '')

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(code)

print("Fixed diagnosticsRaw skipping")
