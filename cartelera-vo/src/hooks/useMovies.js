import { useState, useEffect, useRef } from 'react'
import { fetchAllCinemasMovies, getDayDates, enrichMoviesWithTMDB } from '../utils.js'

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || ""

export default function useMovies() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        const days = getDayDates()

        // Load all 14 days in parallel
        const dayResults = await Promise.allSettled(
          days.map(d => fetchAllCinemasMovies(d.date))
        )

        // Dedup by title across all days
        const movieMap = {}
        dayResults.forEach((result, dayIndex) => {
          if (result.status !== 'fulfilled') return
          result.value.forEach(movie => {
            const key = movie.title.toLowerCase().trim()
            if (!movieMap[key]) {
              movieMap[key] = {
                ...movie,
                // Aggregate all sessions across days
                allSessions: [],
              }
            }
            // Merge poster/rating if missing
            if (!movieMap[key].poster && movie.poster) movieMap[key].poster = movie.poster
            if (!movieMap[key].rating && movie.rating) movieMap[key].rating = movie.rating
            if (!movieMap[key].duration && movie.duration) movieMap[key].duration = movie.duration

            // Collect sessions per day per cinema
            const day = days[dayIndex]
            for (const c of (movie.cinemas || [])) {
              for (const time of (c.showtimes || [])) {
                movieMap[key].allSessions.push({
                  day: day.label + " " + day.dateStr,
                  date: day.date.toISOString().split("T")[0],
                  cinema: c.cinema.name,
                  cinema_id: c.cinema.id,
                  time,
                })
              }
            }
          })
        })

        const deduped = Object.values(movieMap)
        setMovies(deduped)

        // Enrich with TMDB in background (non-blocking update)
        if (TMDB_KEY && deduped.length > 0) {
          enrichMoviesWithTMDB(deduped, TMDB_KEY).then(enriched => {
            setMovies(enriched)
          }).catch(() => {})
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return {
    movies,
    loading,
    error,
  }
}
