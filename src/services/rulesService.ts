/**
 * Service des règles officielles — charge la vue `rules_effective` (fusion
 * règles + corrections admin) UNE seule fois (index complet, trié par
 * sort_order puis number) et l'expose au front.
 *
 * Repli : la vue `rules_effective` n'existe qu'une fois la migration 0013
 * appliquée. Tant que ce n'est pas le cas (déploiement différé), une requête
 * en échec sur la vue se replie sur la table d'origine `rules`, en donnant
 * aux colonnes propres à la vue (`is_edited`, `body_official`) leur valeur
 * neutre. Cela rend le déploiement sûr dans n'importe quel ordre.
 *
 * Dégradation : Supabase absent / requête (et repli) en échec → liste vide,
 * jamais d'exception. La vue affiche alors un état d'erreur explicite.
 */
import { supabase } from "@/services/supabase";
import { ruleEffectiveRowSchema, type RuleEffectiveRow } from "@/schema";

let cache: RuleEffectiveRow[] | null = null;
let loading: Promise<RuleEffectiveRow[]> | null = null;

/** Réinitialise le cache — tests uniquement. */
export function __resetRulesCache(): void {
  cache = null;
  loading = null;
}

async function load(): Promise<RuleEffectiveRow[]> {
  if (!supabase) {
    cache = [];
    return cache;
  }
  try {
    const { data, error } = await supabase
      .from("rules_effective")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("number", { ascending: true });
    // La vue n'existe qu'après la migration 0013 : tant qu'elle n'est pas
    // appliquée, on lit la table d'origine. Rend le déploiement sûr dans
    // n'importe quel ordre.
    if (error) {
      console.warn(
        "[rulesService] `rules_effective` indisponible, repli sur `rules` :",
        error,
      );
      const fallback = await supabase
        .from("rules")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("number", { ascending: true });
      if (fallback.error || !Array.isArray(fallback.data)) {
        cache = [];
        return cache;
      }
      // Les colonnes de la vue absentes de la table prennent leur valeur neutre.
      cache = fallback.data
        .map((raw) =>
          ruleEffectiveRowSchema.safeParse({
            ...(raw as object),
            is_edited: false,
            body_official: null,
          }),
        )
        .filter(
          (p): p is { success: true; data: RuleEffectiveRow } => p.success,
        )
        .map((p) => p.data);
      return cache;
    }
    if (!Array.isArray(data)) {
      cache = [];
      return cache;
    }
    cache = data
      .map((raw) => ruleEffectiveRowSchema.safeParse(raw))
      .filter((p): p is { success: true; data: RuleEffectiveRow } => p.success)
      .map((p) => p.data);
    return cache;
  } catch (err) {
    console.warn(
      "[rulesService] exception lors du chargement de `rules_effective` :",
      err,
    );
    cache = [];
    return cache;
  }
}

/** Charge (une fois) et renvoie toutes les règles, dans l'ordre de lecture. */
export async function loadRules(): Promise<RuleEffectiveRow[]> {
  if (cache) return cache;
  loading ??= load();
  return loading;
}

/**
 * Force un rechargement au prochain accès (après une écriture admin).
 * Distinct de `__resetRulesCache` (tests) : c'est un chemin de production.
 */
export async function refreshRules(): Promise<RuleEffectiveRow[]> {
  cache = null;
  loading = null;
  return loadRules();
}

/** Règles déjà chargées (vide sinon). Synchrone. */
export function getRules(): RuleEffectiveRow[] {
  return cache ?? [];
}
