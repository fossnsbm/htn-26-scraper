import { authenticate, fetchJSON, init } from './lib/helpers';
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

  const { browser, page } = await init()

  await authenticate(page, { username: process.env.HACKERRANK_EMAIL, password: process.env.HACKERRANK_PASSWORD })

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
