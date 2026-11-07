import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { eq, sql } from 'drizzle-orm';
import { isAdmin } from '~/lib/session.server';
import { db } from '~/lib/db.server';
import { links } from '~/db/schema';
import { triggerPreviewWorker } from '~/lib/preview-worker.server';

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const counts = await db
    .select({
      status: links.previewStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(links)
    .groupBy(links.previewStatus);

  const stats = {
    pendente: 0,
    ok: 0,
    falhou: 0,
  };

  for (const row of counts) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = row.count;
    }
  }

  // If there are pending items, make sure worker is triggered
  if (stats.pendente > 0) {
    triggerPreviewWorker();
  }

  return Response.json(stats);
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'retry_failed') {
    await db
      .update(links)
      .set({ previewStatus: 'pendente', updatedAt: new Date() })
      .where(eq(links.previewStatus, 'falhou'));

    triggerPreviewWorker();
    return Response.json({ ok: true, retried: true });
  }

  return Response.json({ error: 'Invalid intent' }, { status: 400 });
}
