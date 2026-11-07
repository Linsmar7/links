import { eq } from 'drizzle-orm';
import { db } from './db.server';
import { links, thumbnails } from '../db/schema';
import { fetchLinkPreview } from './preview.server';

let isProcessing = false;

export async function processPendingPreviews(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Find all links that are still 'pendente'
    const pendingLinks = await db
      .select({
        id: links.id,
        url: links.url,
      })
      .from(links)
      .where(eq(links.previewStatus, 'pendente'))
      .limit(50);

    if (pendingLinks.length === 0) {
      isProcessing = false;
      return;
    }

    // Process in batches of 3 concurrently
    const batchSize = 3;
    for (let i = 0; i < pendingLinks.length; i += batchSize) {
      const batch = pendingLinks.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const preview = await fetchLinkPreview(item.url);

            await db.transaction(async (tx) => {
              await tx
                .update(links)
                .set({
                  title: preview.title,
                  description: preview.description,
                  author: preview.author,
                  siteName: preview.siteName,
                  previewStatus: preview.title ? 'ok' : 'falhou',
                  updatedAt: new Date(),
                })
                .where(eq(links.id, item.id));

              if (preview.thumbnailBuffer && preview.thumbnailMime) {
                // Upsert thumbnail
                await tx
                  .insert(thumbnails)
                  .values({
                    linkId: item.id,
                    data: preview.thumbnailBuffer,
                    mime: preview.thumbnailMime,
                  })
                  .onConflictDoUpdate({
                    target: thumbnails.linkId,
                    set: {
                      data: preview.thumbnailBuffer,
                      mime: preview.thumbnailMime,
                    },
                  });
              }
            });
          } catch (err) {
            console.error(`Failed to process preview for link ${item.id}:`, err);
            await db
              .update(links)
              .set({ previewStatus: 'falhou', updatedAt: new Date() })
              .where(eq(links.id, item.id));
          }
        })
      );
    }
  } catch (err) {
    console.error('Error in preview worker loop:', err);
  } finally {
    isProcessing = false;
  }
}

export function triggerPreviewWorker(): void {
  // Fire and forget in the background
  setTimeout(() => {
    processPendingPreviews().catch((err) =>
      console.error('Trigger worker error:', err)
    );
  }, 100);
}
