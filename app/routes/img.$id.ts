import type { LoaderFunctionArgs } from 'react-router';
import { eq } from 'drizzle-orm';
import { db } from '~/lib/db.server';
import { thumbnails } from '~/db/schema';

export async function loader({ params }: LoaderFunctionArgs) {
  const linkId = parseInt(params.id || '', 10);
  if (isNaN(linkId)) {
    return new Response('Not found', { status: 404 });
  }

  const result = await db
    .select({
      data: thumbnails.data,
      mime: thumbnails.mime,
    })
    .from(thumbnails)
    .where(eq(thumbnails.linkId, linkId))
    .limit(1);

  if (result.length === 0 || !result[0].data) {
    return new Response('Not found', { status: 404 });
  }

  const thumb = result[0];

  return new Response(new Uint8Array(thumb.data), {
    status: 200,
    headers: {
      'Content-Type': thumb.mime || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
