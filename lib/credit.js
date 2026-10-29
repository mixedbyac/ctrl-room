const ROLE_WORD = { mix: 'Mixed', master: 'Mastered', record: 'Recorded', produce: 'Produced' };
export const ROLES = [['mix', 'Mixing'], ['master', 'Mastering'], ['record', 'Recording'], ['produce', 'Production']];

/** "Mixed & mastered by AC" from a profile (or the engineer's own wording, if they wrote one). */
export function creditLine(p) {
  if (!p) return '';
  const who = p.display_name || p.full_name || (p.email || '').replace(/@.*/, '');
  if (p.credit && p.credit.trim()) return p.credit.trim();
  const words = (p.roles?.length ? p.roles : ['mix']).map((r) => ROLE_WORD[r]).filter(Boolean);
  const verbs = words.length > 1 ? `${words.slice(0, -1).join(', ')} & ${words.at(-1).toLowerCase()}` : words[0];
  return `${verbs.replace(/, (\w)/g, (m, c) => `, ${c.toLowerCase()}`)} by ${who}`;
}
