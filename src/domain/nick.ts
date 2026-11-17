/** Longest nick that still fits a machine tile on a tablet. */
export const NICK_MAX = 8;

const REPLACE: [RegExp, string][] = [
  [/\bHERMLE\s+/gi, ''],
  [/\bDUO\s+BLOCK\b/gi, 'DB'],
  [/\bHI-?DYN\b/gi, 'HD'],
  [/\bLINEAR\b/gi, 'L'],
];

/**
 * Short name for the tile, made from the full machine name:
 * "HERMLE C42 / 4" → "C42/4", "DMU 80P DUO BLOCK / 1" → "80P DB/1", "CHIRON 800" → "CHI 800".
 * Too long: a long leading brand is cut to 3 letters, a short model prefix (DMU, DMC…) is dropped.
 * Other names stay as they are (the tile ends them with "…" when needed).
 */
export function autoNick(name: string): string {
  let s = name.trim().replace(/\s+/g, ' ');
  for (const [re, to] of REPLACE) s = s.replace(re, to);
  s = s.replace(/\s*\/\s*/g, '/').trim();
  let words = s.split(' ').filter(Boolean);
  if (words.length === 0) return name.trim();
  const len = () => words.join(' ').length;
  if (len() > NICK_MAX && words.length > 1 && /^[A-Z]{4,}$/.test(words[0])) words[0] = words[0].slice(0, 3);
  while (len() > NICK_MAX && words.length > 1 && /^[A-Z]{1,3}$/.test(words[0])) words = words.slice(1);
  return words.join(' ');
}

/** What the tile shows: the nick set in Settings, otherwise the automatic one. */
export const nickOf = (m: { name: string; nick?: string }) => m.nick?.trim() || autoNick(m.name);
