import { useSearchParams } from 'react-router';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  if (totalPages <= 1) return null;

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page > 1) {
      next.set('p', page.toString());
    } else {
      next.delete('p');
    }
    setSearchParams(next);
  };

  // Generate page numbers with ellipses
  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 py-8 text-xs font-mono text-neutral-500">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => goToPage(currentPage - 1)}
        className="px-2 py-1 hover:text-neutral-200 disabled:opacity-20 disabled:hover:text-neutral-500 transition-colors"
        aria-label="Página anterior"
      >
        ‹
      </button>

      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`el-${idx}`} className="px-1 text-neutral-700">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => goToPage(p)}
            className={`px-2 py-1 rounded transition-colors ${
              p === currentPage
                ? 'text-neutral-100 font-semibold bg-neutral-900 border border-neutral-800'
                : 'hover:text-neutral-300'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => goToPage(currentPage + 1)}
        className="px-2 py-1 hover:text-neutral-200 disabled:opacity-20 disabled:hover:text-neutral-500 transition-colors"
        aria-label="Próxima página"
      >
        ›
      </button>
    </nav>
  );
}
