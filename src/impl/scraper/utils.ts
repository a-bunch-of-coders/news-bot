import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';

const MAX_FEED_SIZE = 5_000_000; // 5 MB
const TIMEOUT_MS = 30_000; // 30 seconds
const USER_AGENT = 'Mozilla/5.0 RSS Bot';

/**
 * Fetches the raw RSS feed content at the given URL, enforcing timeout,
 * status-code check, and maximum size limit, using only built-in Node.js modules.
 *
 * @param urlStr The feed URL to fetch.
 * @returns The body as a UTF-8 string.
 */
export async function fetchSingle(urlStr: string): Promise<string> {
  const url = new URL(urlStr);
  const isHttps = url.protocol === 'https:';
  const requestFn = isHttps ? httpsRequest : httpRequest;

  return new Promise<string>((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
      },
    };

    const req = requestFn(options, (res) => {
      const { statusCode } = res;
      if (!statusCode || statusCode < 200 || statusCode >= 300) {
        res.resume(); // consume response to free memory
        return reject(new Error(`HTTP ${statusCode}`));
      }

      let totalLength = 0;
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        totalLength += chunk.length;
        if (totalLength > MAX_FEED_SIZE) {
          req.destroy();
          return reject(new Error(`Feed too large: ${totalLength} bytes`));
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks, totalLength);
        resolve(buffer.toString('utf-8'));
      });
    });

    req.on('error', (err) => reject(err));

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}


export function extractImage(entry: any): string | null {
  const html = entry.content?.body || entry.summary?.content;
  if (!html) return null;
  const match = /<img[^>]+src=["']([^"']+)["'][^>]*>/i.exec(html);
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

