import { normalizeUrl } from './normalize-url';

export interface ParsedImportItem {
  rawUrl: string;
  urlKey: string;
  tags: string[];
  people: string[];
  lineNumber: number;
}

export function parseImportText(text: string): ParsedImportItem[] {
  const lines = text.split(/\r?\n/);
  const items: ParsedImportItem[] = [];

  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const tagRegex = /#([a-zA-Z0-9_\u00C0-\u017F-]+)/g;
  const personRegex = /@([a-zA-Z0-9_\u00C0-\u017F-]+)/g;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Find all URLs in this line
    const urls = trimmed.match(urlRegex);
    if (!urls) return;

    // Extract tags from this line
    const lineTags: string[] = [];
    let tagMatch: RegExpExecArray | null;
    const tagMatcher = new RegExp(tagRegex);
    while ((tagMatch = tagMatcher.exec(trimmed)) !== null) {
      const tag = tagMatch[1].toLowerCase().trim();
      if (tag && !lineTags.includes(tag)) {
        lineTags.push(tag);
      }
    }

    // Extract people from this line
    const linePeople: string[] = [];
    let personMatch: RegExpExecArray | null;
    const personMatcher = new RegExp(personRegex);
    while ((personMatch = personMatcher.exec(trimmed)) !== null) {
      const person = personMatch[1].toLowerCase().trim();
      if (person && !linePeople.includes(person)) {
        linePeople.push(person);
      }
    }

    for (const rawUrl of urls) {
      // Clean any trailing punctuation from url extraction (e.g. trailing '.', ',', ')')
      const cleanRawUrl = rawUrl.replace(/[.,;:)\]>]+$/, '');
      const urlKey = normalizeUrl(cleanRawUrl);

      if (urlKey) {
        items.push({
          rawUrl: cleanRawUrl,
          urlKey,
          tags: [...lineTags],
          people: [...linePeople],
          lineNumber: idx + 1,
        });
      }
    }
  });

  return items;
}

