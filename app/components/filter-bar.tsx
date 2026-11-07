import { useSearchParams } from 'react-router';

interface FilterBarProps {
  existingPeople: Array<{ id: number; name: string }>;
  existingTags: Array<{ id: number; name: string }>;
}

export function FilterBar({ existingPeople, existingTags }: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentQ = searchParams.get('q') || '';
  const currentRede = searchParams.get('rede') || '';
  const currentTag = searchParams.get('tag') || '';
  const currentPessoa = searchParams.get('pessoa') || '';

  const hasActiveFilters =
    Boolean(currentQ) ||
    Boolean(currentRede) ||
    Boolean(currentTag) ||
    Boolean(currentPessoa);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('p'); // Reset to page 1 on filter change
    setSearchParams(next);
  };

  const clearAll = () => {
    setSearchParams(new URLSearchParams());
  };

  const platforms = [
    { id: 'youtube', label: 'YouTube' },
    { id: 'x', label: 'X' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'outro', label: 'Outros' },
  ];

  return (
    <div className="space-y-2 mb-6">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={currentQ}
          onChange={(e) => updateParam('q', e.target.value)}
          placeholder="buscar por título, link, descrição ou autor..."
          className="w-full bg-neutral-950 border border-neutral-900 rounded px-3 py-2 text-xs font-mono text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-700 transition-colors"
        />
        {currentQ && (
          <button
            type="button"
            onClick={() => updateParam('q', '')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-600 hover:text-neutral-400 font-mono"
          >
            ×
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-500">
        {/* Rede select */}
        <select
          value={currentRede}
          onChange={(e) => updateParam('rede', e.target.value)}
          aria-label="Filtrar por rede"
          className="bg-neutral-950 border border-neutral-900 rounded px-2 py-1 text-neutral-400 focus:outline-none"
        >
          <option value="">rede: todas</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Tag select */}
        {existingTags.length > 0 && (
          <select
            value={currentTag}
            onChange={(e) => updateParam('tag', e.target.value)}
            aria-label="Filtrar por tag"
            className="bg-neutral-950 border border-neutral-900 rounded px-2 py-1 text-neutral-400 focus:outline-none"
          >
            <option value="">tag: todas</option>
            {existingTags.map((t) => (
              <option key={t.id} value={t.name}>
                #{t.name}
              </option>
            ))}
          </select>
        )}

        {/* Pessoa select */}
        {existingPeople.length > 0 && (
          <select
            value={currentPessoa}
            onChange={(e) => updateParam('pessoa', e.target.value)}
            aria-label="Filtrar por pessoa"
            className="bg-neutral-950 border border-neutral-900 rounded px-2 py-1 text-neutral-400 focus:outline-none"
          >
            <option value="">pessoa: todas</option>
            {existingPeople.map((p) => (
              <option key={p.id} value={p.name}>
                @{p.name}
              </option>
            ))}
          </select>
        )}

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-neutral-500 hover:text-neutral-300 ml-auto transition-colors"
          >
            limpar
          </button>
        )}
      </div>
    </div>
  );
}
