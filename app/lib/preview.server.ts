import { parse as parseHtml } from 'node-html-parser';
import { detectPlatform } from './platform';

export interface PreviewResult {
  title: string | null;
  description: string | null;
  author: string | null;
  siteName: string | null;
  thumbnailBuffer: Buffer | null;
  thumbnailMime: string | null;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; WhatsApp/2.23.20.76; +http://www.whatsapp.com)';

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImageBuffer(
  imageUrl: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    if (!imageUrl || !imageUrl.startsWith('http')) return null;
    const res = await fetchWithTimeout(imageUrl, {}, 5000);
    if (!res.ok) return null;

    const mime =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    if (!mime.startsWith('image/')) return null;

    const arrayBuffer = await res.arrayBuffer();
    // Max 2.5MB
    if (arrayBuffer.byteLength > 2.5 * 1024 * 1024) return null;

    return {
      buffer: Buffer.from(arrayBuffer),
      mime,
    };
  } catch {
    return null;
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<PreviewResult> {
  const platform = detectPlatform(rawUrl);
  let title: string | null = null;
  let description: string | null = null;
  let author: string | null = null;
  let siteName: string | null = null;
  let imageUrl: string | null = null;

  try {
    // 1. YouTube specialized scraper (oEmbed)
    if (platform === 'youtube') {
      siteName = 'YouTube';
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
          rawUrl
        )}&format=json`;
        const res = await fetchWithTimeout(oembedUrl, {}, 4000);
        if (res.ok) {
          const data = (await res.json()) as any;
          title = data.title || null;
          author = data.author_name || null;
          imageUrl = data.thumbnail_url || null;
        }
      } catch {
        // Fallback: extract video ID
        try {
          const urlObj = new URL(rawUrl);
          const videoId =
            urlObj.searchParams.get('v') ||
            (urlObj.pathname.startsWith('/shorts/')
              ? urlObj.pathname.split('/')[2]
              : null);
          if (videoId) {
            imageUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }
        } catch {}
      }
    }

    // 2. X / Twitter specialized scraper (FxTwitter API)
    else if (platform === 'x') {
      siteName = 'X';
      try {
        const match = rawUrl.match(
          /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i
        );
        if (match) {
          const [, username, statusId] = match;
          const fxUrl = `https://api.fxtwitter.com/${username}/status/${statusId}`;
          const res = await fetchWithTimeout(fxUrl, {}, 5000);
          if (res.ok) {
            const data = (await res.json()) as any;
            if (data?.tweet) {
              const tweet = data.tweet;
              title = tweet.text?.slice(0, 200) || `Post de @${username}`;
              description = tweet.text || null;
              author = tweet.author?.name
                ? `${tweet.author.name} (@${tweet.author.screen_name})`
                : `@${username}`;
              imageUrl =
                tweet.media?.photos?.[0]?.url ||
                tweet.media?.mosaic?.formats?.jpeg ||
                tweet.author?.avatar_url ||
                null;
            }
          }
        }
      } catch {}
    }

    // 3. TikTok specialized scraper (oEmbed)
    else if (platform === 'tiktok') {
      siteName = 'TikTok';
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
          rawUrl
        )}`;
        const res = await fetchWithTimeout(oembedUrl, {}, 4000);
        if (res.ok) {
          const data = (await res.json()) as any;
          title = data.title || null;
          author = data.author_name || null;
          imageUrl = data.thumbnail_url || null;
        }
      } catch {}
    }

    // 4. General HTML / OpenGraph fallback (if title or image still missing)
    if (!title || !imageUrl) {
      const res = await fetchWithTimeout(rawUrl, {}, 5000);
      if (res.ok) {
        const html = await res.text();
        const root = parseHtml(html);

        if (!title) {
          title =
            root
              .querySelector('meta[property="og:title"]')
              ?.getAttribute('content') ||
            root
              .querySelector('meta[name="twitter:title"]')
              ?.getAttribute('content') ||
            root.querySelector('title')?.textContent ||
            null;
        }

        if (!description) {
          description =
            root
              .querySelector('meta[property="og:description"]')
              ?.getAttribute('content') ||
            root
              .querySelector('meta[name="twitter:description"]')
              ?.getAttribute('content') ||
            root
              .querySelector('meta[name="description"]')
              ?.getAttribute('content') ||
            null;
        }

        if (!author) {
          author =
            root
              .querySelector('meta[name="author"]')
              ?.getAttribute('content') ||
            root
              .querySelector('meta[property="article:author"]')
              ?.getAttribute('content') ||
            null;
        }

        if (!siteName) {
          siteName =
            root
              .querySelector('meta[property="og:site_name"]')
              ?.getAttribute('content') || null;
        }

        if (!imageUrl) {
          imageUrl =
            root
              .querySelector('meta[property="og:image"]')
              ?.getAttribute('content') ||
            root
              .querySelector('meta[name="twitter:image"]')
              ?.getAttribute('content') ||
            root
              .querySelector('meta[property="og:image:url"]')
              ?.getAttribute('content') ||
            null;

          // If relative image URL, resolve against rawUrl
          if (imageUrl && !imageUrl.startsWith('http')) {
            try {
              imageUrl = new URL(imageUrl, rawUrl).toString();
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching preview for:', rawUrl, err);
  }

  // Fallback siteName from hostname if still empty
  if (!siteName) {
    try {
      siteName = new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {}
  }

  // Clean strings
  title = title?.trim()?.replace(/\s+/g, ' ') || null;
  description = description?.trim()?.replace(/\s+/g, ' ') || null;
  author = author?.trim() || null;
  siteName = siteName?.trim() || null;

  // Fetch thumbnail buffer if image URL found
  let thumbnailBuffer: Buffer | null = null;
  let thumbnailMime: string | null = null;

  if (imageUrl) {
    const imgData = await fetchImageBuffer(imageUrl);
    if (imgData) {
      thumbnailBuffer = imgData.buffer;
      thumbnailMime = imgData.mime;
    }
  }

  return {
    title,
    description,
    author,
    siteName,
    thumbnailBuffer,
    thumbnailMime,
  };
}

