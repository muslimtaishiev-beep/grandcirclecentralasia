const fs = require('fs');

const dir = 'src/pages';
const files = fs.readdirSync(dir).map(f => dir + '/' + f).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('import.meta.env.VITE_GAS_URL')) {
    content = content.replace(/import\.meta\.env\.VITE_GAS_URL/g, '"/api/gas"');
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
}
