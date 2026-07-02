import type { Card } from "@/types/cards";

// Version du cache : à incrémenter quand la forme/normalisation des cartes
// change (sinon les anciens caches servent des données obsolètes — ex. mots-clés
// pollués, éléments en minuscules).
const CACHE_KEY = "wakfu-cards-cache-v51"; // v51 : INCLINAISON/REDRESSEMENT MULTI-CIBLES À COMPTE LIÉ (W41, deck-driven starters Incarnam) — ops tapMultiTarget/untapMultiTarget (ciblage répété borné, nombre = boundCount via fromCount ; cibles distinctes ; jumeaux de damageMultiTarget mais action SET_ORIENTATION via resolveTapTarget/resolveUntapTarget). Mécaniques mappées sur tap-target/untap-target (pas de nouveau tag). DSL : corps « Inclinez/Redressez le même nombre d'Alliés ou Héros de votre choix [, dans l'ordre de votre choix] » dans compileRecycleCountBody → sert coût de défausse (Choc Temporel) ET de recyclage (Parchemin d'Agilité). Garde : compte 0 → no-op (pas de picker vide). +2 auto → 436/1802 (24,2 %), starters Incarnam 42→40. v50 : VERROU ONCE-PER-TURN + COÛT COMPOSÉ (W40, deck-driven starters Incarnam) — flags `oncePerTurn` (« N'utilisez ce pouvoir qu'une seule fois par tour » sur pouvoir NON-tap : la clause EST le verrou → jeton powerUses0 posé à l'activation, purgé fin de tour, gate dans activateTapPower) et `tapsSource` (requiresIncline + coût payé : l'activation incline AUSSI la source — Amulette Akwadala) sur compiledEffectSchema. compileDiscardCountCost : strip once-clause → flag + repli compileBody pour corps FIXE (« Piochez une carte », « <self> inflige N ») ; isDiscardCostText ajouté au repli tapPowers (parité compileEffects). Garde de fidélité : coût de défausse IMPOSÉ impayable (main < n) refusé AVANT de consommer inclinaison/verrou. +5 auto (Bwork Mage ×2, Abrakleur Clair, Chouquette, Amulette Akwadala) → 434/1802 (24,1 %), starters Incarnam 44→42. v49 : VALEUR DYNAMIQUE CANONIQUE (ValueExpr, modèle Forge « Count$ » / MTG) — toute magnitude d'op est un littéral `n` OU une `value: ValueExpr` (AST évalué à la résolution par UN évaluateur moteur `evalValue`). Variantes câblées : `fixed` (littéral) + `count` (« … égal au nombre de <X> que vous contrôlez » ; Équipement attaché co-localisé avec son Porteur → compté). DSL : « Piochez un nombre de cartes égal au nombre de <X> que vous contrôlez » → draw{value:{kind:"count",of:{source:"controlled",what,sub?}}}. +1 auto (Enutrof Incarnam) → 414/1802 (23,0 %). Fondation SOTA : les futurs nœuds (boundCount/statOf/mirror/plus) s'ajoutent AVEC leur effet consommateur. `fromCount`/`perCount` restent legacy reconnus (repli non migré). PUIS primitive #3 EFFETS DE REMPLACEMENT (W35) : StaticAbility `damagePreventionAura` (prévention de Dommages continue) lue au choke point `reduceDamage` (hors combat aussi) — `all`(« réduits à 0 ») / `n`(« de N »), bénéficiaire `controllerHero`(« à votre Héros ») / `controlledAllies{sub?}`(« à vos <Famille> »). DSL : « [Tant que <self> dans le Monde,] tous les Dommages sur le point d'être infligés à <bénéf> sont réduits <montant> ». +2 auto (Allister bouclier Héros total, Donjon des Craqueleurs −1) → 416/1802 (23,1 %). Incrément 2 : StaticAbility `damageUnpreventable` (self, sens dealer) — « Les Dommages infligés par <self> ne peuvent pas être réduits » → reduceDamage renvoie le montant BRUT (bypass Résistance/prévention/Trêve), lu sur hit.sourceId. +2 auto (Chevalier Ténèbres ×2 éditions) → 418/1802 (23,2 %). Reste manuel : sens sortant self/jeton (Actions, non modélisable), durée tour, cible choisie, forme Porteur, par-instance « Ces Dommages », redirection « à la place ». v48 : octroi de mot-clé au Porteur de SOI (op grantKeywordBearerSelf) — « Jusqu'à la fin du tour, le Porteur de <self> gagne A ou B » → chooseOne de deux grantKeywordBearerSelf (la source-équipement confère le mot-clé à SON Porteur, reverse-lookup via attachments ; no-op si non portée). +1 auto (Scarature Blanche : Agilité ou Tacle) → 413/1802 (22,9 %). Nouvelle mécanique « grant-keyword-bearer-self ». v47 : octroi de mot-clé au PORTEUR d'un Équipement choisi — « Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner <Kw> à son Porteur » → grantKeywordTarget{requiresAttachment:true,heroes:true} : on cible directement la créature ayant ≥1 attachement (choisir l'équipement ne sert qu'à désigner son Porteur ; équivalent fidèle). +4 auto (Emma Tenl/Tacle, Fauvéa/Agressivité, Klozette Wateur/Agilité, Terril Hachterr/Géant) → 412/1802 (22,9 %). v46 : sous-système CHOIX EXCLUSIF « A ou B » — op chooseOne (deux branches étiquetées, présentées via effectChoices/deux boutons ; la branche choisie s'exécute, le RESTE de la frame reprend après — « … ou … Piochez une carte »). DSL : « <Cible> de votre choix gagne <A> ou <B> jusqu'à la fin du tour » → chooseOne, chaque branche = grantKeywordTarget (Géant/Agilité/Agressivité/Tacle) ou buffForceTarget (« +N en Force ») sur la MÊME cible (heroes / sub:Famille ALLIED_FAMILIES). STRICT : compilé seulement si les DEUX tokens sont des octrois câblés (sinon manuel). +4 auto débloqués par batch4 (Baguette du Bandit Ensorceleur, Dofus-Arena Max, La-Haine, Temple Osamodas) → 408/1802 (22,6 %). Nouvelle mécanique « choose-one ». v45 : re-scrape batch4 — récupération verbatim de 14 descriptions à icônes droppées (mots-clés/Résistance perdus au scrape) via shortUrl wtcg-return.fr : Emma Tenl/Tacle, Fauvéa/Agressivité, Klozette Wateur/Agilité, Terril Hachterr/Géant, Scarature Blanche/Agilité-ou-Tacle (octroi au Porteur jusqu'à fin du tour) ; Baguette du Bandit Ensorceleur, Dofus-Arena Max, La-Haine, Temple Osamodas, Koalak Farouche (« X gagne <Kw> ou <Kw/+Force> jusqu'à la fin du tour ») ; Tynril (ruling Résistance 2 (air)/(feu)) ; Hache de Feuhekel/Géant+Résistance, Épée du Khebab/Tacle+Résistance, Marteau de Cokelocu/Agressivité+Résistance (consommateurs Ether). Données SEULEMENT (modèle béton) : restent uncovered (octroi de mot-clé turn-scoped à un Porteur/cible avec CHOIX « ou », et coût Ether, pas encore encodés). v44 : déclenché de MORT DE SOI (onSelfDestroyed, 804.7). DSL compileSelfDestroyedText « Quand/Lorsque <self> est détruit(e), [vous pouvez] BODY » → trigger onSelfDestroyed + ops (compileBody). Bus : RuleEvent {kind:"destroyed",instanceId,controller} émis à la DESTRUCTION RÉELLE (→ Défausse) sur 3 chemins câblés — dommages létaux (stateBasedDestroyEvents/checkVictory), destroyTarget interactif + destroyAll (resolveDestroyTarget) ; collectTriggeredEffects → destroyedFrames lit la carte détruite (controller/cardName) AVANT le dispatch (info encore lisible), enfile APRÈS la destruction. JAMAIS sur bannissement (→ Exil) ni recyclage (→ Pioche). « vous pouvez … » → effectChoices (confirmé), pas exécution d'office. +3 auto (Xav le Boulanger/healHeroTarget 1, Nerbe/heroGainPv 2, Daguette/optional destroyTarget Zone|Équipement). SKIP (manuel, jamais d'approximation) : qualificatif de destructeur « par un joueur adverse » (Skrouj, Écumouth), mort du Porteur (Amukwak…), veilles de mort d'autrui « un autre de vos Tofus / un de vos Alliés » (watcher), corps de paiement « payer pour » (Marlène, Champ Champ), corps actor-bound « il/elle inflige » (Tofu Mutant) et bodies non mappables (Otomaï recycle-all, Folle perte PM, Coffre/Mandrine). v43 : trois gains fidèles. (1) createToken étendu — countFromRecycled (« Mettez en jeu LE MÊME NOMBRE de jetons … » : nombre = compte recyclé lié à la frame, boundCount) + tapped (« … inclinés dans le Monde » : entrée inclinée) → Classe de Vampyro (costRecycle{max,Monstres,Défausse} + createToken countFromRecycled tapped). (2) banishFromZone — bannissement depuis une PILE (Défausse adverse, publique) : « Bannissez la carte [l'Équipement…] de votre choix de/dans la Défausse d'un adversaire » → pick interactif dans seats[opponent].defausse, carte choisie → Exil de son propriétaire (aucun XP) → Snouffle, Poubelles d'Astrub (+draw). +3 auto. SKIP (manuel, jamais d'approximation) : Task « qui vient de subir des Dommages / s'incliner » (Bwork Archer, Flèche Harcelante, Alie Zéle, Pièges Sournois/Répulsif) — counters.damage est TURN-scoped (purgé au début de tour, persiste entre combats) PAS combat-scoped, et les Dommages d'un Héros sont en PV (hp) pas en counters.damage → « recentlyDamaged » exclurait les Héros et serait une approximation ; « vient de s'incliner/se redresser » exige une RÉCENCE de réaction qu'orientation:tapped/upright ne capture pas. v42 : sous-système BANNISSEMENT (« Bannir » = retirer de la partie → Exil). Op banishTarget (jumelle de destroyTarget MAIS sans XP ni destruction : la cible va en Exil de son propriétaire ; un jeton banni cesse d'exister) + cost:banishSelf / banishSelfFromDiscard (la SOURCE part en Exil au lieu de s'incliner ; variante « depuis votre Défausse »). DSL : « Bannissez l'Allié [Famille] [de Niveau ≤ N] de votre choix [dans le Monde] » / « Bannissez le <Famille> de votre choix » → banishTarget ; « Bannissez <self> [depuis votre Défausse] : BODY » → cost banishSelf + body (compileBody). +3 auto (Geôles d'Astrub : banishSelf+banishTarget Allié ; Têtes à Clic et à Clac : banishSelf+banishTarget Démon ; Carte du Grav'Mar'Av' : banishSelf+searchDeck Zone+shuffle). SKIP (manuel) : Arbre de Vie (« Réduisez à 0 les Dommages … » — pas d'op bouclier mappable), Bibliothèque de Barbok (recherche multi-type « Équipement ou Zone »), bannissement de Défausse adverse (Snouffle/Poubelles), jeton-name-matching (Faux), count dynamique (Parchemin de Sagesse), triggered (Crail/Brumaire), name-search (Bague d'Ombrage), play-restriction (Pleur Nycheuz). v41 : moisson « harvest-final » — DSL : phrasing « Détruisez l'Allié, la Zone ou l'Équipement de votre choix » (destruction multi-type à TROIS compléments, jumeau de « Renvoyez X, Y ou Z … ») → +2 auto (Otomaï incarnam/dofus-collection, onArrive). CARD_SCRIPTS : 8 créatures-jetons « Mettez [self] en jeu comme un Monstre … de Force N [Élément] » (Action → onPlay createToken ; Élément récupéré verbatim du raw, perdu au scraping : Aiguille Chercheuse/Feu, Coffre/Eau, Épée/Air, Chaton/Air, Lapin/Feu, Bloqueuse/Terre, Balise/Feu, Dragonnet/Feu) + Goultard « apparaît incliné » (onArrive tapSelf). +11 effets couverts (auto 351→353, manual 33→42). SKIP (manuel — sous-systèmes non bâtis) : icônes droppées (« gagne ou/et . »), magnitudes dynamiques « égal à », Bannissez, fenêtres de réaction « sur le point / vient de », déclencheurs flottants « chaque fois », Chi-Fu-Mi/hasard, production de Ressource, formes Porteur dynamiques. v40 : JETONS de créature — op createToken (« Mettez en jeu un jeton "Monstre - X" de Force N [Élément] ») : minte une créature SYNTHÉTIQUE (carte de registre, mainType Allié + subType Monstre/Famille, Force/Élément imprimés) participant de combat à part entière ; quitte le jeu = cesse d'exister (event CREATE_TOKEN, reducer). DSL : Abraknyde (tap-power once-per-turn → onTap createToken) + Vampyro (« Recyclez un Monstre de votre choix : … » → costRecycleControlled + createToken). SKIP (manuel) : Classe de Vampyro (« le même nombre de jetons »), Métaria/Isletate/Faux/Nemoh. +3 auto (2 Abraknyde, 1 Vampyro). v39 : clause once-per-turn redondante d'un pouvoir à inclinaison DE SOI retirée avant compilation (l'inclinaison de la source EST le verrou « une fois par tour », et la table n'autorise l'activation que pendant votre tour → « N'utilisez ce pouvoir qu'une (seule) fois par tour [et uniquement pendant votre tour] » est redondante, fidèle à retirer). Strictement gated sur requiresIncline (et coût d'inclinaison/sacrifice de soi) ; AUCUN strip sur effet non-tap (aucun verrou → manuel) ni sur rider à condition réelle (« après un combat … », « uniquement si … dans le Monde »). +1 auto (Papi Tsubi/draw 2). v38 : aura de mot-clé compilée — keywordAura{keyword,sub?,heroes?,excludeSource?} (« Tant que <self> est dans le Monde, vos [autres] Alliés [Famille] [et Héros] gagnent <Géant|Agilité|Agressivité|Tacle> ») : miroir exact de forceAura mais octroyant un mot-clé de COMBAT câblé, lu par effectiveKeywords (légalité/résolution). +3 auto (Bash Skwal/Agilité, Gelée Royale Citron/Agilité, Boomba/Tacle). SKIP (manuel) : mots-clés inertes (Fantôme/Défense/Renfort), formes Porteur. v37 : sous-système costModifier — statiques de RÉDUCTION DE COÛT compilés (planCost les consulte) : selfCostMod{n,ifHeroClass} (les 12 Dopeuls « Si votre Héros est <Classe>, le coût du <self> est réduit de N ») + costAura{n,scope} (« Tant que <self> est dans le Monde, le coût de vos <Allié [Famille]|Actions|cartes Uniques> est réduit de N » — Araknotanker Grouilleux). Plancher 0, « vos … » seulement. SKIP (manuel) : augmentation de coût adverse, formes Porteur (Cape Cérémoniale), scopes non calculables (Capture/Invocations/Sorts même Classe), planchers « minimum 1 ». +13 auto. v36 : re-scrape batch3 — récupération verbatim des descriptions à icônes perdues (65 effets sur 9 extensions : coûts « réduit/augmenté de N », éléments de Dommages/Ressources/jetons, mots-clés Géant/Agilité/Tacle/Agressivité/Capture/Défense, alignements Bonta/Brâkmar, glyphe « joué » d'Échec critique). Données seulement ; 8 reclassés en ruling, le reste reste uncovered (nécessite de futurs ops : modif de coût, octroi statique de mot-clé, production de Ressource élémentaire). v35 : Tacle câblé (verrou d'inclinaison relationnel dans resolveCombat — les bloqueurs en relation de blocage avec un possesseur de Tacle ne s'inclinent pas en fin de combat) → grantKeyword{Self,Target}{Tacle} compilé (jeton TURN tacleTurnMod → effectiveKeywords.tacle) ; +2 grants couverts (Petit Anneau de Chance, Ocehan Zileveun) ; BEARER/COMBAT/composite Tacle + mots-clés encore inertes (Fantôme/Défense/Renfort) restent manuels
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 heures

