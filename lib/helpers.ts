import type { Page } from "puppeteer";
import puppeteer from "puppeteer";

interface Credentials {
  username: string
  password: string
}

export async function init() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return { browser, page }
}

export async function authenticate(page: Page, credentials: Credentials) {
  await page.goto('https://www.hackerrank.com/auth/login', { waitUntil: 'networkidle2' });

  await page.waitForSelector('input[name="username"]', { timeout: 2000 });
  await page.type('input[name="username"]', credentials.username);
  await page.type('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('Logged in, current URL:', page.url());

}

export async function fetchJSON(page: Page, url: string) {
  return page.evaluate(async (url) => {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }, url);
}

