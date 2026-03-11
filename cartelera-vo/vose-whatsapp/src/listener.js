/**
 * Message listener — handles incoming WhatsApp messages
 *
 * Routes:
 *   1. vose-XXXXX → onboarding (token linking)
 *   2. Any other message from linked user → VOCITO AI (Claude conversation)
 *   3. Any other message from unknown user → "Soy el asistente de VOSE..."
 */

import { handleOnboarding } from './handlers/onboarding.js'
import { handleFreeform } from './handlers/freeform.js'

// Match vose-TOKEN anywhere in the message (not just exact match)
// Supports both plain "vose-abc123" and branded "...Mi codigo: vose-abc123"
const TOKEN_REGEX = /vose-([a-zA-Z0-9]+)/i

// Rate limit: max 1 freeform message per 3s per user (prevents Claude API abuse)
const lastFreeformTime = new Map()
const FREEFORM_COOLDOWN = 3000

export function setupListener(sock) {
  // Remove previous listener to avoid duplicates on reconnect
  sock.ev.removeAllListeners('messages.upsert')

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

      try {
        // Route 1: Token linking
        const tokenMatch = text.trim().match(TOKEN_REGEX)
        if (tokenMatch) {
          await handleOnboarding(sock, jid, tokenMatch[1])
          continue
        }

        // Route 2: Freeform — Claude-powered conversational AI
        const lastTime = lastFreeformTime.get(jid) || 0
        if (Date.now() - lastTime < FREEFORM_COOLDOWN) continue
        lastFreeformTime.set(jid, Date.now())
        await handleFreeform(sock, jid, text)
      } catch (err) {
        console.error(`💥 Message handler error (${jid.split('@')[0]}):`, err.message || err)
      }
    }
  })

  console.log('👂 Listening for WhatsApp messages...')
}
