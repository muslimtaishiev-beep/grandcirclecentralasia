with open("src/lib/utils.ts", "r", encoding="utf-8") as f:
    content = f.read()

old_func = """export function getHourlyPIN(hourOffset: number = 0): string {
  const d = new Date();
  d.setHours(d.getHours() + hourOffset);
  const seed = d.getFullYear() * 1000000 + (d.getMonth() + 1) * 10000 + d.getDate() * 100 + d.getHours();
  const pin = (seed * 1103515245 + 12345) % 9000 + 1000;
  return Math.abs(pin).toString();
}"""

new_func = """export function getHourlyPIN(hourOffset: number = 0): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hourOffset);
  const seed = d.getUTCFullYear() * 1000000 + (d.getUTCMonth() + 1) * 10000 + d.getUTCDate() * 100 + d.getUTCHours();
  const pin = (seed * 1103515245 + 12345) % 9000 + 1000;
  return Math.abs(pin).toString();
}"""

content = content.replace(old_func, new_func)

with open("src/lib/utils.ts", "w", encoding="utf-8") as f:
    f.write(content)
