export const RARITY_COLORS = {
  Légendaire: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400',
  Mythique: 'bg-gradient-to-r from-violet-400 via-purple-500 to-violet-400',
  Rare: 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400',
  'Peu Commune': 'bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400',
  Commune: 'bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300',
} as const

export const TYPE_COLORS = {
  Héros: 'badge-secondary',
  Allié: 'badge-primary',
  Sort: 'badge-accent',
  Équipement: 'badge-info',
  Zone: 'badge-warning',
  Salle: 'badge-neutral',
  Dofus: 'badge-error',
  Protecteur: 'badge-success',
  'Havre-Sac': 'badge-ghost',
  'Allié Élémentaire': 'badge-primary',
} as const

export const STAT_COLORS = {
  pa: 'text-warning',
  hp: 'text-error',
  mp: 'text-info',
  range: 'text-success',
} as const
