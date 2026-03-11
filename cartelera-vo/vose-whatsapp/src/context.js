/**
 * User context builder for VOCITO AI conversations.
 *
 * Gathers user data from Supabase to inject into Claude's system prompt.
 * Uses intent detection to load only relevant context (saves tokens + latency).
 *
 * Privacy: Only names are shared. No emails, phones, JIDs, or other users' private data.
 */

import { supabase } from './supabase.js'

// ─── Cartelera cache (1 hour TTL) ───
let carteleraCache = null
let carteleraCacheTime = 0
const CARTELERA_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Detect user intent from message text to load only relevant context.
 * Returns Set of context categories to load.
 */
export function detectIntent(text, friendNames = []) {
  const t = text.toLowerCase()
  const intents = new Set()

  // Cartelera / movies / showtimes
  if (/peli|cine|cartelera|horario|sesi[oó]n|estreno|vo\b|versi[oó]n original|qu[eé] hay|qu[eé] ponen/.test(t)) {
    intents.add('cartelera')
  }

  // Plans
  if (/plan|quedar|cuando|cita|confirmad|match|propuest/.test(t)) {
    intents.add('plans')
  }

  // Social / friends / squad
  if (/amig|squad|colega|ranking|compatib/.test(t)) {
    intents.add('social')
  }

  // Check if any friend name is mentioned
  for (const name of friendNames) {
    if (name && t.includes(name.toLowerCase())) {
      intents.add('social')
      intents.add('plans')
      break
    }
  }

  // Stats / profile
  if (/estad[ií]stica|stat|cu[aá]nt|historial|rating|nota|valoraci/.test(t)) {
    intents.add('stats')
  }

  // If no specific intent detected, load everything
  if (intents.size === 0) {
    intents.add('cartelera')
    intents.add('plans')
    intents.add('social')
    intents.add('stats')
  }

  return intents
}

const CINEMA_NAMES = {
  ocine: 'OCine 7 Palmas',
  arenas: 'Yelmo Arenas',
  alisios: 'Yelmo Alisios',
}

/**
 * Fetch current cartelera (VO movies with sessions).
 * Cached for 1 hour since movies don't change per-message.
 */
async function fetchCartelera() {
  if (carteleraCache && Date.now() - carteleraCacheTime < CARTELERA_TTL) {
    return carteleraCache
  }

  const today = new Date().toISOString().split('T')[0]
  const { data: rows } = await supabase
    .from('cartelera')
    .select('title, genre, duration, cinema_id, showtimes, date')
    .gte('date', today)
    .order('title', { ascending: true })
    .limit(100)

  if (!rows || rows.length === 0) {
    carteleraCache = []
    carteleraCacheTime = Date.now()
    return []
  }

  // Group by movie → cinema → times (showtimes is a JSON array per row)
  const movieMap = new Map()
  for (const row of rows) {
    if (!movieMap.has(row.title)) {
      movieMap.set(row.title, { title: row.title, genre: row.genre, duration: row.duration, byCinema: {} })
    }
    const m = movieMap.get(row.title)
    const cinema = CINEMA_NAMES[row.cinema_id] || row.cinema_id || 'Sin cine'
    if (!m.byCinema[cinema]) m.byCinema[cinema] = new Set()
    const times = Array.isArray(row.showtimes) ? row.showtimes : []
    for (const t of times) m.byCinema[cinema].add(t)
  }

  const summarized = Array.from(movieMap.values()).map(m => ({
    title: m.title,
    genre: m.genre,
    duration: m.duration,
    sessions: Object.entries(m.byCinema).map(([cinema, times]) => {
      const sorted = Array.from(times).sort()
      return `${cinema}: ${sorted.slice(0, 5).join(', ')}${sorted.length > 5 ? ` (+${sorted.length - 5} más)` : ''}`
    }),
  }))

  carteleraCache = summarized
  carteleraCacheTime = Date.now()
  return summarized
}

/**
 * Build the full user context string for Claude's system prompt.
 */
