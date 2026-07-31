const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.studyfreeforum.com/test', { waitUntil: 'networkidle2' });
  
  await page.screenshot({ path: 'snapshot_1.png' });
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('page_1.html', html);
  
  console.log("Saved screenshot and html.");
  await browser.close();
})();
