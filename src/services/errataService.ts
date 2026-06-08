/**
 * Service d'erratas — charge public/data/errata.json (une fois, en cache) et
 * expose les erratas par identifiant de carte.
 * Voir schemas/errata.schema.json.
 */

export interface ErrataEntry {
  date: string;
  source?: string;
  summary: string;
  before?: string;
  after?: string;
  url?: string;
}

interface ErrataFile {
  errata: Record<string, ErrataEntry[]>;
}

let cache: Record<string, ErrataEntry[]> | null = null;
let loading: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (cache) return;
  if (!loading) {
    loading = fetch("/data/errata.json")
      .then((r) => (r.ok ? r.json() : { errata: {} }))
      .then((data: ErrataFile) => {
        cache = data?.errata ?? {};
      })
      .catch(() => {
        cache = {};
      });
  }
  await loading;
}

/** Précharge les erratas (à appeler au démarrage, facultatif). */
export async function preloadErrata(): Promise<void> {
  await ensureLoaded();
}

/** Erratas d'une carte (vide si aucun / non chargé). Synchrone. */
export function getErrata(cardId: string): ErrataEntry[] {
  return cache?.[cardId] ?? [];
}

/** Variante asynchrone qui garantit le chargement. */
export async function fetchErrata(cardId: string): Promise<ErrataEntry[]> {
  await ensureLoaded();
  return getErrata(cardId);
}
