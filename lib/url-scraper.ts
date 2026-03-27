import "server-only";

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;
const MAX_CONTENT_LENGTH = 3000;
const FETCH_TIMEOUT = 8000;

export interface ScrapedPage {
  url: string;
  title: string;
  description: string;
  content: string;
}

/** Extract all HTTP(S) URLs from a text string. */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  // Deduplicate and strip trailing punctuation
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?)>\]]+$/, "");
    try {
      const parsed = new URL(cleaned);
      const normalized = parsed.href;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        urls.push(normalized);
      }
    } catch {
      // skip invalid URLs
    }
  }

  return urls;
}

/** Fetch a webpage and extract its title, meta description, and body text. */
export async function scrapePage(url: string): Promise<ScrapedPage | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PlanPilotBot/1.0; +https://planpilot.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const html = await response.text();

    const title = extractTag(html, "title") || new URL(url).hostname;
    const description =
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "";

    // Extract visible text from body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch?.[1] || html;

    const visibleText = bodyHtml
      // Remove script, style, nav, footer, header tags and their content
      .replace(/<(script|style|nav|footer|header|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      // Remove all HTML tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();

    const content = visibleText.slice(0, MAX_CONTENT_LENGTH);

    return { url, title, description, content };
  } catch (error) {
    console.warn(`[url-scraper] Failed to fetch ${url}:`, (error as Error).message);
    return null;
  }
}

/** Scrape multiple URLs in parallel, returning only successful results. */
export async function scrapeUrls(urls: string[]): Promise<ScrapedPage[]> {
  // Limit to 3 URLs max to avoid slow responses
  const limited = urls.slice(0, 3);
  const results = await Promise.all(limited.map(scrapePage));
  return results.filter((r): r is ScrapedPage => r !== null);
}

/** Format scraped pages into a prompt-friendly string. */
export function formatScrapedPages(pages: ScrapedPage[]): string {
  if (!pages.length) return "";

  return pages
    .map(
      (page) =>
        `--- Referenced website: ${page.url} ---
Title: ${page.title}
Description: ${page.description || "(none)"}
Page content summary:
${page.content}
--- End of ${page.url} ---`,
    )
    .join("\n\n");
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match
    ? match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : null;
}

function extractMetaContent(html: string, name: string): string | null {
  // Match both name="..." and property="..."
  const patterns = [
    new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}
