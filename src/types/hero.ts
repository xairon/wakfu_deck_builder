import type { Card } from './cards'

interface HeroStats {
  niveau?: {
    value: number
    element: string
  }
  force?: {
    value: number
    element: string
  }
  pa?: number
  pm?: number
  pv?: number
}

interface HeroEffect {
  description: string
  elements?: string[]
  isOncePerTurn?: boolean
  requiresIncline?: boolean
}

interface HeroKeyword {
  name: string
  description: string
  elements?: string[]
}

interface HeroSide {
  stats: HeroStats
  effects: HeroEffect[]
  keywords: HeroKeyword[]
}

export interface HeroCard extends Card {
  class: string
  verso: HeroSide
  recto: HeroSide
} 