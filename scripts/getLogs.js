import puppeteer from 'puppeteer';
import http from 'http';

// We need to run the dev server or use the running one. The user is running it on localhost:5173.
async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('workercreated', worker => {
    worker.on('console', msg => console.log('WORKER LOG:', msg.text()));
  });

  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  page.on('response', response => {
    if (!response.ok()) {
      console.log('BAD RESPONSE:', response.status(), response.url());
    }
  });
  
  try {
    await page.goto('http://localhost:5175', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch(e) {
    console.log('Timeout or error:', e.message);
  }
  
  await browser.close();
}

run();
