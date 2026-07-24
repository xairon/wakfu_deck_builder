/**
 * Service des règles officielles — charge la table `rules` UNE seule fois
 * (index complet, trié par sort_order) et l'expose au front.
 *
 * Dégradation : Supabase absent / requête en échec → liste vide, jamais
 * d'exception. La vue affiche alors un état d'erreur explicite.
 */
import { supabase } from "@/services/supabase";
import { ruleRowSchema, type RuleRow } from "@/schema";

let cache: RuleRow[] | null = null;
let loading: Promise<RuleRow[]> | null = null;

/** Réinitialise le cache — tests uniquement. */
export function __resetRulesCache(): void {
  cache = null;
  loading = null;
}

async function load(): Promise<RuleRow[]> {
  if (!supabase) {
    cache = [];
    return cache;
  }
  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !Array.isArray(data)) {
      cache = [];
      return cache;
    }
    cache = data
      .map((raw) => ruleRowSchema.safeParse(raw))
      .filter((p): p is { success: true; data: RuleRow } => p.success)
      .map((p) => p.data);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

/** Charge (une fois) et renvoie toutes les règles, dans l'ordre de lecture. */
export async function loadRules(): Promise<RuleRow[]> {
  if (cache) return cache;
  loading ??= load();
  return loading;
}

/** Règles déjà chargées (vide sinon). Synchrone. */
export function getRules(): RuleRow[] {
  return cache ?? [];
}
