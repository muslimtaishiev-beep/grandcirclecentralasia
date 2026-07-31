const fs = require('fs');

let content = fs.readFileSync('src/data/testsData.ts', 'utf8');

// Replace ru_5_new text
const ru5_old = `        text: "Задание №5. Вставьте пропущенные буквы и раскройте скобки:\\nНе [ ] дерзость.\\nЗадача [ ].",
        inlineSegments: [
          { type: "text", text: "Не " },
          { type: "input", id: "input1" },
          { type: "text", text: " дерзость.\\nЗадача " },
          { type: "input", id: "input2" },
          { type: "text", text: "." }
        ]`;
        
const ru5_new = `        text: "Задание №5. Впишите пропущенные буквы, раскрывая скобки (например: слыханная, решена):",
        inlineSegments: [
          { type: "text", text: "не(слыха..ая) дерзость — не" },
          { type: "input", id: "input1" },
          { type: "text", text: " дерзость\\nзадача (реше..а) — задача " },
          { type: "input", id: "input2" }
        ]`;
content = content.replace(ru5_old, ru5_new);

// Replace ru_9 segments
const ru9_old = `        clickableSegments: [
          { text: "Фонарь " },
          { text: "[1]", id: "1", isTarget: true },
          { text: " одиноко стоявший " },
          { text: "[2]", id: "2", isTarget: true },
          { text: " на земле " },
          { text: "[3]", id: "3", isTarget: true },
          { text: " осветил " },
          { text: "[4]", id: "4", isTarget: true },
          { text: " издающее " },
          { text: "[5]", id: "5", isTarget: true },
          { text: " непонятные звуки " },
          { text: "[6]", id: "6", isTarget: true },
          { text: " создание." }
        ]`;
        
const ru9_new = `        clickableSegments: [
  { "text": "Фонарь" }, { "text": " [,] ", "id": "1", "isTarget": true },
  { "text": "одиноко" }, { "text": " [,] ", "id": "2", "isTarget": true },
  { "text": "стоявший" }, { "text": " [,] ", "id": "3", "isTarget": true },
  { "text": "на" }, { "text": " [,] ", "id": "4", "isTarget": true },
  { "text": "земле" }, { "text": " [,] ", "id": "5", "isTarget": true },
  { "text": "осветил" }, { "text": " [,] ", "id": "6", "isTarget": true },
  { "text": "издающее" }, { "text": " [,] ", "id": "7", "isTarget": true },
  { "text": "непонятные" }, { "text": " [,] ", "id": "8", "isTarget": true },
  { "text": "звуки" }, { "text": " [,] ", "id": "9", "isTarget": true },
  { "text": "создание." }
]`;
content = content.replace(ru9_old, ru9_new);

// Replace ru_10 segments
const ru10_old = `        clickableSegments: [
          { text: "Проходя " },
          { text: "[1]", id: "1", isTarget: true },
          { text: " по залам музеев " },
          { text: "[2]", id: "2", isTarget: true },
          { text: " люди " },
          { text: "[3]", id: "3", isTarget: true },
          { text: " останавливаются у прекрасных картин художника И. Репина " },
          { text: "[4]", id: "4", isTarget: true },
          { text: " восхищаясь " },
          { text: "[5]", id: "5", isTarget: true },
          { text: " совершенством живописи." }
        ]`;
        
const ru10_new = `        clickableSegments: [
  { "text": "Проходя" }, { "text": " [,] ", "id": "1", "isTarget": true },
  { "text": "по" }, { "text": " [,] ", "id": "2", "isTarget": true },
  { "text": "залам" }, { "text": " [,] ", "id": "3", "isTarget": true },
  { "text": "музеев" }, { "text": " [,] ", "id": "4", "isTarget": true },
  { "text": "люди" }, { "text": " [,] ", "id": "5", "isTarget": true },
  { "text": "останавливаются" }, { "text": " [,] ", "id": "6", "isTarget": true },
  { "text": "у" }, { "text": " [,] ", "id": "7", "isTarget": true },
  { "text": "прекрасных" }, { "text": " [,] ", "id": "8", "isTarget": true },
  { "text": "картин" }, { "text": " [,] ", "id": "9", "isTarget": true },
  { "text": "художника" }, { "text": " [,] ", "id": "10", "isTarget": true },
  { "text": "И." }, { "text": " [,] ", "id": "11", "isTarget": true },
  { "text": "Репина" }, { "text": " [,] ", "id": "12", "isTarget": true },
  { "text": "восхищаясь" }, { "text": " [,] ", "id": "13", "isTarget": true },
  { "text": "совершенством" }, { "text": " [,] ", "id": "14", "isTarget": true },
  { "text": "живописи." }
]`;
content = content.replace(ru10_old, ru10_new);

// Replace ru_7_new segments
const ru7_old = `        clickableSegments: [
          { text: "Ветер" },
          { text: " [,] ", id: "1", isTarget: true },
          { text: "дующий с моря" },
          { text: " [,] ", id: "2", isTarget: true },
          { text: "принес прохладу." }
        ]`;

const ru7_new = `        clickableSegments: [
  { "text": "Ветер" }, { "text": " [,] ", "id": "1", "isTarget": true },
  { "text": "дующий" }, { "text": " [,] ", "id": "2", "isTarget": true },
  { "text": "с" }, { "text": " [,] ", "id": "3", "isTarget": true },
  { "text": "моря" }, { "text": " [,] ", "id": "4", "isTarget": true },
  { "text": "принес" }, { "text": " [,] ", "id": "5", "isTarget": true },
  { "text": "прохладу." }
]`;
content = content.replace(ru7_old, ru7_new);

fs.writeFileSync('src/data/testsData.ts', content);
console.log("Updated testsData.ts");
