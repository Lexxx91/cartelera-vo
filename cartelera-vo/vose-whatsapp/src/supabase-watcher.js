/**
 * Supabase Realtime watcher
 *
 * Subscribes to postgres_changes on:
 *   - planes (INSERT, UPDATE)
 *   - amistades (INSERT, UPDATE)
 *
 * On each change, determines which notification to send
 * and dispatches it via the notifications module.
 */

import { supabase } from './supabase.js'
import { handlePlanChange } from './notifications.js'
import { handleFriendChange } from './handlers/friends.js'

let activeChannel = null

export function setupRealtimeWatcher(sock) {
  // Unsubscribe previous channel on reconnect to avoid duplicates
  if (activeChannel) {
    activeChannel.unsubscribe()
    supabase.removeChannel(activeChannel)
  }

  const channel = supabase.channel('vose-changes')
  activeChannel = channel

  // Watch plan changes
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'planes' },
    (payload) => {
      console.log(`📡 Plan ${payload.eventType}: ${payload.new?.id || payload.old?.id}`)
      handlePlanChange(sock, payload).catch(err =>
        console.error('Plan notification error:', err)
      )
    }
  )

  // Watch friend changes
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'amistades' },
    (payload) => {
      console.log(`📡 Amistad ${payload.eventType}: ${payload.new?.id || payload.old?.id}`)
      handleFriendChange(sock, payload).catch(err =>
        console.error('Friend notification error:', err)
      )
    }
  )

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('📡 Supabase Realtime subscribed (planes + amistades)')
    } else {
      console.log(`📡 Realtime status: ${status}`)
    }
  })
}
