/**
 * Service d'erratas — charge l'index COMPLET une seule fois depuis Supabase
 * (table `card_errata`) et l'expose par identifiant de carte.
 *
 * L'index entier est chargé en un seul appel : afficher un badge « Erraté » sur
 * la grille imposerait sinon d'interroger les 1585 cartes une par une.
 *
 * Dégradation : Supabase absent / requête en échec / ligne invalide → index vide
 * ou ligne ignorée, JAMAIS d'exception (une panne d'errata ne doit pas casser la
 * collection ni le deck builder).
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

async function load(): Promise<void> {
  if (!supabase) {
    cache = {};
    return;
  }
  try {
    const { data, error } = await supabase.from("card_errata").select("*");
    if (error || !Array.isArray(data)) {
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
  } catch {
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
