import { useState, useEffect } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, useLoaderData, useNavigation, useActionData } from 'react-router';
import { inArray, eq, sql } from 'drizzle-orm';
import { requireAdmin } from '~/lib/session.server';
import { db } from '~/lib/db.server';
import { links, people, tags, linkPeople, linkTags } from '~/db/schema';
import { parseImportText, type ParsedImportItem } from '~/lib/parse-import';
import { detectPlatform } from '~/lib/platform';
import { triggerPreviewWorker } from '~/lib/preview-worker.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const existingPeople = await db.select().from(people).orderBy(people.name);
  const existingTags = await db.select().from(tags).orderBy(tags.name);

  // Status of previews
  const counts = await db
    .select({
      status: links.previewStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(links)
    .groupBy(links.previewStatus);

  const stats = { pendente: 0, ok: 0, falhou: 0 };
  for (const c of counts) {
    if (c.status in stats) stats[c.status as keyof typeof stats] = c.count;
  }

  return { existingPeople, existingTags, stats };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  // 1. Check existing urlKeys to mark duplicates
  if (intent === 'check_duplicates') {
    const rawKeys = formData.get('keys')?.toString();
    if (!rawKeys) return { existingKeys: [] };
    const keys: string[] = JSON.parse(rawKeys);
    if (keys.length === 0) return { existingKeys: [] };

    const found = await db
      .select({ urlKey: links.urlKey })
      .from(links)
      .where(inArray(links.urlKey, keys));

    return { existingKeys: found.map((f) => f.urlKey) };
  }

  // 2. Import links
  if (intent === 'execute_import') {
    const rawItems = formData.get('items')?.toString();
    const commonTagsRaw = formData.get('commonTags')?.toString() || '';
    const commonPeopleRaw = formData.get('commonPeople')?.toString() || '';

    if (!rawItems) return { error: 'Nenhum item para importar.' };
    const items: Array<{
      url: string;
      urlKey: string;
      tags: string[];
      people: string[];
    }> = JSON.parse(rawItems);

    const commonTags = commonTagsRaw
      .split(',')
      .map((t: string) => t.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean);

    const commonPeople = commonPeopleRaw
      .split(',')
      .map((p: string) => p.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);

    let importedCount = 0;

    await db.transaction(async (tx) => {
      // Find all existing people and tags to minimize inserts
      const allPeople = await tx.select().from(people);
      const peopleMap = new Map<string, number>(allPeople.map((p) => [p.name, p.id]));

      const allTags = await tx.select().from(tags);
      const tagsMap = new Map<string, number>(allTags.map((t) => [t.name, t.id]));

      for (const item of items) {
        const platform = detectPlatform(item.url);

        // Insert link if not exists
        const inserted = await tx
          .insert(links)
          .values({
            url: item.url,
            urlKey: item.urlKey,
            platform,
            previewStatus: 'pendente',
          })
          .onConflictDoNothing({ target: links.urlKey })
          .returning({ id: links.id });

        if (inserted.length === 0) continue; // Already existed
        const linkId = inserted[0].id;
        importedCount += 1;

        // Combine item people with commonPeople
        const combinedPeople = Array.from(
          new Set([...item.people, ...commonPeople])
        );

        for (const personName of combinedPeople) {
          let personId = peopleMap.get(personName);
          if (!personId) {
            const [newP] = await tx
              .insert(people)
              .values({ name: personName })
              .onConflictDoUpdate({
                target: people.name,
                set: { name: personName },
              })
              .returning({ id: people.id });
            personId = newP.id;
            peopleMap.set(personName, personId);
          }

          await tx
            .insert(linkPeople)
            .values({ linkId, personId })
            .onConflictDoNothing();
        }

        // Combine item tags with commonTags
        const combinedTags = Array.from(new Set([...item.tags, ...commonTags]));

        for (const tagName of combinedTags) {
          let tagId = tagsMap.get(tagName);
          if (!tagId) {
            const [newT] = await tx
              .insert(tags)
              .values({ name: tagName })
              .onConflictDoUpdate({
                target: tags.name,
                set: { name: tagName },
              })
              .returning({ id: tags.id });
            tagId = newT.id;
            tagsMap.set(tagName, tagId);
          }

          await tx
            .insert(linkTags)
            .values({ linkId, tagId })
            .onConflictDoNothing();
        }
      }
    });

    triggerPreviewWorker();

    return { success: true, count: importedCount };
  }

  // 3. Retry failed
  if (intent === 'retry_failed') {
    await db
      .update(links)
      .set({ previewStatus: 'pendente', updatedAt: new Date() })
      .where(eq(links.previewStatus, 'falhou'));

    triggerPreviewWorker();
    return { retried: true };
  }

  return { ok: true };
}

export default function ImportarPage() {
  const { stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [rawText, setRawText] = useState('');
  const [commonTags, setCommonTags] = useState('');
  const [commonPeople, setCommonPeople] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedImportItem[]>([]);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [hasParsed, setHasParsed] = useState(false);

  // Live polling of preview progress
  const [liveStats, setLiveStats] = useState(stats);

  useEffect(() => {
    if (liveStats.pendente > 0) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch('/api/import-status');
          if (res.ok) {
            const data = await res.json();
            setLiveStats(data);
          }
        } catch {}
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [liveStats.pendente]);

  // When check_duplicates action returns
  useEffect(() => {
    if (actionData && 'existingKeys' in actionData && Array.isArray(actionData.existingKeys)) {
      setExistingKeys(new Set(actionData.existingKeys));
    }
    if (actionData && 'count' in actionData) {
      // Clear after successful import
      setRawText('');
      setParsedItems([]);
      setHasParsed(false);
      // Fetch latest stats
      fetch('/api/import-status')
        .then((r) => r.json())
        .then((data) => setLiveStats(data))
        .catch(() => {});
    }
  }, [actionData]);

  const handleParse = async () => {
    const items = parseImportText(rawText);
    setParsedItems(items);
    setHasParsed(true);

    if (items.length > 0) {
      // Check existing keys via fetch or action
      const keys = Array.from(new Set(items.map((i) => i.urlKey)));
      const form = new FormData();
      form.set('intent', 'check_duplicates');
      form.set('keys', JSON.stringify(keys));

      try {
        const res = await fetch('', { method: 'POST', body: form });
        const data = await res.json();
        if (data?.existingKeys) {
          setExistingKeys(new Set(data.existingKeys));
        }
      } catch {}
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result?.toString() || '';
      setRawText(content);
    };
    reader.readAsText(file);
  };

  // Unique new items
  const seenInBatch = new Set<string>();
  const categorized = parsedItems.map((item) => {
    const isDbDup = existingKeys.has(item.urlKey);
    const isBatchDup = seenInBatch.has(item.urlKey);
    seenInBatch.add(item.urlKey);
    return {
      ...item,
      isDuplicate: isDbDup || isBatchDup,
      dupReason: isDbDup ? 'já existe' : isBatchDup ? 'repetido no lote' : null,
    };
  });

  const validNewItems = categorized.filter((i) => !i.isDuplicate);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between pb-6 border-b border-neutral-900 mb-8">
        <Link
          to="/"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-200 transition-colors"
        >
          ← voltar
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-neutral-500">importar links</span>
        </div>
      </header>

      {/* Progress / Status banner */}
      {(liveStats.pendente > 0 || liveStats.falhou > 0) && (
        <div className="mb-8 p-3 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {liveStats.pendente > 0 && (
              <span className="text-neutral-300">
                buscando previews: {liveStats.pendente} pendentes
              </span>
            )}
            {liveStats.falhou > 0 && (
              <span className="text-neutral-500">
                {liveStats.falhou} sem preview
              </span>
            )}
          </div>
          {liveStats.falhou > 0 && liveStats.pendente === 0 && (
            <Form method="post">
              <input type="hidden" name="intent" value="retry_failed" />
              <button
                type="submit"
                className="text-neutral-400 hover:text-neutral-200 underline"
              >
                tentar novamente
              </button>
            </Form>
          )}
        </div>
      )}

      {actionData && 'success' in actionData && (
        <div className="mb-6 p-3 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-200">
          ✓ {actionData.count} links importados. Previews sendo gerados em segundo plano.
        </div>
      )}

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono text-neutral-500">
              Cole o texto ou solte um arquivo (.txt/.csv)
            </label>
            <label className="text-xs font-mono text-neutral-500 hover:text-neutral-300 cursor-pointer">
              <span>anexar arquivo</span>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            rows={8}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setHasParsed(false);
            }}
            placeholder={`https://youtube.com/watch?v=... #tech @ana\nhttps://x.com/user/status/... #humor\nhttps://instagram.com/p/... @joao`}
            className="w-full bg-neutral-950 border border-neutral-900 rounded p-3 text-xs font-mono text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-neutral-700 resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono text-neutral-500 mb-1">
              tags para todos (separadas por vírgula)
            </label>
            <input
              type="text"
              value={commonTags}
              onChange={(e) => setCommonTags(e.target.value)}
              placeholder="ex: tech, podcast"
              className="w-full bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-neutral-500 mb-1">
              pessoas para todos (separadas por vírgula)
            </label>
            <input
              type="text"
              value={commonPeople}
              onChange={(e) => setCommonPeople(e.target.value)}
              placeholder="ex: ana, joao"
              className="w-full bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-neutral-700"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="py-1.5 px-4 text-xs font-mono bg-neutral-800 text-neutral-200 rounded hover:bg-neutral-700 disabled:opacity-40 transition-colors"
          >
            revisar
          </button>
        </div>

        {/* Review list */}
        {hasParsed && (
          <div className="pt-6 border-t border-neutral-900 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
              <span>
                {validNewItems.length} novos · {categorized.length - validNewItems.length} duplicados
              </span>

              {validNewItems.length > 0 && (
                <Form method="post">
                  <input type="hidden" name="intent" value="execute_import" />
                  <input
                    type="hidden"
                    name="items"
                    value={JSON.stringify(
                      validNewItems.map((i) => ({
                        url: i.rawUrl,
                        urlKey: i.urlKey,
                        tags: i.tags,
                        people: i.people,
                      }))
                    )}
                  />
                  <input type="hidden" name="commonTags" value={commonTags} />
                  <input type="hidden" name="commonPeople" value={commonPeople} />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-1.5 px-4 text-xs font-mono bg-neutral-200 text-neutral-950 font-medium rounded hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'importando...' : `importar (${validNewItems.length})`}
                  </button>
                </Form>
              )}
            </div>

            <ul className="divide-y divide-neutral-900 max-h-96 overflow-y-auto pr-1">
              {categorized.map((item, idx) => (
                <li
                  key={idx}
                  className={`py-2 text-xs font-mono flex items-center justify-between gap-2 ${
                    item.isDuplicate ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-neutral-300">
                      {item.rawUrl}
                    </span>
                    {(item.tags.length > 0 || commonTags) && (
                      <span className="text-neutral-500 text-[11px] shrink-0">
                        {item.tags.map((t) => `#${t}`).join(' ')}
                      </span>
                    )}
                    {(item.people.length > 0 || commonPeople) && (
                      <span className="text-neutral-500 text-[11px] shrink-0">
                        {item.people.map((p) => `@${p}`).join(' ')}
                      </span>
                    )}
                  </div>
                  {item.isDuplicate && (
                    <span className="text-[10px] text-amber-500/80 shrink-0">
                      {item.dupReason}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
