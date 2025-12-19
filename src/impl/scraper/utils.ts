import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import Parser from 'rss-parser';
import { URL } from 'url';

const MAX_FEED_SIZE = 5_000_000; // 5 MB
const TIMEOUT_MS = 30_000; // 30 seconds
const USER_AGENT = 'Mozilla/5.0 RSS Bot';
const MAX_REDIRECTS = 5;

/**
 * Fetches the raw RSS feed content at the given URL, enforcing timeout,
 * status-code check, and maximum size limit, using only built-in Node.js modules.
 *
 * @param urlStr The feed URL to fetch.
 * @returns The body as a UTF-8 string.
 */
export async function fetchSingle(
  urlStr: string,
  redirectCount = 0
): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error("Too many redirects");
  }

  const url = new URL(urlStr);
  const isHttps = url.protocol === "https:";
  const requestFn = isHttps ? httpsRequest : httpRequest;

  return new Promise<string>((resolve, reject) => {
    const req = requestFn(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
        },
      },
      (res) => {
        const { statusCode, headers } = res;

        // --- HANDLE REDIRECTS ---
        if (
          statusCode &&
          [301, 302, 303, 307, 308].includes(statusCode)
        ) {
          const location = headers.location;
          res.resume(); // drain before redirecting

          if (!location) {
            reject(new Error(`Redirect (${statusCode}) without Location header`));
            return;
          }

          const nextUrl = new URL(location, url).toString();
          resolve(fetchSingle(nextUrl, redirectCount + 1));
          return;
        }

        // --- HANDLE NON-SUCCESS ---
        if (!statusCode || statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        // --- READ BODY ---
        let totalLength = 0;
        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer) => {
          totalLength += chunk.length;
          if (totalLength > MAX_FEED_SIZE) {
            req.destroy();
            reject(new Error(`Feed too large: ${totalLength} bytes`));
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf-8"));
        });
      }
    );

    req.on("error", reject);

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });

    req.end();
  });
}



export function extractImage(entry: Parser.Item): string | null {
  const html = entry.content?.toString();
  if (!html) return null;
  const match = /<img[^>]+src=["']([^"']+)["'][^>]*>/i.exec(html);
  if (!match?.[1]) return null;

  if (match && validateImageUrl(match[1])) {
    return match[1];
  }
  return null;
}

export function validateImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].some(ext => lower.includes(ext))
      || lower.includes("image") || lower.includes("img");
}


