/**
 * US university lookup.
 *
 * Source: the Hipo `university-domains-list` dataset, filtered to
 * country === "United States", de-duplicated by name, with every known email
 * domain kept per institution. 2,337 institutions, 2,393 domains, ~129 KB.
 *
 * It is bundled rather than fetched at runtime so signup keeps working with
 * no network dependency, no CORS surprises, and no third-party uptime in the
 * critical path of account creation. It is lazy-loaded on first use so the
 * 129 KB never lands in the initial page bundle.
 *
 * Free text is always allowed — the list is an aid, not a gate. New campuses,
 * institutes, and hospital-affiliated labs are missing from any snapshot.
 */

export interface University { n: string; d: string[] }

let cache: University[] | null = null;
let inflight: Promise<University[]> | null = null;

/** Loads (once) and memoises the dataset. */
export async function loadUniversities(): Promise<University[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = import('./us-universities.json').then((m) => {
      cache = (m.default ?? m) as University[];
      return cache;
    });
  }
  return inflight;
}

/** Synchronous accessor — null until loadUniversities() resolves. */
export function peekUniversities(): University[] | null {
  return cache;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Ranked search.
 *
 * Matching is per word, not on the raw string, because people abbreviate as
 * they type: "mass inst" and "univ of mich" are how these actually get
 * entered, and neither appears as a contiguous substring of the full name.
 * Every query token must prefix some word in the name.
 *
 * Ranking, best first:
 *   0  exact name
 *   1  name starts with the whole query      ("stanford" → Stanford University)
 *   2  all tokens prefix words, in order     ("univ of mich" → U. of Michigan)
 *   3  all tokens prefix words, any order    ("michigan univ")
 *   4  raw substring anywhere
 *   5  email domain prefix                   ("mit.e" → mit.edu)
 * Ties break toward the shorter name, so "Boston University" outranks
 * "Boston University Metropolitan College".
 */
export function searchUniversities(list: University[], query: string, limit = 8): University[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);

  const scored: { u: University; score: number }[] = [];

  for (const u of list) {
    const name = norm(u.n);
    const words = name.split(' ');
    let tier = -1;

    if (name === q) tier = 0;
    else if (name.startsWith(q)) tier = 1;
    else {
      // In-order token walk: each token must prefix a later word.
      let cursor = 0;
      let ordered = true;
      for (const t of tokens) {
        const at = words.findIndex((w, i) => i >= cursor && w.startsWith(t));
        if (at === -1) { ordered = false; break; }
        cursor = at + 1;
      }
      if (ordered) tier = 2;
      else if (tokens.every((t) => words.some((w) => w.startsWith(t)))) tier = 3;
      else if (name.includes(q)) tier = 4;
      else if (u.d.some((d) => d.startsWith(q))) tier = 5;
    }

    if (tier >= 0) scored.push({ u, score: tier * 1000 + Math.min(999, u.n.length) });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.u);
}

/**
 * Reverse lookup: given a .edu address, which institution issued it?
 * Falls back to the registrable part of the domain (sub.dept.mit.edu → mit.edu)
 * so departmental addresses still resolve.
 */
export function universityForDomain(list: University[], domain: string): University | null {
  const d = domain.toLowerCase().trim();
  if (!d) return null;

  const exact = list.find((u) => u.d.includes(d));
  if (exact) return exact;

  const parts = d.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    const hit = list.find((u) => u.d.includes(parent));
    if (hit) return hit;
  }
  return null;
}