export async function buildUserContext(userId, messageText) {
  // 1. Always fetch profile + friendships (needed for intent detection)
  const [profileRes, friendshipsRes] = await Promise.all([
    supabase
      .from('perfiles')
      .select('nombre_display, watched, cinema_dna, vocito_prefs')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('amistades')
      .select('user_a, user_b')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'accepted'),
  ])

  const profile = profileRes.data
  const friendIds = (friendshipsRes.data || []).map(f =>
    f.user_a === userId ? f.user_b : f.user_a
  )

  // Fetch friend names (privacy: names only)
  let friends = []
  if (friendIds.length > 0) {
    const { data: friendProfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_display')
      .in('id', friendIds)
    friends = (friendProfiles || []).map(f => ({
      id: f.id,
      name: f.nombre_display || 'Desconocido',
    }))
  }

  const friendNames = friends.map(f => f.name)
  const intents = detectIntent(messageText, friendNames)

  // 2. Build context sections based on intent
  const sections = []

  sections.push(`USUARIO: ${profile?.nombre_display || 'Desconocido'}`)

  // Cartelera
  if (intents.has('cartelera')) {
    const cartelera = await fetchCartelera()
    if (cartelera.length > 0) {
      sections.push(
        'CARTELERA VO ACTUAL:',
        ...cartelera.map(m =>
          `• ${m.title} (${m.genre || '?'}, ${m.duration || '?'}min)\n  ${m.sessions.join('\n  ')}`
        )
      )
    } else {
      sections.push('CARTELERA: No hay películas VO activas ahora mismo.')
    }
  }

  // Plans
  if (intents.has('plans')) {
    const { data: plans } = await supabase
      .from('planes')
      .select('movie_title, state, chosen_session, participants')
      .or(`initiator_id.eq.${userId},partner_id.eq.${userId}`)
      .in('state', ['proposed', 'waiting_them', 'pick_avail', 'pick_theirs', 'confirmed'])

    if (plans?.length > 0) {
      sections.push(
        'PLANES ACTIVOS:',
        ...plans.map(p => {
          const participantNames = (p.participants || [])
            .map(pid => friends.find(f => f.id === pid)?.name || '?')
          const session = p.chosen_session
            ? `${p.chosen_session.date || '?'} ${p.chosen_session.time || ''} ${p.chosen_session.cinema || ''}`.trim()
            : 'por confirmar'
          return `• ${p.movie_title} [${p.state}] — ${session}${participantNames.length ? ` con ${participantNames.join(', ')}` : ''}`
        })
      )
    } else {
      sections.push('PLANES: Ninguno activo.')
    }
  }

  // Social
  if (intents.has('social')) {
    if (friends.length > 0) {
      sections.push(`AMIGOS (${friends.length}): ${friendNames.join(', ')}`)
    } else {
      sections.push('AMIGOS: Ninguno todavía.')
    }
  }

  // Stats / profile
  if (intents.has('stats')) {
    const watched = profile?.watched || []
    const rated = watched.filter(w => w.rating)

    // Votes
    const { data: votes } = await supabase
      .from('votos')
      .select('movie_title, vote')
      .eq('user_id', userId)

    const voy = (votes || []).filter(v => v.vote === 'voy').length
    const paso = (votes || []).filter(v => v.vote === 'paso').length

    sections.push(
      `STATS: ${voy} voy, ${paso} paso, ${watched.length} vistas, ${rated.length} valoradas`
    )

    if (rated.length > 0) {
      const avg = (rated.reduce((s, w) => s + w.rating, 0) / rated.length).toFixed(1)
      const best = rated.sort((a, b) => b.rating - a.rating)[0]
      sections.push(`Nota media: ${avg}/10. Mejor: ${best.title} (${best.rating}/10)`)
    }

    // Cinema DNA if available
    if (profile?.cinema_dna) {
      sections.push(`ADN DE CINE: ${profile.cinema_dna.archetype_name} ${profile.cinema_dna.archetype_emoji}`)
    }
  }

  return sections.join('\n')
}
