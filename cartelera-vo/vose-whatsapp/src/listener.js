/**
 * Message listener — handles incoming WhatsApp messages
 *
 * Routes:
 *   1. vose-XXXXX → onboarding (token linking)
 *   2. Any other message from linked user → freeform handler (Phase 4)
 *   3. Any other message from unknown user → "Soy el asistente de VOSE..."
 */

import { handleOnboarding } from './handlers/onboarding.js'
import { sendText } from './messaging.js'

const TOKEN_REGEX = /^vose-([a-zA-Z0-9]+)$/i

export function setupListener(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      // Ignore: own messages, status broadcasts, non-text
      if (msg.key.fromMe) continue
      if (msg.key.remoteJid === 'status@broadcast') continue

      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || ''

      if (!text.trim()) continue

      const jid = msg.key.remoteJid // e.g. "34612345678@s.whatsapp.net"

      console.log(`📥 ← ${jid.split('@')[0]}: ${text.slice(0, 60)}`)

      // Route 1: Token linking
      const tokenMatch = text.trim().match(TOKEN_REGEX)
      if (tokenMatch) {
        await handleOnboarding(sock, jid, tokenMatch[1])
        continue
      }

      // Route 2: Freeform (Phase 4 — for now, a simple response)
      // TODO: Replace with Claude conversational agent
      await handleFreeform(sock, jid, text)
    }
  })

  console.log('👂 Listening for WhatsApp messages...')
}

/**
 * Temporary freeform handler — will be replaced by Claude in Phase 4
 */
async function handleFreeform(sock, jid, text) {
  const { supabase } = await import('./supabase.js')

  // Check if this person is linked
  const { data: profile } = await supabase
    .from('perfiles')
    .select('id, nombre_display')
    .eq('whatsapp_jid', jid)
    .maybeSingle()

  if (!profile) {
    // Unknown user
    await sendText(sock, jid,
      'Soy el asistente de VOSE 🎬\n\n' +
      'Para activarme, entra en la app y dale a "Conectar WhatsApp" en tu perfil.\n\n' +
      '👉 cartelera-vo.vercel.app'
    )
    return
  }

  // Known user but no Claude yet — placeholder
  await sendText(sock, jid,
    `Eyyy ${profile.nombre_display}! Todavia estoy aprendiendo a conversar. ` +
    `De momento te aviso cuando tengas match o planes nuevos. 🎬🍿`
  )
}
