import { describe, it, expect } from 'vitest'
import { buildCanonicalCardFromInput } from '../customCardService'
import type { CustomCardInput } from '@/types/customCards'

describe('customCardService', () => {
  it("assigne l'XP uniquement pour les cartes de type Allié", () => {
    const allyInput: CustomCardInput = {
      name: 'Guerrier Iop',
      mainType: 'Allié',
      stats: {
        level: 3,
        xp: 2,
        hp: 6,
        strength: 3,
      },
    }

    const allyCard = buildCanonicalCardFromInput('custom_1', allyInput, 'user_1')
    expect(allyCard.experience).toBe(2)
    expect((allyCard.stats as any)?.cost).toBeUndefined()
  })

  it("n'assigne pas d'XP pour les cartes qui ne sont pas de type Allié", () => {
    const actionInput: CustomCardInput = {
      name: 'Flèche Explosive',
      mainType: 'Action',
      stats: {
        level: 2,
        xp: 2, // Ne doit pas être conservé car pas un Allié
      },
    }

    const actionCard = buildCanonicalCardFromInput('custom_2', actionInput, 'user_1')
    expect(actionCard.experience).toBeUndefined()
  })

  it('gère correctement les Alliés Élémentaires avec leur XP', () => {
    const elemAllyInput: CustomCardInput = {
      name: 'Prespic des Forêts',
      mainType: 'Allié Élémentaire',
      element: 'Terre',
      stats: {
        level: 1,
        xp: 1,
      },
    }

    const elemAllyCard = buildCanonicalCardFromInput('custom_3', elemAllyInput, 'user_1')
    expect(elemAllyCard.experience).toBe(1)
  })
})
