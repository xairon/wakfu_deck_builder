import { supabase, isSupabaseConfigured } from './supabase'
import type { Card } from '@/types/cards'
import type { CustomCardInput, CustomCardRecord } from '@/types/customCards'

const LOCAL_STORAGE_KEY = 'wakfu-custom-cards'

function getLocalCustomCards(): CustomCardRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error('[customCardService] Erreur lecture localStorage:', err)
    return []
  }
}

function saveLocalCustomCards(cards: CustomCardRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards))
  } catch (err) {
    console.error('[customCardService] Erreur écriture localStorage:', err)
  }
}

/**
 * Convertit un CustomCardInput en un objet Card canonique et complet.
 */
export function buildCanonicalCardFromInput(
  id: string,
  input: CustomCardInput,
  authorId: string
): Card {
  const element = input.element || 'Neutre'
  
  const stats: Record<string, unknown> = {}
  if (input.stats?.cost !== undefined) stats.cost = input.stats.cost
  if (input.stats?.hp !== undefined) stats.pv = input.stats.hp
  if (input.stats?.ap !== undefined) stats.pa = input.stats.ap
  if (input.stats?.mp !== undefined) stats.pm = input.stats.mp
  if (input.stats?.resistance !== undefined) stats.resistance = input.stats.resistance
  if (input.stats?.level !== undefined) {
    stats.niveau = { value: input.stats.level, element }
  }
  if (input.stats?.strength !== undefined) {
    stats.force = { value: input.stats.strength, element }
  }

  const baseCard: Record<string, unknown> = {
    id,
    name: input.name.trim(),
    mainType: input.mainType,
    subTypes: input.subTypes || [],
    extension: {
      id: 'custom',
      name: 'Cartes Personnalisées',
    },
    rarity: input.rarity || 'Commune',
    element,
    stats,
    effects: (input.effects || []).map((eff) => ({
      description: eff.description,
      cost: eff.cost,
      trigger: eff.trigger,
    })),
    keywords: [],
    artists: ['Création Joueur'],
    imageUrl: input.imageUrl?.trim() || undefined,
    url: input.imageUrl?.trim() || undefined,
    notes: input.rules ? [input.rules] : undefined,
    flavor: input.flavorText ? { text: input.flavorText } : undefined,
    // Métadonnées personnalisées
    isCustom: true,
    authorId,
    isPublic: input.isPublic ?? false,
  }

  // Spécificités par type si requis
  if (input.mainType === 'Héros') {
    baseCard.faces = {
      recto: {
        stats: { ...stats },
        effects: baseCard.effects,
        keywords: [],
        imageUrl: baseCard.imageUrl,
      },
      verso: {
        stats: { ...stats },
        effects: baseCard.effects,
        keywords: [],
        imageUrl: baseCard.imageUrl,
      },
    }
  }

  return baseCard as unknown as Card
}

/**
 * Crée une nouvelle carte personnalisée.
 */
export async function createCustomCard(
  input: CustomCardInput,
  userId: string
): Promise<CustomCardRecord> {
  const cardId = `custom_${crypto.randomUUID()}`
  const canonicalCard = buildCanonicalCardFromInput(cardId, input, userId)
  const now = new Date().toISOString()

  const record: CustomCardRecord = {
    id: cardId,
    user_id: userId,
    name: canonicalCard.name,
    main_type: canonicalCard.mainType,
    card_data: canonicalCard,
    image_url: canonicalCard.imageUrl || null,
    is_public: input.isPublic ?? false,
    created_at: now,
    updated_at: now,
  }

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('custom_cards')
      .insert({
        id: cardId.replace('custom_', ''), // Supabase table uses uuid primary key
        user_id: userId,
        name: record.name,
        main_type: record.main_type,
        card_data: record.card_data,
        image_url: record.image_url,
        is_public: record.is_public,
      })
      .select()
      .single()

    if (error) {
      console.warn('[customCardService] Supabase insert failed, fallback to local:', error.message)
      const local = getLocalCustomCards()
      local.unshift(record)
      saveLocalCustomCards(local)
      return record
    }

    const saved: CustomCardRecord = {
      id: `custom_${data.id}`,
      user_id: data.user_id,
      name: data.name,
      main_type: data.main_type,
      card_data: { ...data.card_data, id: `custom_${data.id}` },
      image_url: data.image_url,
      is_public: data.is_public,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
    // Mise en cache locale
    const local = getLocalCustomCards().filter((c) => c.id !== saved.id)
    local.unshift(saved)
    saveLocalCustomCards(local)
    return saved
  }

  // Mode local fallback
  const local = getLocalCustomCards()
  local.unshift(record)
  saveLocalCustomCards(local)
  return record
}

