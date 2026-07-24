/**
 * Scrape des règles officielles (wtcg-return.fr/regles/completes) vers des
 * lignes `rules`. Le repère fiable est le NUMÉRO — en tête de texte pour les
 * titres ("4.", "418.") ou en attribut `id` pour les règles individuelles
 * (markup réel : `<div id="418.5b" class="regle-target">`, le numéro n'est
 * PAS répété dans le texte du corps) — on ne dépend donc pas des balises
 * exactes ni d'une seule forme de markup.
 *
 * Usage : npx tsx scripts/scrapeRules.ts   (écrit le JSON sur stdout)
 */
import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import type { RuleRow } from "../src/schema/rules";

const CHAPTER_RE = /^(\d)\.\s+(.+)$/; //  "4. Concepts de Jeu"
const SECTION_RE = /^(\d{3})\.\s+(.+)$/; //  "418. Ressources et Coûts"
const RULE_RE = /^(\d{3}\.\d+[a-z]?)\s+(.+)$/s; //  "418.5b Pour payer…"
const RULE_ID_RE = /^\d{3}\.\d+[a-z]?$/; //  id="418.5b" (markup réel)

/** Convertit le HTML des règles complètes en lignes prêtes pour la table. */
export function parseRules(html: string): RuleRow[] {
  const $ = cheerio.load(html);

  // Le sommaire (table des matières) répète le numéro + titre de CHAQUE
  // chapitre/section en tête de page, dans le même ordre que le corps. Le
  // retirer avant de parcourir évite à la fois les doublons ET une réécriture
  // erronée de sort_order (sinon tous les titres se retrouveraient regroupés
  // en tête, avant les règles, au lieu d'être entrelacés dans l'ordre réel).
  $("#toc, .regle-toc").remove();

  const rows: RuleRow[] = [];
  const seen = new Set<string>();
  let chapter = 0;
  let order = 0;

  const push = (row: RuleRow) => {
    if (seen.has(row.number)) return; // défensif : doublon de markup résiduel
    seen.add(row.number);
    rows.push(row);
  };

  $("h1, h2, h3, h4, div.regle-target[id], p, li").each((_, el) => {
    if (el.tagName?.toLowerCase() === "div") {
      // Markup réel wtcg-return.fr : le numéro vit dans l'attribut `id`, le
      // corps dans un enfant séparé (le texte du <p> ne le répète pas).
      const id = $(el).attr("id") ?? "";
      if (!RULE_ID_RE.test(id)) return; // ignore les div englobantes chapitre/section
      const clone = $(el).clone();
      clone.find(".flex-shrink-regle, .ps-5").remove(); // numéro + bloc "Exemple :"
      const body = clone.text().replace(/\s+/g, " ").trim();
      if (!body) return;
      push({
        number: id,
        kind: "rule",
        chapter: chapter || Number(id[0]),
        title: null,
        body,
        sort_order: order++,
      });
      return;
    }

    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    const chap = CHAPTER_RE.exec(text);
    if (chap) {
      chapter = Number(chap[1]);
      push({
        number: chap[1],
        kind: "chapter",
        chapter,
        title: chap[2].trim(),
        body: null,
        sort_order: order++,
      });
      return;
    }

    const sec = SECTION_RE.exec(text);
    if (sec) {
      push({
        number: sec[1],
        kind: "section",
        chapter: chapter || Number(sec[1][0]),
        title: sec[2].trim(),
        body: null,
        sort_order: order++,
      });
      return;
    }

    // Repli pour un markup plus simple (numéro en tête de paragraphe, ex.
    // "418.1 Une ressource est…") — non observé sur la page réelle (le
    // numéro y est en attribut `id`) mais couvre d'autres sources.
    const rule = RULE_RE.exec(text);
    if (rule) {
      push({
        number: rule[1],
        kind: "rule",
        chapter: chapter || Number(rule[1][0]),
        title: null,
        body: rule[2].trim(),
        sort_order: order++,
      });
    }
  });

  return rows;
}

// Exécution directe : lit le HTML brut versionné et imprime le JSON.
if (process.argv[1]?.endsWith("scrapeRules.ts")) {
  const html = readFileSync(
    "raw-card-data/pages/regles/completes.html",
    "utf8",
  );
  const rows = parseRules(html);
  console.error(`Parsé : ${rows.length} lignes.`);
  console.log(JSON.stringify(rows, null, 2));
}
