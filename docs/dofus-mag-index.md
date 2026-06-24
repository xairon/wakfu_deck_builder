# Dofus Mag — Index photos → decks

Manifeste de réconciliation pour l'extraction des decks WAKFU TCG du magazine
Dofus Mag. Source : `dofus_mag_decks/` (73 photos, hors git) ; copies redressées
180° dans `dofus_mag_decks_rotated/` (générées par `npx tsx scripts/rotateDofusMagPhotos.ts`).

> **Invariant** : chaque deck = 48 cartes (hors héros + havre-sac) = 50 au total.
> Double checksum : total imprimé par catégorie **et** somme globale = 48.

## Decks extraits (pilote)

| Deck                | Héros           | Havre-Sac  | Photo(s) source                                     | Checksum          | Non résolus                    |
| ------------------- | --------------- | ---------- | --------------------------------------------------- | ----------------- | ------------------------------ |
| Deck Gelées Royales | Trantmy Londami | du Tofu    | `20260624_191247.jpg`                               | 32+5+4+6+1 = 48 ✓ | Piou de Baradaize, Gelée Verte |
| Deck Ecaflip        | Karey Dass      | du Tofu    | `20260624_184503.jpg` (page 124, haut)              | 25+6+9+5+3 = 48 ✓ | —                              |
| Deck Sadida         | Klore Ofil      | du Bouftou | `20260624_184503.jpg` (bas) + `20260624_184508.jpg` | 25+6+9+5+3 = 48 ✓ | —                              |

## À faire (run complet — Task 6)

- [ ] Indexer les ~70 photos restantes → mapping complet photo → deck.
- [ ] **Identifier les 2 photos de RÈGLES MULTI** et les marquer `EXCLU (règles)`.
- [ ] Lister les decks restants avec leurs photos couvrantes pour le workflow.

## Photos exclues (règles, non-decks)

| Photo            | Raison                     |
| ---------------- | -------------------------- |
| _(à identifier)_ | Règles du mode multijoueur |
| _(à identifier)_ | Règles du mode multijoueur |
