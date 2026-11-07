import type { ActionFunctionArgs } from 'react-router';
import { isAdmin } from '~/lib/session.server';
import { fetchLinkPreview } from '~/lib/preview.server';
import { detectPlatform } from '~/lib/platform';

export async function action({ request }: ActionFunctionArgs) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const url = formData.get('url')?.toString()?.trim();

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const platform = detectPlatform(url);
  const preview = await fetchLinkPreview(url);

  return Response.json({
    platform,
    title: preview.title,
    description: preview.description,
    author: preview.author,
    siteName: preview.siteName,
    hasThumbnail: Boolean(preview.thumbnailBuffer),
  });
}
