const fs = require('fs');

let content = fs.readFileSync('src/pages/Testing.tsx', 'utf8');

// 1. Update all <input type="text" and <input type="number" with autocomplete off
content = content.replace(/<input\s+type="(text|number)"/g, '<input\n                      autoComplete="off"\n                      autoCorrect="off"\n                      autoCapitalize="off"\n                      spellCheck={false}\n                      type="$1"');

// 2. Change disqualified text and add audio
const disqualifiedOld = `          <h2 className="text-2xl font-bold text-slate-800 mb-2">Тест аннулирован</h2>
        <p className="text-slate-600 mb-6">Вы покинули страницу во время тестирования. Результат аннулирован в соответствии с правилами.</p>`;

const disqualifiedNew = `          <h2 className="text-2xl font-bold text-slate-800 mb-2">Вы пойманы на списывании</h2>
        <p className="text-slate-600 mb-6">Вы покинули страницу во время тестирования. Результат аннулирован в соответствии с правилами.</p>
        <audio autoPlay src="https://www.myinstants.com/media/sounds/directed-by-robert-b_voI2Z4T.mp3" />`;

content = content.replace(disqualifiedOld, disqualifiedNew);

fs.writeFileSync('src/pages/Testing.tsx', content);
console.log("Updated Testing.tsx");
