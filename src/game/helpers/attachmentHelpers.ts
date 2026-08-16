/**
 * Helpers TypeScript pour la gestion d'attachement d'Équipements / Sorts sur des cartes Hôtes (Allié / Héros).
 * Ces fonctions manipulent l'état de jeu (GameState) pour attacher, détacher, déplacer et défausser
 * des cartes avec leurs équipements associés.
 */
import type { GameState } from "../types/state";

import type { ZoneRef } from "../types/zones";

/**
 * Attache un Équipement / Sort (`equipmentId`) sur une carte hôte Allié/Héros (`hostCardId`).
 */
export function attachCard(
  state: GameState,
  equipmentId: string,
  hostCardId: string,
): void {
  const equip = state.instances[equipmentId];
  const host = state.instances[hostCardId];
  if (!equip || !host) return;

  // 1. Retirer des équipements de tout autre hôte éventuel
  for (const inst of Object.values(state.instances)) {
    if (inst.attachments) {
      const idx = inst.attachments.indexOf(equipmentId);
      if (idx >= 0) {
        inst.attachments.splice(idx, 1);
      }
    }
  }

  // 2. Assigner l'emplacement de l'hôte
  equip.location = { ...host.location };

  // 3. Ajouter à la liste des attachements de l'hôte
  if (!host.attachments) {
    host.attachments = [];
  }
  if (!host.attachments.includes(equipmentId)) {
    host.attachments.push(equipmentId);
  }
}

/**
 * Détache un Équipement / Sort (`equipmentId`) de son hôte et le déplace vers la zone cible.
 */
export function detachCard(
  state: GameState,
  equipmentId: string,
  toZone: ZoneRef = { zone: "monde" },
): void {
  const equip = state.instances[equipmentId];
  if (!equip) return;

  // Retirer l'attachement sur la carte hôte
  for (const inst of Object.values(state.instances)) {
    if (inst.attachments) {
      const idx = inst.attachments.indexOf(equipmentId);
      if (idx >= 0) {
        inst.attachments.splice(idx, 1);
      }
    }
  }

  // Mettre à jour la localisation de l'équipement
  equip.location = { ...toZone };
}

/**
 * Déplace une carte hôte (`hostCardId`) vers une zone cible.
 * Tous ses Équipements attachés la suivent automatiquement à sa nouvelle position.
 */
export function moveHostCard(
  state: GameState,
  hostCardId: string,
  toZone: ZoneRef,
): void {
  const host = state.instances[hostCardId];
  if (!host) return;

  host.location = { ...toZone };

  // Tous les équipements attachés suivent l'hôte
  if (host.attachments) {
    for (const equipId of host.attachments) {
      const equip = state.instances[equipId];
      if (equip) {
        equip.location = { ...toZone };
      }
    }
  }
}

/**
 * Envoie une carte hôte (`hostCardId`) à la défausse.
 * Tous ses Équipements attachés sont automatiquement détachés et également envoyés à la défausse.
 */
export function discardCardWithEquipment(
  state: GameState,
  hostCardId: string,
): void {
  const host = state.instances[hostCardId];
  if (!host) return;

  const discardZone: ZoneRef = { zone: "defausse", owner: host.owner };

  // 1. Défausser tous les équipements attachés
  if (host.attachments && host.attachments.length > 0) {
    const attachedIds = [...host.attachments];
    host.attachments = [];

    for (const equipId of attachedIds) {
      const equip = state.instances[equipId];
      if (equip) {
        equip.counters = {};
        equip.orientation = null;
        equip.location = { ...discardZone };
      }
    }
  }

  // 2. Défausser la carte hôte elle-même
  host.counters = {};
  host.orientation = null;
  host.location = { ...discardZone };
}
