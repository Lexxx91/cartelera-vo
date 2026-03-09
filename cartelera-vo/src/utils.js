import { CINEMAS, SUPABASE_URL, SUPABASE_ANON } from './constants.js'

// Generate 14 days of dates from today
export function getDayDates() {
  const now = new Date()
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const labels = ["Hoy", "Mañana", "Pasado"]
    return {
      label: i < 3 ? labels[i] : d.toLocaleDateString("es-ES", { weekday: "short" }),
      date: d,
      dateStr: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    }
  })
}

// Fetch movies from Supabase cartelera table for a specific cinema and date
export async function fetchMoviesFromSupabase(cinema, date) {
  const dateStr = date.toISOString().split("T")[0]
  const url = `${SUPABASE_URL}/rest/v1/cartelera?cinema_id=eq.${cinema.id}&date=eq.${dateStr}&order=title.asc`
  const res = await fetch(url, {
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` }
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}`)
  const rows = await res.json()
  if (rows.length === 0) return []
  return rows.map(r => ({
    title: r.title,
    originalTitle: r.original_title || r.title,
    genre: r.genre || "",
    duration: r.duration ? parseInt(r.duration) : null,
    rating: r.rating_media ? String(r.rating_media) : null,
    synopsis: r.synopsis || "",
    showtimes: Array.isArray(r.showtimes) ? r.showtimes : [],
    language: r.version || "VOSE",
    director: r.director || "",
    year: r.year || null,
    poster: r.poster || null,
  }))
}

// Fetch and aggregate movies across all 3 cinemas for a date
export async function fetchAllCinemasMovies(date) {
  const results = await Promise.allSettled(
    CINEMAS.map(cinema => fetchMoviesFromSupabase(cinema, date))
  )
  const movieMap = {}
  results.forEach((result, ci) => {
    if (result.status !== 'fulfilled') return
    result.value.forEach(movie => {
      const key = movie.title.toLowerCase().trim()
      if (!movieMap[key]) {
        movieMap[key] = { ...movie, cinemas: [{ cinema: CINEMAS[ci], showtimes: movie.showtimes || [] }] }
      } else {
        movieMap[key].cinemas.push({ cinema: CINEMAS[ci], showtimes: movie.showtimes || [] })
        if (!movieMap[key].poster && movie.poster) movieMap[key].poster = movie.poster
        if (!movieMap[key].rating && movie.rating) movieMap[key].rating = movie.rating
      }
    })
  })
  return Object.values(movieMap).map(m => ({
    ...m,
    showtimes: [...new Set(m.cinemas.flatMap(c => c.showtimes))].sort(),
  }))
}

// Get ALL sessions for a movie across all cinemas in the next 14 days
export async function getAllSessionsForMovie(movieTitle) {
  const days = getDayDates()
  const sessions = []
  for (const day of days) {
    const movies = await fetchAllCinemasMovies(day.date)
    const movie = movies.find(m => m.title.toLowerCase().trim() === movieTitle.toLowerCase().trim())
    if (movie) {
      for (const c of (movie.cinemas || [])) {
        for (const time of (c.showtimes || [])) {
          sessions.push({
            day: day.label + " " + day.dateStr,
            date: day.date.toISOString().split("T")[0],
            cinema: c.cinema.name,
            cinema_id: c.cinema.id,
            time,
          })
        }
      }
    }
  }
  return sessions
}

// Find nearest session for a movie
export function findNearestSession(sessions) {
  if (!sessions || sessions.length === 0) return null
  // Sessions should already be sorted by date/time from getAllSessionsForMovie
  return sessions[0]
}

// Session key for comparison
export function sKey(s) {
  return `${s.date || s.day}||${s.cinema}||${s.time}`
}

// ─── TMDB enrichment ─────────────────────────────────────────────────────────

const tmdbCache = new Map()

// Helper: fetch from TMDB using Bearer token (v4 read access token)
function tmdbFetch(path, token) {
  return fetch(`https://api.themoviedb.org/3${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'accept': 'application/json',
    },
  })
}

export async function searchTMDB(originalTitle, apiKey) {
  if (!apiKey) return null
  const cacheKey = `search:${originalTitle}`
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)

  try {
    const res = await tmdbFetch(`/search/movie?query=${encodeURIComponent(originalTitle)}&language=es-ES`, apiKey)
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0] || null
    if (result) {
      // Fetch runtime from movie details endpoint
      let runtime = null
      try {
        const detailRes = await tmdbFetch(`/movie/${result.id}?language=es-ES`, apiKey)
        if (detailRes.ok) {
          const detail = await detailRes.json()
          runtime = detail.runtime || null
        }
      } catch { /* ignorar */ }

      const enriched = {
        tmdbId: result.id,
        overview: result.overview || "",
        tmdbRating: result.vote_average ? (result.vote_average / 2).toFixed(1) : null, // scale 0-5
        runtime,
        originalLanguage: result.original_language || null, // para buscar trailer VO
      }
      tmdbCache.set(cacheKey, enriched)
      return enriched
    }
    tmdbCache.set(cacheKey, null)
    return null
  } catch {
    return null
  }
}

export async function getTMDBTrailer(tmdbId, apiKey, originalLanguage) {
  if (!apiKey || !tmdbId) return null
  const cacheKey = `trailer:${tmdbId}`
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)

  try {
    // Build language priority: original language first (VO), then English, skip Spanish dubs
    const langCodes = []
    if (originalLanguage && originalLanguage !== 'es') {
      // Map ISO 639-1 to TMDB locale (e.g. "en" → "en-US", "fr" → "fr-FR")
      const localeMap = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN' }
      langCodes.push(localeMap[originalLanguage] || `${originalLanguage}-${originalLanguage.toUpperCase()}`)
    }
    if (!langCodes.includes('en-US')) langCodes.push('en-US')

    let trailer = null

    // Try each language in priority order
    for (const lang of langCodes) {
      const res = await tmdbFetch(`/movie/${tmdbId}/videos?language=${lang}`, apiKey)
      const data = await res.json()
      trailer = data.results?.find(v => v.type === "Trailer" && v.site === "YouTube")
      if (trailer) break
    }

    // Last resort: Spanish (dubbed) — better than nothing
    if (!trailer) {
      const res = await tmdbFetch(`/movie/${tmdbId}/videos?language=es-ES`, apiKey)
      const data = await res.json()
      trailer = data.results?.find(v => v.type === "Trailer" && v.site === "YouTube")
    }

    const result = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null
    tmdbCache.set(cacheKey, result)
    return result
  } catch {
    return null
  }
}

export async function enrichMoviesWithTMDB(movies, apiKey) {
  if (!apiKey) return movies

  const enriched = await Promise.all(
    movies.map(async (movie) => {
      const searchTitle = movie.originalTitle || movie.title
      const tmdbData = await searchTMDB(searchTitle, apiKey)
      if (!tmdbData) return movie

      const trailerUrl = await getTMDBTrailer(tmdbData.tmdbId, apiKey, tmdbData.originalLanguage)
      return {
        ...movie,
        synopsis: tmdbData.overview || movie.synopsis,
        tmdbRating: tmdbData.tmdbRating,
        trailerUrl: trailerUrl,
        // Duración: TMDB > scraper, con validación de rango [30, 300] min
        duration: (tmdbData.runtime >= 30 && tmdbData.runtime <= 300)
          ? tmdbData.runtime
          : (movie.duration >= 30 && movie.duration <= 300)
            ? movie.duration
            : null,
      }
    })
  )
  return enriched
}
