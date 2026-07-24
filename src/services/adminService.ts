/**
 * Écritures d'administration (règles, errata, rôles).
 *
 * ⚠️ Ce service NE décide RIEN en matière de sécurité : il envoie la requête et
 * remonte le verdict de la base. C'est la RLS (`is_admin()` / `is_owner()`) qui
 * autorise ou refuse — un utilisateur qui appellerait ces fonctions sans les
 * droits obtiendrait la même erreur qu'en appelant l'API à la main.
 *
 * Chaque écriture réussie rafraîchit l'index concerné : les services de lecture
 * chargent une seule fois et garderaient sinon l'ancien contenu.
 */
import { supabase } from "./supabase";
import { useAuthStore } from "@/stores/authStore";
import { refreshRules } from "./rulesService";
import { refreshErrata } from "./errataService";
import type { RuleOverrideRow, UserRole, AuditRow } from "@/schema";

export interface WriteResult {
  ok: boolean;
  error?: string;
}

const NO_BACKEND = "Service indisponible (backend non configuré).";

function fail(error: unknown): WriteResult {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : "Écriture refusée.";
  return { ok: false, error: message };
}

/** Crée ou met à jour la correction d'une règle. */
export async function upsertRuleOverride(
  row: RuleOverrideRow,
): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  try {
    const authStore = useAuthStore();
    const { error } = await supabase
      .from("rules_overrides")
      .upsert(
        { ...row, updated_by: authStore.userId },
        { onConflict: "number" },
      );
    if (error) return fail(error);
    await refreshRules();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Supprime la correction — la règle officielle reprend sa place. */
export async function deleteRuleOverride(number: string): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  try {
    const { error } = await supabase
      .from("rules_overrides")
      .delete()
      .eq("number", number);
    if (error) return fail(error);
    await refreshRules();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export interface ErratumInput {
  card_id: string;
  errata_date?: string | null;
  source?: string | null;
  summary: string;
  before_text?: string | null;
  after_text?: string | null;
  sort_order?: number;
}

export async function createErratum(input: ErratumInput): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  try {
    const authStore = useAuthStore();
    const { error } = await supabase
      .from("card_errata")
      .insert({ sort_order: 0, ...input, updated_by: authStore.userId });
    if (error) return fail(error);
    await refreshErrata();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateErratum(
  id: number,
  input: Partial<ErratumInput>,
): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  try {
    const authStore = useAuthStore();
    const { error } = await supabase
      .from("card_errata")
      .update({ ...input, updated_by: authStore.userId })
      .eq("id", id);
    if (error) return fail(error);
    await refreshErrata();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteErratum(id: number): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  try {
    const { error } = await supabase.from("card_errata").delete().eq("id", id);
    if (error) return fail(error);
    await refreshErrata();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Attribue un rôle. Passe par la RPC : `role` n'est pas écrivable directement. */
export async function setUserRole(
  userId: string,
  role: Exclude<UserRole, "owner">,
): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  try {
    const { error } = await supabase.rpc("set_user_role", {
      p_user_id: userId,
      p_role: role,
    });
    if (error) return fail(error);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Journal, du plus récent au plus ancien. Vide si non autorisé (RLS).
 *
 * Dégradation : requête en échec / exception → liste vide, jamais
 * d'exception (comme les services de lecture `rulesService`/`errataService` —
 * « ne jamais lever » est une exigence dure de ce projet). Un échec est
 * journalisé en `console.warn` : sans ça, une table ou une RLS cassée serait
 * indiscernable de « aucune entrée ».
 */
export async function listAudit(limit = 200): Promise<AuditRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("admin_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[adminService] requête `admin_audit` en échec :", error);
      return [];
    }
    if (!Array.isArray(data)) return [];
    return data as AuditRow[];
  } catch (err) {
    console.warn(
      "[adminService] exception lors du chargement de `admin_audit` :",
      err,
    );
    return [];
  }
}

/**
 * Profils + rôles (page de gestion des comptes).
 *
 * Même dégradation que `listAudit` : jamais d'exception, `console.warn` sur
 * échec de requête ou exception.
 */
export async function listProfiles(): Promise<
  { user_id: string; username: string; role: UserRole }[]
> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, role")
      .order("username", { ascending: true });
    if (error) {
      console.warn("[adminService] requête `profiles` en échec :", error);
      return [];
    }
    if (!Array.isArray(data)) return [];
    return data as { user_id: string; username: string; role: UserRole }[];
  } catch (err) {
    console.warn(
      "[adminService] exception lors du chargement de `profiles` :",
      err,
    );
    return [];
  }
}