const EXTENSION_FILES = [
  "amakna",
  "ankama-convention-5",
  "astrub",
  "bonta-brakmar",
  "chaos-dogrest",
  "dofus-collection",
  "ile-des-wabbits",
  "incarnam",
  "otomai",
  "pandala",
  "draft",
];

interface CacheData {
  timestamp: number;
  cards: Card[];
}

function isValidCache(cache: CacheData): boolean {
  try {
    const now = Date.now();
    return now - cache.timestamp < CACHE_EXPIRATION;
  } catch {
    return false;
  }
}

async function loadFromCache(): Promise<Card[] | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: CacheData = JSON.parse(cached);
    if (!isValidCache(cacheData)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cacheData.cards;
  } catch (error) {
    console.error("Erreur lors du chargement du cache:", error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

async function saveToCache(cards: Card[]) {
  try {
    const cacheData: CacheData = {
      timestamp: Date.now(),
      cards,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error("Erreur lors de la sauvegarde dans le cache:", error);
  }
}

function normalizeCardType(type: string): string {
  const t = (type || "").trim();
  switch (t) {
    case "Havre Sac":
    case "Havre-sac":
    case "Havre-Sac":
      return "Havre-Sac"; // unifier en 'Havre-Sac' (capital S) pour correspondre aux types définis
    case "héros":
    case "Heros":
      return "Héros";
    default:
      return t;
  }
}

function capitalizeElement(element: string): string {
  if (!element) return element;
  const lower = element.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Mots-clés canoniques du Wakfu TCG. Les données scrappées contiennent des
// fragments de phrases mal parsés ("Le", ",", ":", "**Résistance"…) qu'on
// filtre pour ne pas les afficher comme mots-clés.
const CANONICAL_KEYWORDS = new Set([
  "Résistance",
  "Recette",
  "Géant",
  "Fabriquer",
  "Inclinaison",
  "Portée",
  "Critique",
  "Parade",
  "Riposte",
  "Soin",
  "Tacle",
  "Esquive",
  "Initiative",
  "Invocation",
  "Unique",
  "Poison",
  "Brûlure",
  "Vol de vie",
]);

function normalizeKeywordName(name: unknown): string {
  return String(name ?? "")
    .replace(/^[^\p{L}]+/u, "") // retire les "*", ":", "," en tête
    .trim();
}

function normalizeCardElements(card: any): void {
  if (card.stats?.niveau?.element) {
    card.stats.niveau.element = capitalizeElement(card.stats.niveau.element);
  }
  if (card.stats?.force?.element) {
    card.stats.force.element = capitalizeElement(card.stats.force.element);
  }
  // Normalise la casse des éléments dans les effets et mots-clés.
  for (const eff of card.effects || []) {
    if (eff && Array.isArray(eff.elements)) {
      eff.elements = eff.elements.map(capitalizeElement);
    }
  }
  // Filtre + normalise les mots-clés (noms canoniques uniquement).
  if (Array.isArray(card.keywords)) {
    card.keywords = card.keywords
      .map((kw: any) => {
        if (!kw) return null;
        const name = normalizeKeywordName(kw.name);
        if (Array.isArray(kw.elements))
          kw.elements = kw.elements.map(capitalizeElement);
        return { ...kw, name };
      })
      .filter((kw: any) => kw && CANONICAL_KEYWORDS.has(kw.name));
  }
}

function fixSpecialCharacters(str: string): string {
  if (!str) return str;

  // Remplacer les caractères spéciaux mal encodés
  return str
    .replace(/Alli\?\?/g, "Allié")
    .replace(/H\?\?ros/g, "Héros")
    .replace(/\?\?quipement/g, "Équipement")
    .replace(/Sort[\s]?\?\?mentaire/g, "Sort Élémentaire")
    .replace(/r\?\?serve/g, "réserve")
    .replace(/\?\?l\?\?ment/g, "élément")
    .replace(/\?\?l\?\?mentaire/g, "élémentaire")
    .replace(/d\?\?g\?\?ts/g, "dégâts")
    .replace(/\?\?nergie/g, "énergie")
    .replace(/\?\?/g, "é"); // Dernier recours pour les 'é' non reconnus
}

async function loadExtensionCards(extension: string): Promise<Card[]> {
  try {
    const response = await fetch(`/data/${extension}.json`);
    if (!response.ok) {
      throw new Error(
        `Échec du chargement des cartes pour l'extension ${extension}: ${response.status} ${response.statusText}`,
      );
    }

    let cards;
    try {
      // On convertit d'abord en texte pour détecter les problèmes d'encodage
      const text = await response.text();

      // Si le texte ne contient aucune donnée valide
      if (!text || text.trim() === "" || text.trim() === "[]") {
        return [];
      }

      try {
        cards = JSON.parse(text);
      } catch (parseError) {
        throw parseError;
      }
    } catch (jsonError) {
      throw new Error(
        `Erreur de parsing JSON pour l'extension ${extension}: ${jsonError}`,
      );
    }

    if (!Array.isArray(cards)) {
      return [];
    }

    if (cards.length === 0) {
      return [];
    }

    // Validate and normalize each card
    const validCards = cards
      .filter((card: any) => {
        if (!card || typeof card !== "object") {
          return false;
        }
        // Vérification minimale
        if (!card.id || !card.name) {
          return false;
        }
        return true;
      })
      .map((card: any) => {
        // Normaliser la carte
        const normalizedCard = { ...card };

        // Corriger les caractères spéciaux dans des champs clés
        if (normalizedCard.name) {
          normalizedCard.name = fixSpecialCharacters(normalizedCard.name);
        }

        if (normalizedCard.mainType) {
          normalizedCard.mainType = fixSpecialCharacters(
            normalizedCard.mainType,
          );
          // Normaliser aussi le type principal
          normalizedCard.mainType = normalizeCardType(normalizedCard.mainType);
        }

        if (Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes =
            normalizedCard.subTypes.map(fixSpecialCharacters);
        }

        // Normalize element casing
        normalizeCardElements(normalizedCard);

        // Ensure required properties exist
        if (!normalizedCard.id) {
          normalizedCard.id = `unknown-${Math.random().toString(36).substring(2, 10)}`;
        }

        if (!normalizedCard.name) {
          normalizedCard.name = "Carte sans nom";
        }

        if (!normalizedCard.mainType) {
          normalizedCard.mainType = "Type inconnu";
        }

        if (!Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes = [];
        }

        if (!normalizedCard.rarity) {
          normalizedCard.rarity = "Commune";
        }

        // Ensure extension property is valid
        if (
          !normalizedCard.extension ||
          typeof normalizedCard.extension !== "object"
        ) {
          normalizedCard.extension = {
            name:
              extension.charAt(0).toUpperCase() +
              extension.slice(1).replace(/-/g, " "),
            id: extension,
          };
        } else if (!normalizedCard.extension.name) {
          normalizedCard.extension.name =
            extension.charAt(0).toUpperCase() +
            extension.slice(1).replace(/-/g, " ");
        }

        return normalizedCard;
      });

    return validCards;
  } catch (error) {
    console.error(
      `Erreur lors du chargement des cartes pour l'extension ${extension}:`,
      error,
    );
    return [];
  }
}

export async function loadAllCards(): Promise<Card[]> {
  try {
    // Vérifier si les cartes sont en cache
    const cachedCards = await loadFromCache();
    if (cachedCards) {
      return cachedCards;
    }

    // Charger les cartes de chaque extension en parallèle
    const results = await Promise.all(
      EXTENSION_FILES.map((extension) => loadExtensionCards(extension)),
    );
    const allCards: Card[] = [];
    for (const cards of results) {
      allCards.push(...cards);
    }

    // Mettre en cache pour les prochains chargements
    saveToCache(allCards);

    return allCards;
  } catch (error) {
    console.error("Erreur lors du chargement des cartes:", error);
    throw error;
  }
}

export async function loadCardById(
  extension: string,
  cardId: string,
): Promise<Card | null> {
  try {
    const cards = await loadExtensionCards(extension);
    return cards.find((card) => card.id === cardId) || null;
  } catch (error) {
    console.error(
      `Error loading card ${cardId} from extension ${extension}:`,
      error,
    );
    return null;
  }
}

// Fonction utilitaire pour tester le chargement d'un seul fichier JSON
export async function testJsonLoading(extension: string): Promise<any> {
  try {
    const filePath = `/data/${extension}.json`;

    const response = await fetch(filePath);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
      };
    }

    const text = await response.text();

    try {
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        return {
          success: true,
          items: data.length,
          sample: data.slice(0, 3),
        };
      } else {
        return {
          success: false,
          type: typeof data,
          data,
        };
      }
    } catch (parseError) {
      return {
        success: false,
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
        textSample: text.substring(0, 100),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
