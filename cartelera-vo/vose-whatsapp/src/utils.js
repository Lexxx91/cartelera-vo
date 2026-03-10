/**
 * Shared utility functions for WhatsApp bot
 */

import { supabase } from './supabase.js'

/**
 * Get user profile data needed for notifications (JID, name, VOCITO prefs)
 */
export async function getJid(userId) {
  const { data } = await supabase
    .from('perfiles')
    .select('whatsapp_jid, nombre_display, vocito_activo, vocito_prefs')
    .eq('id', userId)
    .maybeSingle()
  return data
}

/**
 * Mapping from internal notification types to user-facing categories.
 *
 * Categories:
 *   planes    — Plan/match lifecycle (WA-1 to WA-8)
 *   amigos    — Friend requests & acceptances (WA-11, WA-12)
 *   pelis_vose — New VOSE movies (future)
 */
const NOTIFICATION_CATEGORY = {
  MATCH: 'planes',
  SESSION_ACCEPTED: 'planes',
  SESSION_REJECTED: 'planes',
  AVAILABILITY_SENT: 'planes',
  SESSION_PICKED: 'planes',
  NO_MATCH: 'planes',
  ROULETTE_RESULT: 'planes',
  PLAN_JOINED: 'planes',
  FRIEND_REQUEST: 'amigos',
  FRIEND_ACCEPTED: 'amigos',
  NEW_VOSE_MOVIE: 'pelis_vose',
}

/**
 * Check if a WhatsApp notification should be sent to a user.
 *
 * Gate logic:
 *   1. Must have whatsapp_jid (linked)
 *   2. Must have vocito_activo === true (service on)
 *   3. Category must not be explicitly disabled in vocito_prefs
 *
 * Backward-compatible:
 *   - vocito_prefs === null → all categories active (pre-migration users)
 *   - Unknown notification type → always send
 */
export function shouldNotify(userProfile, notificationType) {
  if (!userProfile?.whatsapp_jid) return false
  if (userProfile.vocito_activo !== true) return false

  const cat = NOTIFICATION_CATEGORY[notificationType]
  if (!cat) return true // unknown type → send

  const prefs = userProfile.vocito_prefs
  if (!prefs) return true // no prefs stored → all active

  return prefs[cat] !== false
}
