import { PlatformIcon } from './platform-icon';
import type { Platform } from '~/lib/platform';

export interface LinkCardData {
  id: number;
  url: string;
  platform: Platform | string;
  title: string | null;
  description: string | null;
  author: string | null;
  siteName: string | null;
  hasThumbnail: boolean;
  createdAt: Date | string;
  people: Array<{ id: number; name: string }>;
  tags: Array<{ id: number; name: string }>;
}

interface LinkCardProps {
  link: LinkCardData;
  isAdmin: boolean;
  onEdit?: (link: LinkCardData) => void;
  onDelete?: (id: number) => void;
  onRefetch?: (id: number) => void;
  onSelectTag?: (tag: string) => void;
  onSelectPerson?: (person: string) => void;
}

export function LinkCard({
  link,
  isAdmin,
  onEdit,
  onDelete,
  onRefetch,
  onSelectTag,
  onSelectPerson,
}: LinkCardProps) {
  const displayTitle = link.title || link.url.replace(/^https?:\/\//, '');

  return (
    <article className="group relative flex items-start gap-3 py-3 px-1 border-b border-neutral-900 hover:bg-neutral-950/60 transition-colors">
      {/* Thumbnail or platform icon */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 block"
      >
        {link.hasThumbnail ? (
          <img
            src={`/img/${link.id}`}
            alt=""
            loading="lazy"
            className="w-16 h-12 md:w-20 md:h-14 object-cover rounded bg-neutral-900 border border-neutral-800"
          />
        ) : (
          <div className="w-16 h-12 md:w-20 md:h-14 rounded bg-neutral-900 border border-neutral-800/80 flex items-center justify-center text-neutral-600 group-hover:text-neutral-400 transition-colors">
            <PlatformIcon platform={link.platform} className="w-5 h-5" />
          </div>
        )}
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-normal text-neutral-200 hover:text-white line-clamp-2 md:line-clamp-1 transition-colors"
          >
            {displayTitle}
          </a>

          <div className="shrink-0 flex items-center gap-1.5 pt-0.5 text-neutral-500">
            <PlatformIcon platform={link.platform} className="w-3.5 h-3.5" />
          </div>
        </div>

        {link.description && (
          <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
            {link.description}
          </p>
        )}

        {/* Metadata + chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] font-mono">
          {link.author && (
            <span className="text-neutral-500 truncate max-w-[160px] mr-1">
              {link.author}
            </span>
          )}

          {link.tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTag?.(t.name);
              }}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
            >
              #{t.name}
            </button>
          ))}

          {link.people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPerson?.(p.name);
              }}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-neutral-900/60 border border-neutral-800/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 transition-colors"
            >
              @{p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Admin action buttons */}
      {isAdmin && (
        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRefetch && (
            <button
              type="button"
              onClick={() => onRefetch(link.id)}
              aria-label="Atualizar prévia"
              title="Atualizar prévia"
              className="text-neutral-500 hover:text-neutral-200 text-xs font-mono"
            >
              ↻
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(link)}
              aria-label="Editar"
              className="text-neutral-500 hover:text-neutral-200 text-xs font-mono"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(link.id)}
              aria-label="Apagar"
              className="text-neutral-500 hover:text-red-400 text-xs font-mono"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </article>
  );
}
