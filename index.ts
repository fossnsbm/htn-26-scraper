import { authenticate, fetchJSON, init } from './lib/helpers';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

interface Challenge {
  slug: string
  name: string
  category: string
  difficulty_name: string
  preview: string
  max_score: number
}

interface ChallengesResponse {
  models: Challenge[];
  total: number;
}

interface Submission {
  status: string;
  created_at: number;
  hacker_username: string;
  challenge: {
    name: string;
    slug: string;
  };
}

interface SubmissionsResponse {
  models: Submission[];
  total: number;
}

const CONTEST_SLUG = process.env.CONTEST_SLUG

async function scrapeChallenges() {
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
      difficulty: c.difficulty_name.toLowerCase(),
      preview: c.preview,
      max_score: c.max_score
    }))
  });

  console.log(`Stored ${models.length} challenges`);
  await browser.close();
}

async function pollSubmissions() {
  if (!process.env.HACKERRANK_EMAIL || !process.env.HACKERRANK_PASSWORD || !process.env.SCRAPER_SECRET || !process.env.CONVEX_URL || !CONTEST_SLUG) {
    console.log('Envs not set')
    return
  }

  const { page } = await init()

  await authenticate(page, { username: process.env.HACKERRANK_EMAIL, password: process.env.HACKERRANK_PASSWORD })

  const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

  setInterval(async () => {
    console.log('polling submissions')
    const { models } = await fetchJSON(page,
      `https://www.hackerrank.com/rest/contests/${CONTEST_SLUG}/judge_submissions?limit=400`) as SubmissionsResponse

    if (!models) {
      console.log('error fetching submissions')
      return
    }

    const accepted = models.filter(s => s.status === 'Accepted');

    if (accepted.length === 0) return;

    await convex.mutation(anyApi.challenges!.updateChallengeProgress as any, {
      secret: process.env.SCRAPER_SECRET,
      submissions: accepted.map(s => ({
        hackerUsername: s.hacker_username,
        challengeSlug: s.challenge.slug,
        solvedAt: s.created_at,
      }))
    });

    console.log(`Synced ${accepted.length} accepted submissions`);
  }, 60_000)
}

Bun.argv[2] === 'challenges' && await scrapeChallenges()
Bun.argv[2] === 'submissions' && await pollSubmissions()
