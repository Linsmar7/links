import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from 'react-router';
import { eq, sql, and, desc, inArray } from 'drizzle-orm';
import { isAdmin, requireAdmin } from '~/lib/session.server';
import { db } from '~/lib/db.server';
import { links, thumbnails, people, tags, linkPeople, linkTags } from '~/db/schema';
import { detectPlatform } from '~/lib/platform';
import { normalizeUrl, extractContentId } from '~/lib/normalize-url';
import { fetchLinkPreview } from '~/lib/preview.server';
import { triggerPreviewWorker } from '~/lib/preview-worker.server';
import { LinkCard, type LinkCardData } from '~/components/link-card';
import { LinkForm } from '~/components/link-form';
import { FilterBar } from '~/components/filter-bar';
import { Pagination } from '~/components/pagination';

const PAGE_SIZE = 20;

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await isAdmin(request);
  const url = new URL(request.url);

  const q = url.searchParams.get('q')?.trim() || '';
  const rede = url.searchParams.get('rede')?.trim() || '';
  const tag = url.searchParams.get('tag')?.trim().toLowerCase() || '';
  const pessoa = url.searchParams.get('pessoa')?.trim().toLowerCase() || '';
  const page = Math.max(1, parseInt(url.searchParams.get('p') || '1', 10));

  // Build where conditions
  const conditions = [];

  if (rede) {
    conditions.push(eq(links.platform, rede));
  }

  if (q) {
    const rawPattern = `%${q}%`;
    const searchConditions = [
      sql`unaccent(coalesce(${links.title}, '')) ILIKE unaccent(${rawPattern})`,
      sql`unaccent(coalesce(${links.description}, '')) ILIKE unaccent(${rawPattern})`,
      sql`unaccent(coalesce(${links.author}, '')) ILIKE unaccent(${rawPattern})`,
      sql`unaccent(coalesce(${links.siteName}, '')) ILIKE unaccent(${rawPattern})`,
      sql`${links.url} ILIKE ${rawPattern}`,
      sql`${links.urlKey} ILIKE ${rawPattern}`,
    ];

    // If query looks like a URL, has query params, or contains slashes/dots
    if (q.includes('?') || q.includes('http') || q.includes('/') || q.includes('.')) {
      const normalizedQ = normalizeUrl(q);
      const urlWithoutQuery = q.split('?')[0].trim();
      const contentId = extractContentId(q);

      if (normalizedQ && normalizedQ !== q) {
        const normPattern = `%${normalizedQ}%`;
        searchConditions.push(sql`${links.urlKey} ILIKE ${normPattern}`);
        searchConditions.push(sql`${links.url} ILIKE ${normPattern}`);
      }

      if (urlWithoutQuery && urlWithoutQuery !== q && urlWithoutQuery !== normalizedQ) {
        const cleanPattern = `%${urlWithoutQuery}%`;
        searchConditions.push(sql`${links.urlKey} ILIKE ${cleanPattern}`);
        searchConditions.push(sql`${links.url} ILIKE ${cleanPattern}`);
      }

      if (contentId) {
        const idPattern = `%${contentId}%`;
        searchConditions.push(sql`${links.urlKey} ILIKE ${idPattern}`);
        searchConditions.push(sql`${links.url} ILIKE ${idPattern}`);
      }
    }

    conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
  }

  if (tag) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${linkTags}
        JOIN ${tags} ON ${tags.id} = ${linkTags.tagId}
        WHERE ${linkTags.linkId} = ${links.id} AND LOWER(${tags.name}) = ${tag}
      )`
    );
  }

  if (pessoa) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${linkPeople}
        JOIN ${people} ON ${people.id} = ${linkPeople.personId}
        WHERE ${linkPeople.linkId} = ${links.id} AND LOWER(${people.name}) = ${pessoa}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(links)
    .where(whereClause);
  const totalCount = countResult[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch paginated links
  const linksQuery = db
    .select({
      id: links.id,
      url: links.url,
      platform: links.platform,
      title: links.title,
      description: links.description,
      author: links.author,
      siteName: links.siteName,
      createdAt: links.createdAt,
      hasThumbnail: sql<boolean>`${thumbnails.linkId} IS NOT NULL`,
    })
    .from(links)
    .leftJoin(thumbnails, eq(links.id, thumbnails.linkId))
    .where(whereClause)
    .orderBy(desc(links.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rawLinks = await linksQuery;

  // Load people and tags for the returned links
  const linkIds = rawLinks.map((l) => l.id);

  let linkPeopleMap: Record<number, Array<{ id: number; name: string }>> = {};
  let linkTagsMap: Record<number, Array<{ id: number; name: string }>> = {};

  if (linkIds.length > 0) {
    const peopleData = await db
      .select({
        linkId: linkPeople.linkId,
        id: people.id,
        name: people.name,
      })
      .from(linkPeople)
      .innerJoin(people, eq(linkPeople.personId, people.id))
      .where(inArray(linkPeople.linkId, linkIds));

    for (const p of peopleData) {
      if (!linkPeopleMap[p.linkId]) linkPeopleMap[p.linkId] = [];
      linkPeopleMap[p.linkId].push({ id: p.id, name: p.name });
    }

    const tagsData = await db
      .select({
        linkId: linkTags.linkId,
        id: tags.id,
        name: tags.name,
      })
      .from(linkTags)
      .innerJoin(tags, eq(linkTags.tagId, tags.id))
      .where(inArray(linkTags.linkId, linkIds));

    for (const t of tagsData) {
      if (!linkTagsMap[t.linkId]) linkTagsMap[t.linkId] = [];
      linkTagsMap[t.linkId].push({ id: t.id, name: t.name });
    }
  }

  const items: LinkCardData[] = rawLinks.map((l) => ({
    ...l,
    people: linkPeopleMap[l.id] || [],
    tags: linkTagsMap[l.id] || [],
  }));

  // Load all existing tags and people for filters and form suggestions
  const existingPeople = await db.select().from(people).orderBy(people.name);
  const existingTags = await db.select().from(tags).orderBy(tags.name);

  return {
    links: items,
    totalCount,
    currentPage: page,
    totalPages,
    isAdmin: admin,
    existingPeople,
    existingTags,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  // Create link
  if (intent === 'create_link') {
    const rawUrl = formData.get('url')?.toString()?.trim() || '';
    if (!rawUrl) return { error: 'URL é obrigatória' };

    const urlKey = normalizeUrl(rawUrl);
    const platform = detectPlatform(rawUrl);
    let title = formData.get('title')?.toString()?.trim() || null;
    let description = formData.get('description')?.toString()?.trim() || null;
    let author = formData.get('author')?.toString()?.trim() || null;
    let siteName: string | null = null;
    let thumbBuffer: Buffer | null = null;
    let thumbMime: string | null = null;

    // Always fetch preview on server to get thumbnail, author, siteName and fallback title/description
    try {
      const preview = await fetchLinkPreview(rawUrl);
      if (!title) title = preview.title;
      if (!description) description = preview.description;
      if (!author) author = preview.author;
      siteName = preview.siteName;
      thumbBuffer = preview.thumbnailBuffer;
      thumbMime = preview.thumbnailMime;
    } catch (err) {
      console.error('Error fetching preview for new link:', err);
    }

    const peopleList: string[] = JSON.parse(
      formData.get('people')?.toString() || '[]'
    );
    const tagsList: string[] = JSON.parse(
      formData.get('tags')?.toString() || '[]'
    );

    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(links)
        .values({
          url: rawUrl,
          urlKey,
          platform,
          title,
          description,
          author,
          siteName,
          previewStatus: thumbBuffer || title ? 'ok' : 'pendente',
        })
        .onConflictDoUpdate({
          target: links.urlKey,
          set: {
            title: title || undefined,
            description: description || undefined,
            author: author || undefined,
            siteName: siteName || undefined,
            previewStatus: thumbBuffer || title ? 'ok' : 'pendente',
            updatedAt: new Date(),
          },
        })
        .returning({ id: links.id });

      const linkId = inserted.id;

      if (thumbBuffer && thumbMime) {
        await tx
          .insert(thumbnails)
          .values({
            linkId,
            data: thumbBuffer,
            mime: thumbMime,
          })
          .onConflictDoUpdate({
            target: thumbnails.linkId,
            set: { data: thumbBuffer, mime: thumbMime },
          });
      }

      // Sync people
      for (const p of peopleList) {
        const cleanName = p.toLowerCase().trim();
        if (!cleanName) continue;
        const [person] = await tx
          .insert(people)
          .values({ name: cleanName })
          .onConflictDoUpdate({
            target: people.name,
            set: { name: cleanName },
          })
          .returning({ id: people.id });

        await tx
          .insert(linkPeople)
          .values({ linkId, personId: person.id })
          .onConflictDoNothing();
      }

      // Sync tags
      for (const t of tagsList) {
        const cleanTag = t.toLowerCase().trim();
        if (!cleanTag) continue;
        const [tagRow] = await tx
          .insert(tags)
          .values({ name: cleanTag })
          .onConflictDoUpdate({
            target: tags.name,
            set: { name: cleanTag },
          })
          .returning({ id: tags.id });

        await tx
          .insert(linkTags)
          .values({ linkId, tagId: tagRow.id })
          .onConflictDoNothing();
      }
    });

    if (!thumbBuffer) {
      triggerPreviewWorker();
    }

    return { ok: true };
  }

  // Update link
  if (intent === 'update_link') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    const rawUrl = formData.get('url')?.toString()?.trim() || '';
    const title = formData.get('title')?.toString()?.trim() || null;
    const description = formData.get('description')?.toString()?.trim() || null;
    const peopleList: string[] = JSON.parse(
      formData.get('people')?.toString() || '[]'
    );
    const tagsList: string[] = JSON.parse(
      formData.get('tags')?.toString() || '[]'
    );

    if (!id || !rawUrl) return { error: 'Dados inválidos' };

    await db.transaction(async (tx) => {
      await tx
        .update(links)
        .set({
          url: rawUrl,
          urlKey: normalizeUrl(rawUrl),
          platform: detectPlatform(rawUrl),
          title,
          description,
          updatedAt: new Date(),
        })
        .where(eq(links.id, id));

      // Reset people relations
      await tx.delete(linkPeople).where(eq(linkPeople.linkId, id));
      for (const p of peopleList) {
        const cleanName = p.toLowerCase().trim();
        if (!cleanName) continue;
        const [person] = await tx
          .insert(people)
          .values({ name: cleanName })
          .onConflictDoUpdate({
            target: people.name,
            set: { name: cleanName },
          })
          .returning({ id: people.id });

        await tx.insert(linkPeople).values({ linkId: id, personId: person.id });
      }

      // Reset tags relations
      await tx.delete(linkTags).where(eq(linkTags.linkId, id));
      for (const t of tagsList) {
        const cleanTag = t.toLowerCase().trim();
        if (!cleanTag) continue;
        const [tagRow] = await tx
          .insert(tags)
          .values({ name: cleanTag })
          .onConflictDoUpdate({
            target: tags.name,
            set: { name: cleanTag },
          })
          .returning({ id: tags.id });

        await tx.insert(linkTags).values({ linkId: id, tagId: tagRow.id });
      }
    });

    return { ok: true };
  }

  // Delete link
  if (intent === 'delete_link') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    if (id) {
      await db.delete(links).where(eq(links.id, id));
    }
    return { ok: true };
  }

  // Refetch preview
  if (intent === 'refetch_preview') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    if (id) {
      const [linkItem] = await db
        .select({ id: links.id, url: links.url })
        .from(links)
        .where(eq(links.id, id));

      if (linkItem) {
        try {
          const preview = await fetchLinkPreview(linkItem.url);
          await db.transaction(async (tx) => {
            await tx
              .update(links)
              .set({
                title: preview.title || undefined,
                description: preview.description || undefined,
                author: preview.author || undefined,
                siteName: preview.siteName || undefined,
                previewStatus: preview.title ? 'ok' : 'falhou',
                updatedAt: new Date(),
              })
              .where(eq(links.id, id));

            if (preview.thumbnailBuffer && preview.thumbnailMime) {
              await tx
                .insert(thumbnails)
                .values({
                  linkId: id,
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
          console.error('Error refetching preview:', err);
        }
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

export default function HomePage() {
  const {
    links,
    currentPage,
    totalPages,
    isAdmin,
    existingPeople,
    existingTags,
  } = useLoaderData<typeof loader>();

  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LinkCardData | null>(null);

  const isSubmitting = navigation.state === 'submitting';

  const handleEdit = (link: LinkCardData) => {
    setEditingItem(link);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja apagar este link?')) {
      const formData = new FormData();
      formData.set('intent', 'delete_link');
      formData.set('id', id.toString());
      submit(formData, { method: 'post' });
    }
  };

  const handleRefetch = (id: number) => {
    const formData = new FormData();
    formData.set('intent', 'refetch_preview');
    formData.set('id', id.toString());
    submit(formData, { method: 'post' });
  };

  const handleSelectTag = (tagName: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tag', tagName);
    next.delete('p');
    setSearchParams(next);
  };

  const handleSelectPerson = (personName: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('pessoa', personName);
    next.delete('p');
    setSearchParams(next);
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between pb-6 border-b border-neutral-900 mb-6">
        <Link
          to="/"
          className="text-sm font-mono tracking-wider font-semibold text-neutral-100 hover:text-white"
        >
          links
        </Link>

        {/* Admin toolbar */}
        {isAdmin && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsFormOpen(!isFormOpen);
              }}
              className="text-neutral-200 hover:text-white"
            >
              {isFormOpen ? '✕ fechar' : '+ novo'}
            </button>
            <Link
              to="/importar"
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              importar
            </Link>
            <Link
              to="/gerenciar"
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              gerenciar
            </Link>
            <Link
              to="/sair"
              className="text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              sair
            </Link>
          </div>
        )}
      </header>

      {/* Admin New/Edit form */}
      {isAdmin && isFormOpen && (
        <LinkForm
          initialData={editingItem}
          existingPeople={existingPeople}
          existingTags={existingTags}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Search and Filters */}
      <FilterBar
        existingPeople={existingPeople}
        existingTags={existingTags}
      />

      {/* Links List */}
      {links.length === 0 ? (
        <div className="py-16 text-center text-xs font-mono text-neutral-600">
          nenhum link encontrado.
        </div>
      ) : (
        <div className="divide-y divide-neutral-900/50">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefetch={handleRefetch}
              onSelectTag={handleSelectTag}
              onSelectPerson={handleSelectPerson}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </main>
  );
}
