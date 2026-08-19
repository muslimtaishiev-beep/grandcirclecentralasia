with open('scratch/Code_final.gs', 'r') as f:
    code = f.read()

parse_logic = """
  // Если answers пришел в виде JSON-строки, парсим его в объект:
  if (typeof answers === 'string') {
    try { 
      answers = JSON.parse(answers); 
    } catch(e) { 
      answers = {}; 
    }
  }

  let ru = 0, ma = 0, lo = 0, en = 0;
"""

code = code.replace("  let ru = 0, ma = 0, lo = 0, en = 0;", parse_logic)

with open('scratch/Code_final.gs', 'w') as f:
    f.write(code)

print("Added JSON parse logic to Code_final.gs")
