import type { Page } from "puppeteer";

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
