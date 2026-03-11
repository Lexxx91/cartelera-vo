import { useState, useCallback } from 'react'
import { supabase } from '../supabase.js'

const LOADING_PHRASES = [
  "Esto tarda menos que explicarle a un peninsular qué es una guagua",
  "Calculando nivel de pretencioso cinéfilo...",
  "Leyendo tu historial con cara de preocupación...",
  "Consultando con los aborígenes...",
  "Más rápido que Echedey respondiendo en el grupo",
]

/**
 * useVoseAI — Calls the generate-vose-ai Edge Function.
 * Types: 'dna' | 'memory' | 'recap'
 */
export function useVoseAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0])

  const generate = useCallback(async (type, userData) => {
    setLoading(true)
    setError(null)

    // Rotate loading phrases
    let phraseIdx = 0
    const phraseInterval = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % LOADING_PHRASES.length
      setLoadingPhrase(LOADING_PHRASES[phraseIdx])
    }, 2000)

    try {
      // AbortController for 15s timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const { data, error: fnError } = await supabase.functions.invoke('generate-vose-ai', {
        body: { type, user_data: userData },
        signal: controller.signal,
      })

      clearTimeout(timeout)
      if (fnError) throw fnError

      // Validate response shape
      if (!data || typeof data !== 'object') {
        throw new Error('Respuesta inválida del servidor')
      }

      return data
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Timeout: el servidor tardó demasiado'
        : err.message || 'Error generando contenido'
      console.error('useVoseAI error:', msg)
      setError(msg)
      return null
    } finally {
      clearInterval(phraseInterval)
      setLoading(false)
    }
  }, [])

  return { generate, loading, error, loadingPhrase }
}

export { LOADING_PHRASES }
