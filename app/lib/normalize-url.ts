const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'si',
  'igsh',
  'fbclid',
  'gclid',
  'ref',
  'ref_src',
  'feature',
  'share_id',
  'sender_device',
]);

/**
 * Normalizes a URL to prevent duplicates:
 * - fixes protocols (adds https:// if missing)
 * - standardizes domain (twitter.com -> x.com, youtu.be -> youtube.com/watch?v=)
 * - strips tracking query params
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

    // Normalize YouTube youtu.be -> youtube.com/watch?v=ID
    if (host === 'youtu.be') {
      const videoId = pathname.replace(/^\/+/, '').split('/')[0];
      host = 'youtube.com';
      pathname = '/watch';
      if (videoId) {
        url.searchParams.set('v', videoId);
      }
    }

    // Strip tracking parameters
    for (const key of Array.from(url.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower)) {
        url.searchParams.delete(key);
      }
      // Strip twitter tracking parameters: x.com/.../status/123?s=20&t=xyz
      if (host === 'x.com' && (lower === 's' || lower === 't')) {
        url.searchParams.delete(key);
      }
    }

    // Remove trailing slashes from path if path is longer than /
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Sort query params for consistent key
    url.searchParams.sort();

    const search = url.searchParams.toString();
    const cleanSearch = search ? `?${search}` : '';

    return `https://${host}${pathname}${cleanSearch}`;
  } catch {
    return trimmed;
  }
}
