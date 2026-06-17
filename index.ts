import puppeteer from 'puppeteer';
import { fetchJSON } from './lib/helpers';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

interface Challenge {
  slug: string
  name: string
  category: string
  preview: string
  max_score: number
}

interface ChallengesResponse {
  models: Challenge[];
  total: number;
}

const CONTEST_SLUG = process.env.CONTEST_SLUG

async function scrapeContest() {
  if (!process.env.HACKERRANK_EMAIL || !process.env.HACKERRANK_PASSWORD || !process.env.SCRAPER_SECRET || !process.env.CONVEX_URL || !CONTEST_SLUG) {
    console.log('Envs not set')
    return
  }

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

  await page.goto('https://www.hackerrank.com/auth/login', { waitUntil: 'networkidle2' });

  await page.waitForSelector('input[name="username"]', { timeout: 2000 });
  await page.type('input[name="username"]', process.env.HACKERRANK_EMAIL);
  await page.type('input[name="password"]', process.env.HACKERRANK_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('Logged in, current URL:', page.url());

  const { models } = await fetchJSON(page,
    `https://www.hackerrank.com/rest/contests/${CONTEST_SLUG}/challenges?limit=100`) as ChallengesResponse

  if (!models) {
    console.log('error fetching challenges')
    return
  }

  const convex = new ConvexHttpClient(process.env.CONVEX_URL);

  await convex.mutation(anyApi.challenges!.storeChallenges as any, {
    secret: process.env.SCRAPER_SECRET,
    challenges: models.map(c => ({
      slug: c.slug,
      name: c.name,
      category: c.category,
      preview: c.preview,
      max_score: c.max_score
    }))
  });

  console.log(`Stored ${models.length} challenges`);
  await browser.close();
}

await scrapeContest()
