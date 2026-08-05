/**
 * Reprise d'une version conservée par le journal `admin_audit`.
 *
 * Le journal ne devient PAS un éditeur : il navigue vers l'éditeur de l'entité
 * en lui passant `?reuse=<auditId>&side=before|after`. Ce composable porte la
 * part identique des deux éditeurs (errata, corrections de règles) — lecture du
 * paramètre, choix de l'instantané, nettoyage de l'URL, bandeau, erreurs — et
 * délègue à `apply` la seule chose qui diffère : le remplissage du formulaire.
 *
 * RIEN n'est écrit ici. La reprise ouvre l'éditeur pré-rempli ; c'est l'admin
 * qui enregistre, par le chemin d'écriture normal (audité, RLS appliquée).
 */
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getAuditEntry, listProfiles } from "@/services/adminService";
import type { AuditRow } from "@/schema";

function firstValue(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : null;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "date inconnue"
    : date.toLocaleString("fr-FR");
}

/** Pseudo de l'auteur ; l'uuid brut en repli, « système » si écrit par un trigger. */
async function actorLabel(actor: string | null | undefined): Promise<string> {
  if (!actor) return "système";
  const profiles = await listProfiles();
  return profiles.find((p) => p.user_id === actor)?.username ?? actor;
}

export function useReuseFromAudit(
  entity: AuditRow["entity"],
  apply: (snapshot: Record<string, unknown>) => void,
) {
  const route = useRoute();
  const router = useRouter();

  const reuseBanner = ref<string | null>(null);
  const reuseError = ref<string | null>(null);

  /**
   * À appeler APRÈS le chargement des données de l'écran : `apply` a souvent
   * besoin de savoir ce qui existe encore (un errata supprimé depuis se reprend
   * en création, pas en modification).
   */
  async function consumeReuseParam(): Promise<void> {
    const raw = firstValue(route.query.reuse);
    if (!raw) return;
    const id = Number(raw);
    // Paramètre non numérique : écran normal, pas de message — l'admin n'a
    // rien demandé qui mérite une erreur.
    if (!Number.isInteger(id)) return;

    const side = firstValue(route.query.side) === "before" ? "before" : "after";

    // Nettoyage AVANT tout traitement : un rafraîchissement ne doit pas rejouer
    // l'opération, même si la suite échoue.
    const query = { ...route.query };
    delete query.reuse;
    delete query.side;
    await router.replace({ query });

    const entry = await getAuditEntry(id);
    // `entity` est vérifiée : une cible erronée pré-remplirait un éditeur avec
    // les champs d'une autre entité.
    if (!entry || entry.entity !== entity) {
      reuseError.value =
        "Version introuvable : elle a peut-être été supprimée, ou l'accès est refusé.";
      return;
    }

    const snapshot = side === "before" ? entry.before_data : entry.after_data;
    if (!snapshot || typeof snapshot !== "object") {
      reuseError.value = "Cette version ne contient rien à reprendre.";
      return;
    }

    apply(snapshot as Record<string, unknown>);
    reuseBanner.value = `Version du ${formatTimestamp(entry.created_at)} par ${await actorLabel(
      entry.actor,
    )} — relis puis enregistre. Rien n'est encore modifié.`;
  }

  return { reuseBanner, reuseError, consumeReuseParam };
}
