import { z } from "zod";

export const mechanicTagSchema = z.enum([
  "gain-xp",
  "draw",
  "hero-gain-pv",
  "hero-lose-pv",
  "damage-opp-hero",
  "bag-gain-resistance",
  "destroy-target",
  "damage-target",
  "damage-target-by-force",
  "each-player-draws",
  "heal-hero-target",
  "buff-force-target",
  "buff-force-self",
  "recycle-from-discard",
  "discard-from-hand",
  "search-deck",
  "put-in-play",
  "shuffle-deck",
  "destroy-self",
  "lose-stat-turn",
  "opp-lose-stat-turn",
  "buff-force-hero-self",
  "untap-hero-self",
  "tap-self",
  "untap-self",
  "combat-mod-self",
  "buff-force-allies-monde",
  "global-damage-shield",
  "tap-target",
  "untap-target",
  "return-to-hand",
  "cost-tap-controlled",
  "cost-destroy-controlled",
  "cost-recycle",
]);

export const mechanicCategorySchema = z.enum([
  "ressource",
  "dégâts",
  "soin",
  "contrôle",
  "tempo",
  "autre",
]);

export const mechanicRelationSchema = z.object({
  tag: mechanicTagSchema,
  kind: z.enum(["feeds", "counters", "synergizes"]),
  note: z.string().optional(),
});

export const mechanicSchema = z.object({
  id: mechanicTagSchema,
  label: z.string(),
  glossary: z.string(),
  category: mechanicCategorySchema,
  relatesTo: z.array(mechanicRelationSchema).optional(),
});
