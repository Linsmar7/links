const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'si',
  'is',
  'a',
  's',
  't',
  'igsh',
  'fbclid',
  'gclid',
  'ref',
  'ref_src',
  'feature',
  'share_id',
  'sender_device',
  'is_from_webapp',
  'source',
  '_ga',
  '_gl',
]);

/**
 * Normalizes a URL to prevent duplicates and enable clean searching:
 * - fixes protocols (adds https:// if missing)
 * - standardizes domain (twitter.com -> x.com, youtu.be -> youtube.com/watch?v=)
 * - strips tracking query params and arbitrary garbage added by social networks
 * - normalizes path (trims trailing slash)
 */
export function normalizeUrl(input: string): string {
  let trimmed = input.trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const url = new URL(trimmed);
    let host = url.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = url.pathname;

    // Normalize Twitter / X
    if (host === 'twitter.com' || host === 'mobile.twitter.com') {
      host = 'x.com';
    }

    // 1. Twitter / X tweet status: never needs any query params
    if (host === 'x.com' && pathname.includes('/status/')) {
      url.search = '';
    }
    // 2. YouTube
    else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be'
    ) {
      if (host === 'youtu.be') {
        const videoId = pathname.replace(/^\/+/, '').split('/')[0];
        host = 'youtube.com';
        pathname = '/watch';
        const t = url.searchParams.get('t');
        url.search = '';
        if (videoId) url.searchParams.set('v', videoId);
        if (t) url.searchParams.set('t', t);
      } else if (pathname.startsWith('/shorts/')) {
        const t = url.searchParams.get('t');
        url.search = '';
        if (t) url.searchParams.set('t', t);
      } else if (pathname.startsWith('/watch')) {
        const v = url.searchParams.get('v');
        const t = url.searchParams.get('t');
        url.search = '';
        if (v) url.searchParams.set('v', v);
        if (t) url.searchParams.set('t', t);
      }
    }
    // 3. Instagram posts and reels: never need tracking query params
    else if (
      (host === 'instagram.com' || host === 'instagr.am') &&
      (pathname.startsWith('/p/') ||
        pathname.startsWith('/reel/') ||
        pathname.startsWith('/reels/') ||
        pathname.startsWith('/tv/'))
    ) {
      url.search = '';
    }
    // 4. TikTok videos: never need query params
    else if (
      (host === 'tiktok.com' || host === 'vm.tiktok.com') &&
      pathname.includes('/video/')
    ) {
      url.search = '';
    }
    // 5. Generic URLs: strip known tracking params
    else {
      for (const key of Array.from(url.searchParams.keys())) {
        const lower = key.toLowerCase();
        if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
          url.searchParams.delete(key);
        }
      }
    }

    // Remove trailing slashes from path if path is longer than /
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    url.searchParams.sort();
    const search = url.searchParams.toString();
    const cleanSearch = search ? `?${search}` : '';

    return `https://${host}${pathname}${cleanSearch}`;
  } catch {
    return trimmed;
  }
}

/**
 * Extracts a specific entity ID (e.g. tweet status ID, YouTube video ID, Instagram post code)
 * from a URL or raw string, if applicable.
 */
export function extractContentId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Twitter / X status ID: /status/(\d+)
  const tweetMatch = trimmed.match(/\/status\/(\d+)/i);
  if (tweetMatch) return tweetMatch[1];

  // YouTube shorts ID: /shorts/([a-zA-Z0-9_-]+)
  const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]+)/i);
  if (shortsMatch) return shortsMatch[1];

  // YouTube watch ID: v=([a-zA-Z0-9_-]+) or youtu.be/([a-zA-Z0-9_-]+)
  const ytMatch = trimmed.match(/(?:v=|\/watch\?v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]+)/i);
  if (ytMatch) return ytMatch[1];

  // Instagram code: /(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/
  const instaMatch = trimmed.match(/\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/i);
  if (instaMatch) return instaMatch[1];

  return null;
}
