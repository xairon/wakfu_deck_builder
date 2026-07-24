/**
 * Service d'erratas — charge l'index COMPLET une seule fois depuis Supabase
 * (table `card_errata`) et l'expose par identifiant de carte.
 *
 * L'index entier est chargé en un seul appel : afficher un badge « Erraté » sur
 * la grille imposerait sinon d'interroger les 1585 cartes une par une.
 *
 * Source unique : la table `card_errata` (seedée depuis l'ex-`errata.json`, qui
 * a été supprimé une fois le seed vérifié — 66 lignes, lecture anon confirmée).
 *
 * Dégradation : Supabase absent / requête en échec / ligne invalide → index vide
 * ou ligne ignorée, JAMAIS d'exception (une panne d'errata ne doit casser ni la
 * collection ni le deck builder). Un échec de requête est journalisé en
 * `console.warn` : sans ça, une table ou une RLS cassée serait indiscernable de
 * « aucun errata ».
 */
import { supabase } from "@/services/supabase";
import { errataRowSchema } from "@/schema";

export interface ErrataEntry {
  /** ISO "YYYY-MM-DD" (colonne `date` Postgres). Vide si absente. */
  date: string;
  source?: string;
  summary: string;
  before?: string;
  after?: string;
}

let cache: Record<string, ErrataEntry[]> | null = null;
let loading: Promise<void> | null = null;

/** Réinitialise le cache — tests uniquement. */
export function __resetErrataCache(): void {
  cache = null;
  loading = null;
}

async function load(): Promise<void> {
  if (!supabase) {
    cache = {};
    return;
  }
  try {
    const { data, error } = await supabase
      .from("card_errata")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("[errataService] requête `card_errata` en échec :", error);
      cache = {};
      return;
    }
    if (!Array.isArray(data)) {
      cache = {};
      return;
    }
    const index: Record<string, ErrataEntry[]> = {};
    for (const raw of data) {
      const parsed = errataRowSchema.safeParse(raw);
      if (!parsed.success) continue; // ligne invalide → ignorée
      const r = parsed.data;
      (index[r.card_id] ??= []).push({
        date: r.errata_date ?? "",
        source: r.source ?? undefined,
        summary: r.summary,
        before: r.before_text ?? undefined,
        after: r.after_text ?? undefined,
      });
    }
    cache = index;
  } catch (err) {
    console.warn(
      "[errataService] exception lors du chargement de `card_errata` :",
      err,
    );
    cache = {};
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
