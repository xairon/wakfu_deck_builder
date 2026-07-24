/**
 * Service d'erratas — charge l'index COMPLET une seule fois depuis Supabase
 * (table `card_errata`) et l'expose par identifiant de carte.
 *
 * L'index entier est chargé en un seul appel : afficher un badge « Erraté » sur
 * la grille imposerait sinon d'interroger les 1585 cartes une par une.
 *
 * Repli JSON : `public/data/errata.json` reste livré (copie vérifiée) et sert
 * de repli quand Supabase est absent, la requête échoue, ou renvoie un index
 * vide (ex. avant que la migration/seed `card_errata` n'ait tourné) — ce qui
 * rend la bascule Supabase sûre dans n'importe quel ordre. JAMAIS d'exception
 * (une panne d'errata ne doit pas casser la collection ni le deck builder).
 */
import { supabase } from "@/services/supabase";
import { errataRowSchema } from "@/schema";

export interface ErrataEntry {
  date: string;
  source?: string;
  summary: string;
  before?: string;
  after?: string;
  url?: string;
}

let cache: Record<string, ErrataEntry[]> | null = null;
let loading: Promise<void> | null = null;

/** Réinitialise le cache — tests uniquement. */
export function __resetErrataCache(): void {
  cache = null;
  loading = null;
}

/**
 * Normalise une date en ISO "YYYY-MM-DD" : accepte "DD/MM/YYYY" (JSON local)
 * et passe telle quelle une date déjà ISO (colonne `date` Postgres). Toute
 * autre valeur (vide, malformée) est renvoyée inchangée — l'affichage (voir
 * `utils/date.ts`) est seul responsable de ne jamais rendre "Invalid Date".
 */
function toIsoDate(raw: string | null | undefined): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // déjà ISO
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
}

interface RawJsonErrataEntry {
  date?: string;
  source?: string;
  summary: string;
  before?: string;
  after?: string;
  url?: string;
}

/** Repli local : charge et normalise `public/data/errata.json`. */
async function loadFromJson(): Promise<Record<string, ErrataEntry[]>> {
  try {
    const res = await fetch("/data/errata.json");
    if (!res.ok) return {};
    const parsed = (await res.json()) as {
      errata?: Record<string, RawJsonErrataEntry[]>;
    };
    const index: Record<string, ErrataEntry[]> = {};
    for (const [cardId, list] of Object.entries(parsed?.errata ?? {})) {
      index[cardId] = list.map((e) => ({
        date: toIsoDate(e.date),
        source: e.source,
        summary: e.summary,
        before: e.before,
        after: e.after,
        url: e.url,
      }));
    }
    return index;
  } catch {
    return {};
  }
}

async function load(): Promise<void> {
  if (!supabase) {
    cache = await loadFromJson();
    return;
  }
  try {
    const { data, error } = await supabase
      .from("card_errata")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn(
        "[errataService] requête `card_errata` en échec, repli sur le JSON local :",
        error,
      );
    }
    if (error || !Array.isArray(data) || data.length === 0) {
      cache = await loadFromJson();
      return;
    }
    const index: Record<string, ErrataEntry[]> = {};
    for (const raw of data) {
      const parsed = errataRowSchema.safeParse(raw);
      if (!parsed.success) continue; // ligne invalide → ignorée
      const r = parsed.data;
      (index[r.card_id] ??= []).push({
        date: toIsoDate(r.errata_date),
        source: r.source ?? undefined,
        summary: r.summary,
        before: r.before_text ?? undefined,
        after: r.after_text ?? undefined,
      });
    }
    cache = index;
  } catch (err) {
    console.warn(
      "[errataService] exception lors du chargement de `card_errata`, repli sur le JSON local :",
      err,
    );
    cache = await loadFromJson();
  }
}

async function ensureLoaded(): Promise<void> {
  if (cache) return;
  loading ??= load();
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

/** Prédicat du badge « Erraté » — O(1) sur l'index déjà chargé. */
export function hasErrata(cardId: string): boolean {
  return (cache?.[cardId]?.length ?? 0) > 0;
}

/** Index complet (page /errata). Vide si non chargé. */
export function getAllErrata(): Record<string, ErrataEntry[]> {
  return cache ?? {};
}
