/**
 * VOSE WhatsApp Agent — Entry point
 *
 * Architecture:
 *   1. Connect to WhatsApp via Baileys (WebSocket → WhatsApp servers)
 *   2. Listen for incoming messages (onboarding tokens, freeform)
 *   3. Subscribe to Supabase Realtime (plan changes, friend requests)
 *   4. Send notifications when relevant DB changes are detected
 */

import { connectWhatsApp } from './connection.js'
import { setupListener } from './listener.js'
import { setupRealtimeWatcher } from './supabase-watcher.js'
import { supabase } from './supabase.js'

console.log('🎬 VOSE WhatsApp Agent starting...')

async function main() {
  // Connect to WhatsApp with onReady callback
  // This callback fires on EVERY (re)connection, ensuring
  // listeners are always attached to the active socket.
  await connectWhatsApp((sock) => {
    setupListener(sock)
    setupRealtimeWatcher(sock)
    console.log('✅ VOSE WhatsApp Agent ready')
  })
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
