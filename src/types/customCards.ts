import type { Card, CardMainType, CardRarity, CardElement } from './cards'

export interface CustomCardStats {
  cost?: number
  hp?: number
  ap?: number
  mp?: number
  range?: number | string
  strength?: number
  level?: number
  resistance?: number
}

export interface CustomCardInput {
  name: string
  mainType: CardMainType
  subTypes?: string[]
  rarity?: CardRarity
  element?: CardElement
  stats?: CustomCardStats
  effects?: Array<{
    description: string
    cost?: string
    trigger?: string
  }>
  rules?: string
  flavorText?: string
  imageUrl?: string
  isPublic?: boolean
}

export interface CustomCardRecord {
  id: string
  user_id: string
  name: string
  main_type: CardMainType
  card_data: Card
  image_url: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}
