with open("src/lib/utils.ts", "r", encoding="utf-8") as f:
    content = f.read()

old_pin_func = """export function getHourlyPIN(): string {
  const d = new Date();
  const seed = d.getFullYear() * 1000000 + (d.getMonth() + 1) * 10000 + d.getDate() * 100 + d.getHours();
  const pin = (seed * 1103515245 + 12345) % 9000 + 1000;
  return Math.abs(pin).toString();
}"""

new_pin_func = """export function getHourlyPIN(hourOffset: number = 0): string {
  const d = new Date();
  d.setHours(d.getHours() + hourOffset);
  const seed = d.getFullYear() * 1000000 + (d.getMonth() + 1) * 10000 + d.getDate() * 100 + d.getHours();
  const pin = (seed * 1103515245 + 12345) % 9000 + 1000;
  return Math.abs(pin).toString();
}"""

content = content.replace(old_pin_func, new_pin_func)
with open("src/lib/utils.ts", "w", encoding="utf-8") as f:
    f.write(content)

with open("src/pages/Testing.tsx", "r", encoding="utf-8") as f:
    testing = f.read()

testing = testing.replace(
    "if (!isTester && enteredPin !== getHourlyPIN()) {",
    "if (!isTester && enteredPin !== getHourlyPIN(0) && enteredPin !== getHourlyPIN(-1) && enteredPin !== getHourlyPIN(1)) {"
)

with open("src/pages/Testing.tsx", "w", encoding="utf-8") as f:
    f.write(testing)
