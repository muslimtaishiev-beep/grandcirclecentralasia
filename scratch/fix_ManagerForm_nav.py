with open('src/pages/ManagerForm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

old_logic = r'''      const data = await res.json\(\);
      if \(data.success\) \{
        navigate\("/manager-dashboard"\);
      \} else \{
        setError\(data.error\);
      \}'''

new_logic = r'''      const data = await res.json();
      if (data.success) {
        if (isPsych) {
          navigate(`/receipt/${shortId}`);
        } else {
          navigate("/manager-dashboard");
        }
      } else {
        setError(data.error);
      }'''

content = re.sub(old_logic, new_logic, content)

with open('src/pages/ManagerForm.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