/**
 * Récupère les cartes personnalisées d'un utilisateur.
 */
export async function getCustomCardsByUser(userId: string): Promise<CustomCardRecord[]> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('custom_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      return data.map((d) => ({
        id: d.id.startsWith('custom_') ? d.id : `custom_${d.id}`,
        user_id: d.user_id,
        name: d.name,
        main_type: d.main_type,
        card_data: { ...d.card_data, id: d.id.startsWith('custom_') ? d.id : `custom_${d.id}` },
        image_url: d.image_url,
        is_public: d.is_public,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }))
    }
  }

  // Fallback local
  return getLocalCustomCards().filter((c) => c.user_id === userId)
}

/**
 * Recherche les cartes personnalisées publiques (avec filtre texte optionnel).
 */
export async function searchPublicCustomCards(query?: string): Promise<CustomCardRecord[]> {
  if (isSupabaseConfigured() && supabase) {
    let builder = supabase
      .from('custom_cards')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50)

    if (query && query.trim()) {
      builder = builder.ilike('name', `%${query.trim()}%`)
    }

    const { data, error } = await builder
    if (!error && data) {
      return data.map((d) => ({
        id: d.id.startsWith('custom_') ? d.id : `custom_${d.id}`,
        user_id: d.user_id,
        name: d.name,
        main_type: d.main_type,
        card_data: { ...d.card_data, id: d.id.startsWith('custom_') ? d.id : `custom_${d.id}` },
        image_url: d.image_url,
        is_public: d.is_public,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }))
    }
  }

  // Fallback local
  const cards = getLocalCustomCards().filter((c) => c.is_public)
  if (!query || !query.trim()) return cards
  const q = query.trim().toLowerCase()
  return cards.filter((c) => c.name.toLowerCase().includes(q))
}

/**
 * Met à jour une carte personnalisée existante.
 */
export async function updateCustomCard(
  cardId: string,
  input: CustomCardInput,
  userId: string
): Promise<CustomCardRecord | null> {
  const cleanUuid = cardId.replace('custom_', '')
  const canonicalCard = buildCanonicalCardFromInput(cardId, input, userId)
  const now = new Date().toISOString()

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('custom_cards')
      .update({
        name: canonicalCard.name,
        main_type: canonicalCard.mainType,
        card_data: canonicalCard,
        image_url: canonicalCard.imageUrl || null,
        is_public: input.isPublic ?? false,
        updated_at: now,
      })
      .eq('id', cleanUuid)
      .eq('user_id', userId)
      .select()
      .single()

    if (!error && data) {
      const updated: CustomCardRecord = {
        id: `custom_${data.id}`,
        user_id: data.user_id,
        name: data.name,
        main_type: data.main_type,
        card_data: { ...data.card_data, id: `custom_${data.id}` },
        image_url: data.image_url,
        is_public: data.is_public,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
      const local = getLocalCustomCards().map((c) => (c.id === updated.id ? updated : c))
      saveLocalCustomCards(local)
      return updated
    }
  }

  // Fallback local
  const local = getLocalCustomCards()
  const idx = local.findIndex((c) => c.id === cardId && c.user_id === userId)
  if (idx !== -1) {
    const updated: CustomCardRecord = {
      ...local[idx],
      name: canonicalCard.name,
      main_type: canonicalCard.mainType,
      card_data: canonicalCard,
      image_url: canonicalCard.imageUrl || null,
      is_public: input.isPublic ?? false,
      updated_at: now,
    }
    local[idx] = updated
    saveLocalCustomCards(local)
    return updated
  }

  return null
}

/**
 * Supprime une carte personnalisée.
 */
export async function deleteCustomCard(cardId: string, userId: string): Promise<boolean> {
  const cleanUuid = cardId.replace('custom_', '')

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from('custom_cards')
      .delete()
      .eq('id', cleanUuid)
      .eq('user_id', userId)

    if (error) {
      console.warn('[customCardService] Erreur suppression Supabase:', error.message)
    }
  }

  const local = getLocalCustomCards().filter((c) => !(c.id === cardId && c.user_id === userId))
  saveLocalCustomCards(local)
  return true
}
