const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // Set viewport to a good size
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('https://www.studyfreeforum.com/test', { waitUntil: 'networkidle2' });
  
  // Fill the form
  const inputs = await page.$$('input[type="text"]');
  if (inputs.length >= 1) {
    await inputs[0].type('Тест Сценарий А');
  }
  await page.select('select', '8');
  if (inputs.length >= 2) {
    await inputs[1].type('1234');
  }
  
  // Look for tester PIN field (could be type="password" or just another text input or number)
  const allInputs = await page.$$('input');
  for (const input of allInputs) {
    const type = await page.evaluate(el => el.type, input);
    const ph = await page.evaluate(el => el.placeholder, input) || '';
    if (ph.toLowerCase().includes('pin') || ph.toLowerCase().includes('пин')) {
       await input.type('4064');
    }
  }
  
  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) {
    await checkbox.click();
  }
  
  // Click start button
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.toLowerCase().includes('нач') || text.toLowerCase().includes('start')) {
      await btn.click();
      break;
    }
  }
  
  // Wait for load
  await new Promise(r => setTimeout(r, 4000));
  
  await page.screenshot({ path: 'test_progress.png' });
  const html = await page.content();
  fs.writeFileSync('page_2.html', html);
  
  console.log("Saved test_progress.png and page_2.html");
  await browser.close();
})();
