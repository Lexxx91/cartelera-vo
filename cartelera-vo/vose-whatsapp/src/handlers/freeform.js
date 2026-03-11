/**
 * Freeform handler — Claude-powered conversational AI for VOCITO
 *
 * Flow:
 *   1. Look up user by JID → get profile.id
 *   2. Detect intent from message text
 *   3. Build context based on intent
 *   4. Get conversation history
 *   5. Call Claude Sonnet 4 (max_tokens: 300)
 *   6. Save response to history
 *   7. Send via existing sendText()
 *   8. On error → personality-consistent fallback
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../supabase.js'
import { sendText } from '../messaging.js'
import { buildUserContext } from '../context.js'
import { addMessage, getHistory } from '../conversation-memory.js'

const anthropic = new Anthropic()

const VOCITO_SYSTEM_PROMPT = `Eres VOCITO, el asistente de WhatsApp de VOSE — la app de cine en versión original de Las Palmas de Gran Canaria.

PERSONALIDAD:
- Canario hasta la médula. Usas expresiones naturales: chacho, baifo, embullado, bochinche, millo, guagua, papas arrugás, pelete, magua, enyesque, ñios, leche y leche...
- Humor de colegas: cariñoso pero sin piedad. Como un amigo que te vacila pero te quiere.
- Brevedad de WhatsApp: mensajes CORTOS. 2-4 frases máximo. Nada de párrafos.
- Usa formato WhatsApp: *negrita* para destacar, emojis con moderación (1-3 por mensaje).

QUÉ HACES:
- Informas sobre la cartelera VO actual (pelis, horarios, cines)
- Cuentas el estado de los planes del usuario (match, confirmados, pendientes)
- Hablas de sus amigos y squad (quién más usa VOSE)
- Compartes sus stats de cine (pelis vistas, notas, ADN de cine)
- Recomiendas pelis de la cartelera basándote en sus gustos

QUÉ NO HACES (NUNCA):
- NO creas planes, votos, ni aceptas solicitudes. Solo informas.
- NO compartes datos privados de otros usuarios (emails, teléfonos, votos ajenos)
- NO hablas de temas fuera del cine y VOSE. Si te preguntan otra cosa, redirige con humor.
- NO inventas pelis ni horarios. Si no tienes datos, di que miren la app.

FORMATO:
- WhatsApp, no markdown de web. *negrita* sí, pero nada de headers ni bullet points largos.
- Si listas pelis, formato limpio: "🎬 *Título* — Cine, hora"
- Responde SIEMPRE en español canario. Nunca en inglés ni español neutro.

REGLA DE ORO: Eres un colega cinéfilo que sabe mucho de VOSE, no un asistente corporativo. Si no sabes algo, di "ñios, ni idea, mira en la app" en vez de inventar.`

const FALLBACK_MESSAGES = [
  'Ñios, bro, se me ha ido la olla un momento. Prueba otra vez. 😅',
  'Chacho, me he quedao en blanco como cuando las luces del cine se apagan. Inténtalo de nuevo. 🎬',
  'Leche, algo petó. Como la wifi del Monopol un viernes. Prueba en un rato. 😄',
]

/**
 * Handle a freeform message from a linked (or unlinked) user.
 */
export async function handleFreeform(sock, jid, text) {
  // 1. Look up user by JID
  const { data: profile } = await supabase
    .from('perfiles')
    .select('id, nombre_display')
    .eq('whatsapp_jid', jid)
    .maybeSingle()

  // Unknown user — can't do much
  if (!profile) {
    await sendText(sock, jid,
      'Soy el asistente de VOSE 🎬\n\n' +
      '¿Y qué hago, mi niño? Pues de momento nada, que no te conozco.\n\n' +
      'Entra en la app → "Conectar WhatsApp" en tu perfil, y hablamos.\n' +
      '👉 cartelera-vo.vercel.app'
    )
    return
  }

  // 2-3. Build context (includes intent detection)
  let context
  try {
    context = await buildUserContext(profile.id, text)
  } catch (err) {
    console.error('Context build error:', err)
    context = `USUARIO: ${profile.nombre_display}`
  }

  // 4. Get conversation history
  const history = getHistory(jid)

  // Save user message to history
  addMessage(jid, 'user', text)

  // 5. Call Claude with 12s timeout
  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `${VOCITO_SYSTEM_PROMPT}\n\n--- CONTEXTO DEL USUARIO ---\n${context}`,
        messages: [
          ...history,
          { role: 'user', content: text },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('VOCITO_TIMEOUT')), 12000)
      ),
    ])

    const reply = response.content?.[0]?.text
    if (!reply || typeof reply !== 'string') throw new Error('Invalid Claude response')

    // 6. Save assistant response to history
    addMessage(jid, 'assistant', reply)

    // 7. Send via WhatsApp
    await sendText(sock, jid, reply)

    console.log(`🤖 VOCITO → ${jid.split('@')[0]}: ${reply.slice(0, 60)}...`)
  } catch (err) {
    const isTimeout = err.message === 'VOCITO_TIMEOUT'
    console.error(`VOCITO ${isTimeout ? 'timeout' : 'error'}:`, err.message || err)

    // 8. Personality-consistent fallback
    const fallback = isTimeout
      ? 'Chacho, me he quedao pensando y se me fue el tiempo. Como cuando te pones a elegir peli y al final no ves nada. Prueba otra vez. ⏳'
      : FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)]
    await sendText(sock, jid, fallback)
  }
}
