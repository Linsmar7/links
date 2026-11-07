export type Platform = 'x' | 'youtube' | 'instagram' | 'tiktok' | 'outro';

export function detectPlatform(url: string): Platform {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'x.com' || host === 'twitter.com' || host === 't.co') {
      return 'x';
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be'
    ) {
      return 'youtube';
    }
    if (host === 'instagram.com' || host === 'instagr.am') {
      return 'instagram';
    }
    if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
      return 'tiktok';
    }
    return 'outro';
  } catch {
    return 'outro';
  }
}

export function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case 'x':
      return 'X (Twitter)';
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    default:
      return 'Web';
  }
}

