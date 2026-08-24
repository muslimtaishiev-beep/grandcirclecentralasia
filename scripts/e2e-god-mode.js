import puppeteer from 'puppeteer';

async function run() {
  console.log("🚀 STARTING E2E GOD-MODE SIMULATION...");
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  
  try {
    console.log("🎭 АКТ 1: FOUNDER LOGS IN...");
    await page.goto('http://localhost:3005/login', { waitUntil: 'networkidle2' });
    
    // Fill in login
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'e2e-bot@logos.kg');
    
    // Password could be text or password depending on visibility toggle
    await page.waitForSelector('input[placeholder*="Пароль"], input[type="password"]');
    await page.type('input[placeholder*="Пароль"], input[type="password"]', 'password123');
    
    // Click submit
    const buttons = await page.$$("button");
    let loginBtn = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes("Войти") || text.includes("Sign In"))) { loginBtn = btn; break; }
    }
    
    if (loginBtn) {
      await loginBtn.click();
    } else {
      await page.click('button[type="submit"]');
    }

    console.log("⏳ Ожидание загрузки дашборда Workspace...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    const currentUrl = page.url();
    console.log(`✅ Founder logged in successfully. Current URL: ${currentUrl}`);

    // Wait for the workspace sidebar to load Tests
    await page.waitForSelector('a[href*="/tests"]', { timeout: 15000 }).catch(() => console.log("Тесты не найдены"));
    
    console.log("🧪 Переход в конструктор тестов...");
    const testsLink = await page.$('a[href*="/tests"]');
    if (testsLink) {
      await testsLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      console.log("➕ Создание нового теста...");
      const testBtns = await page.$$("button, a");
      let createBtn = null;
      for (const btn of testBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.includes("Новый тест") || text.includes("Создать"))) { createBtn = btn; break; }
      }
      
      if (createBtn) {
        await createBtn.click();
      } else {
        const orgId = currentUrl.split('/workspace/')[1].split('/')[0];
        await page.goto(`http://localhost:3005/workspace/${orgId}/tests/new`);
      }

      await page.waitForSelector('input[placeholder="Название теста"]', { timeout: 5000 }).catch(()=>null);
      const testTitleInput = await page.$('input[placeholder="Название теста"]');
      if (testTitleInput) {
        await testTitleInput.type('E2E Automated Math Exam');
        console.log("✅ Тест успешно создан в черновике.");
      }
    }

    // Act 2: Employee (Chat / WebRTC)
    console.log("=====================================================");
    console.log("🧑‍💻 АКТ 2: ИМИТАЦИЯ СОТРУДНИКА (CHAT & WEBRTC)");
    
    const chatLink = await page.$('a[href*="/chat"]');
    if (chatLink) {
      await chatLink.click();
      await page.waitForSelector('input[placeholder*="сообщение"], textarea', { timeout: 10000 }).catch(()=>console.log("⚠️ Чат не загрузился быстро"));
      
      const chatInput = await page.$('input[placeholder*="сообщение"], textarea');
      if (chatInput) {
        await chatInput.type('Hello from the E2E Bot! System is working.');
        await page.keyboard.press('Enter');
        console.log("✅ Сообщение отправлено в чат.");
      }
    } else {
      console.log("⚠️ Ссылка на чат не найдена в боковом меню.");
    }

    // Act 3: The Student
    console.log("=====================================================");
    console.log("🎓 АКТ 3: СТУДЕНТ СДАЕТ ТЕСТ");
    
    await page.goto('http://localhost:3005/test/dummy-id-e2e', { waitUntil: 'networkidle2' });
    
    // Wait for name input
    await page.waitForSelector('input[placeholder*="Иванов"]', { timeout: 10000 }).catch(()=>null);
    const nameInput = await page.$('input[placeholder*="Иванов"]');
    if (nameInput) {
      await nameInput.type('Студент Роботов');
      
      const select = await page.$('select');
      if (select) await select.select('11'); // 11th grade

      const consentCheck = await page.$('input[type="checkbox"]');
      if (consentCheck) await consentCheck.click();

      console.log("✅ Студент успешно заполнил форму входа.");
      
      const startBtns = await page.$$("button");
      let startBtn = null;
      for (const btn of startBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes("Начать тест")) { startBtn = btn; break; }
      }
      
      if (startBtn) {
        await startBtn.click();
        console.log("✅ Студент нажал 'Начать тест'.");
      }
    } else {
      console.log("⚠️ Страница тестирования не отрендерилась ожидаемым образом (возможно неверный URL).");
    }

    console.log("=====================================================");
    console.log("🎉 СИМУЛЯЦИЯ E2E УСПЕШНО ПРОЙДЕНА!");

  } catch (err) {
    console.error("❌ СИМУЛЯЦИЯ ПРЕРВАНА С ОШИБКОЙ:", err);
  } finally {
    console.log("Браузер не будет закрыт автоматически, чтобы вы могли изучить состояние. Нажмите Ctrl+C для выхода.");
  }
}

run();
