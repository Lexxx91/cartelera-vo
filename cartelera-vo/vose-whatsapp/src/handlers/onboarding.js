/**
 * Onboarding handler — WhatsApp → VOSE profile linking
 *
 * Flow:
 *   1. User taps "Conectar WhatsApp" in VOSE app
 *   2. App generates token → stores in whatsapp_link_tokens → opens wa.me/BOT?text=vose-TOKEN
 *   3. User taps Send in WhatsApp
 *   4. This handler receives the message, validates token, links JID to profile
 *   5. App polls perfiles.whatsapp_jid → detects link → shows success
 *
 * Edge cases:
 *   - Token expired/invalid → "Ese codigo ha caducado..."
 *   - Already linked → "Ya estamos conectados..."
 *   - JID used by another user → unlink previous, link new
 */

import { supabase } from '../supabase.js'
import { sendText } from '../messaging.js'

export async function handleOnboarding(sock, jid, token) {
  // 1. Check if this JID is already linked to someone
  const { data: existingProfile } = await supabase
    .from('perfiles')
    .select('id, nombre_display')
    .eq('whatsapp_jid', jid)
    .maybeSingle()

  // 2. Look up the token
  const { data: tokenRow } = await supabase
    .from('whatsapp_link_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle()

  // Invalid or already used token
  if (!tokenRow) {
    await sendText(sock, jid,
      'Ese codigo no es valido o ya ha caducado. 🤷\n' +
      'Genera uno nuevo desde tu perfil en VOSE.\n\n' +
      '👉 cartelera-vo.vercel.app'
    )
    return
  }

  // Token expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    // Mark as used so it can't be retried
    await supabase.from('whatsapp_link_tokens').update({ used: true }).eq('token', token)

    await sendText(sock, jid,
      'Ese codigo ha caducado (10 min). ⏰\n' +
      'Genera uno nuevo desde tu perfil en VOSE.'
    )
    return
  }

  // 3. Check if the user who generated the token already has WhatsApp linked
  if (existingProfile && existingProfile.id === tokenRow.user_id) {
    // Same user re-linking — just confirm
    await supabase.from('whatsapp_link_tokens').update({ used: true }).eq('token', token)

    await sendText(sock, jid,
      `Ya estamos conectados, ${existingProfile.nombre_display}! 😄\n` +
      'Te avisare cuando tengas matches o planes nuevos. 🎬'
    )
    return
  }

  // 4. If JID is used by a DIFFERENT user → unlink previous
  if (existingProfile && existingProfile.id !== tokenRow.user_id) {
    await supabase.from('perfiles').update({
      whatsapp_jid: null,
      whatsapp_linked_at: null,
    }).eq('id', existingProfile.id)

    console.log(`🔄 Unlinked JID ${jid} from user ${existingProfile.id} (was ${existingProfile.nombre_display})`)
  }

  // 5. Link the JID to the new user's profile
  const { error } = await supabase.from('perfiles').update({
    whatsapp_jid: jid,
    whatsapp_linked_at: new Date().toISOString(),
  }).eq('id', tokenRow.user_id)

  if (error) {
    console.error('❌ Link error:', error)
    await sendText(sock, jid,
      'Ups, algo fallo al vincular. Intenta de nuevo desde la app. 😅'
    )
    return
  }

  // 6. Mark token as used
  await supabase.from('whatsapp_link_tokens').update({ used: true }).eq('token', token)

  // 7. Get the user's name for the welcome message
  const { data: newProfile } = await supabase
    .from('perfiles')
    .select('nombre_display')
    .eq('id', tokenRow.user_id)
    .maybeSingle()

  const name = newProfile?.nombre_display || 'cinefilo'

  console.log(`✅ Linked ${jid} → ${name} (${tokenRow.user_id})`)

  // 8. Welcome message!
  await sendText(sock, jid,
    `Eyyy ${name}! 🎬\n\n` +
    'Aqui tu asistente de cine en VOSE.\n' +
    'Cuando tengas match, te aviso por aqui.\n\n' +
    'Ahora ve y desliza, anda. 🍿'
  )
}
