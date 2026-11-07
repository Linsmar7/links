import { useState } from 'react';
import { Form } from 'react-router';
import type { LinkCardData } from './link-card';

interface LinkFormProps {
  initialData?: LinkCardData | null;
  existingPeople: Array<{ id: number; name: string }>;
  existingTags: Array<{ id: number; name: string }>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function LinkForm({
  initialData,
  existingPeople,
  existingTags,
  onCancel,
  isSubmitting,
}: LinkFormProps) {
  const [url, setUrl] = useState(initialData?.url || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [author, setAuthor] = useState(initialData?.author || '');

  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    initialData ? initialData.people.map((p) => p.name) : []
  );
  const [newPersonInput, setNewPersonInput] = useState('');

  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData ? initialData.tags.map((t) => t.name) : []
  );
  const [newTagInput, setNewTagInput] = useState('');

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Auto-fetch preview when pasting a URL
  const handleUrlBlur = async () => {
    if (!url.trim() || initialData) return;
    if (title.trim()) return; // Already has title

    setIsLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append('url', url);
      const res = await fetch('/api/preview', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.author) setAuthor(data.author);
      }
    } catch {
      // Ignore preview failure, user can type title manually
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const addPerson = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (clean && !selectedPeople.includes(clean)) {
      setSelectedPeople([...selectedPeople, clean]);
    }
    setNewPersonInput('');
  };

  const removePerson = (name: string) => {
    setSelectedPeople(selectedPeople.filter((p) => p !== name));
  };

  const addTag = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^#/, '');
    if (clean && !selectedTags.includes(clean)) {
      setSelectedTags([...selectedTags, clean]);
    }
    setNewTagInput('');
  };

  const removeTag = (name: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== name));
  };

  return (
    <div className="p-4 mb-6 rounded bg-neutral-950 border border-neutral-800 text-xs font-mono space-y-3">
      <div className="flex items-center justify-between text-neutral-400">
        <span>{initialData ? 'editar link' : 'novo link'}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-neutral-500 hover:text-neutral-300"
        >
          ✕
        </button>
      </div>

      <Form method="post" className="space-y-3">
        <input
          type="hidden"
          name="intent"
          value={initialData ? 'update_link' : 'create_link'}
        />
        {initialData && <input type="hidden" name="id" value={initialData.id} />}
        <input
          type="hidden"
          name="people"
          value={JSON.stringify(selectedPeople)}
        />
        <input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
        <input type="hidden" name="author" value={author} />

        <div>
          <input
            type="url"
            name="url"
            required
            autoFocus={!initialData}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
        </div>

        <div>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isLoadingPreview
                ? 'buscando prévia...'
                : 'título (opcional, busca automático)'
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
        </div>

        <div>
          <input
            type="text"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="descrição curta (opcional)"
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {/* Pessoas selector */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-neutral-500 text-[11px]">pessoas:</span>
            {selectedPeople.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-300 text-[11px]"
              >
                @{p}
                <button
                  type="button"
                  onClick={() => removePerson(p)}
                  className="text-neutral-500 hover:text-neutral-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newPersonInput}
              onChange={(e) => setNewPersonInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addPerson(newPersonInput);
                }
              }}
              placeholder="digite e aperte enter para adicionar pessoa..."
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-neutral-700"
            />
            {existingPeople.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) addPerson(e.target.value);
                  e.target.value = '';
                }}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400 focus:outline-none"
              >
                <option value="">sugestões...</option>
                {existingPeople
                  .filter((p) => !selectedPeople.includes(p.name))
                  .map((p) => (
                    <option key={p.id} value={p.name}>
                      @{p.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        {/* Tags selector */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-neutral-500 text-[11px]">tags:</span>
            {selectedTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-300 text-[11px]"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="text-neutral-500 hover:text-neutral-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(newTagInput);
                }
              }}
              placeholder="digite e aperte enter para adicionar tag..."
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-neutral-700"
            />
            {existingTags.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) addTag(e.target.value);
                  e.target.value = '';
                }}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400 focus:outline-none"
              >
                <option value="">sugestões...</option>
                {existingTags
                  .filter((t) => !selectedTags.includes(t.name))
                  .map((t) => (
                    <option key={t.id} value={t.name}>
                      #{t.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-neutral-500 hover:text-neutral-300"
          >
            cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-neutral-200 text-neutral-950 font-medium rounded hover:bg-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'salvando...' : 'salvar'}
          </button>
        </div>
      </Form>
    </div>
  );
}
