import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, useLoaderData, useNavigation } from 'react-router';
import { eq, sql } from 'drizzle-orm';
import { requireAdmin } from '~/lib/session.server';
import { db } from '~/lib/db.server';
import { people, tags, linkPeople, linkTags } from '~/db/schema';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  // Load people with link counts
  const peopleList = await db
    .select({
      id: people.id,
      name: people.name,
      count: sql<number>`count(${linkPeople.linkId})::int`,
    })
    .from(people)
    .leftJoin(linkPeople, eq(people.id, linkPeople.personId))
    .groupBy(people.id, people.name)
    .orderBy(people.name);

  // Load tags with link counts
  const tagsList = await db
    .select({
      id: tags.id,
      name: tags.name,
      count: sql<number>`count(${linkTags.linkId})::int`,
    })
    .from(tags)
    .leftJoin(linkTags, eq(tags.id, linkTags.tagId))
    .groupBy(tags.id, tags.name)
    .orderBy(tags.name);

  return { people: peopleList, tags: tagsList };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  // Rename person
  if (intent === 'rename_person') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    const name = formData.get('name')?.toString()?.trim().toLowerCase();
    if (id && name) {
      await db.update(people).set({ name }).where(eq(people.id, id));
    }
    return { ok: true };
  }

  // Delete person
  if (intent === 'delete_person') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    if (id) {
      await db.delete(people).where(eq(people.id, id));
    }
    return { ok: true };
  }

  // Rename tag
  if (intent === 'rename_tag') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    const name = formData.get('name')?.toString()?.trim().toLowerCase();
    if (id && name) {
      await db.update(tags).set({ name }).where(eq(tags.id, id));
    }
    return { ok: true };
  }

  // Delete tag
  if (intent === 'delete_tag') {
    const id = parseInt(formData.get('id')?.toString() || '', 10);
    if (id) {
      await db.delete(tags).where(eq(tags.id, id));
    }
    return { ok: true };
  }

  return { ok: true };
}

export default function GerenciarPage() {
  const { people, tags } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between pb-6 border-b border-neutral-900 mb-8">
        <Link
          to="/"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-200 transition-colors"
        >
          ← voltar
        </Link>
        <span className="text-xs font-mono text-neutral-500">gerenciar</span>
      </header>

      <div className="space-y-10">
        {/* Pessoas */}
        <section className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Pessoas ({people.length})
          </h2>

          {people.length === 0 ? (
            <p className="text-xs text-neutral-600 font-mono">Nenhuma pessoa cadastrada.</p>
          ) : (
            <ul className="divide-y divide-neutral-900">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  {editingPersonId === p.id ? (
                    <Form
                      method="post"
                      className="flex items-center gap-2 flex-1"
                      onSubmit={() => setEditingPersonId(null)}
                    >
                      <input type="hidden" name="intent" value="rename_person" />
                      <input type="hidden" name="id" value={p.id} />
                      <span className="text-neutral-500 text-xs font-mono">@</span>
                      <input
                        type="text"
                        name="name"
                        defaultValue={p.name}
                        autoFocus
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-xs font-mono text-neutral-200 px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
                      >
                        salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPersonId(null)}
                        className="text-xs font-mono text-neutral-500 hover:text-neutral-300"
                      >
                        cancelar
                      </button>
                    </Form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-300 font-mono text-xs">
                          @{p.name}
                        </span>
                        <span className="text-[11px] font-mono text-neutral-600">
                          {p.count}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingPersonId(p.id)}
                          className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300"
                        >
                          editar
                        </button>
                        <Form
                          method="post"
                          onSubmit={(e) => {
                            if (!confirm(`Apagar @${p.name}?`)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="intent" value="delete_person" />
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="text-[11px] font-mono text-neutral-600 hover:text-red-400"
                          >
                            apagar
                          </button>
                        </Form>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tags */}
        <section className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Tags ({tags.length})
          </h2>

          {tags.length === 0 ? (
            <p className="text-xs text-neutral-600 font-mono">Nenhuma tag cadastrada.</p>
          ) : (
            <ul className="divide-y divide-neutral-900">
              {tags.map((t) => (
                <li
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  {editingTagId === t.id ? (
                    <Form
                      method="post"
                      className="flex items-center gap-2 flex-1"
                      onSubmit={() => setEditingTagId(null)}
                    >
                      <input type="hidden" name="intent" value="rename_tag" />
                      <input type="hidden" name="id" value={t.id} />
                      <span className="text-neutral-500 text-xs font-mono">#</span>
                      <input
                        type="text"
                        name="name"
                        defaultValue={t.name}
                        autoFocus
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-xs font-mono text-neutral-200 px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
                      >
                        salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTagId(null)}
                        className="text-xs font-mono text-neutral-500 hover:text-neutral-300"
                      >
                        cancelar
                      </button>
                    </Form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-300 font-mono text-xs">
                          #{t.name}
                        </span>
                        <span className="text-[11px] font-mono text-neutral-600">
                          {t.count}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingTagId(t.id)}
                          className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300"
                        >
                          editar
                        </button>
                        <Form
                          method="post"
                          onSubmit={(e) => {
                            if (!confirm(`Apagar #${t.name}?`)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="intent" value="delete_tag" />
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="text-[11px] font-mono text-neutral-600 hover:text-red-400"
                          >
                            apagar
                          </button>
                        </Form>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
