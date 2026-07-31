with open('src/pages/ManagerForm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const submitForm = async () => {', 'const submitForm = async (isPsych: boolean) => {')
content = content.replace('sentToPsych\n        })', 'sentToPsych: isPsych\n        })')

content = content.replace('onClick={() => handleSubmit(false)}', 'onClick={() => submitForm(false)}')
content = content.replace('onClick={() => handleSubmit(true)}', 'onClick={() => submitForm(true)}')

with open('src/pages/ManagerForm.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
