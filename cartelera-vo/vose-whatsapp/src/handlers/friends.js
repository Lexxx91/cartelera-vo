/**
 * Friend notifications
 *
 * WA-11: FRIEND_REQUEST  — INSERT amistades (status=pending)
 * WA-12: FRIEND_ACCEPTED — UPDATE amistades (status → accepted)
 */

import { supabase } from '../supabase.js'
import { sendText } from '../messaging.js'

const APP_URL = 'https://cartelera-vo.vercel.app'

async function getJid(userId) {
  const { data } = await supabase
    .from('perfiles')
    .select('whatsapp_jid, nombre_display')
    .eq('id', userId)
    .maybeSingle()
  return data
}

export async function handleFriendChange(sock, payload) {
  const { eventType, new: row, old: oldRow } = payload

  // ─── WA-11: FRIEND_REQUEST ───
  if (eventType === 'INSERT' && row.status === 'pending') {
    const sender = await getJid(row.user_a)
    const receiver = await getJid(row.user_b)

    if (receiver?.whatsapp_jid) {
      const name = sender?.nombre_display || 'Alguien'
      await sendText(sock, receiver.whatsapp_jid,
        `${name} quiere agregarte en VOSE. 🎬\n\n` +
        `Abre la app para aceptar 👉 ${APP_URL}`
      )
    }
    return
  }

  // ─── WA-12: FRIEND_ACCEPTED ───
  if (eventType === 'UPDATE' && row.status === 'accepted' && oldRow?.status === 'pending') {
    // Notify user_a (the one who sent the request)
    const accepter = await getJid(row.user_b)
    const requester = await getJid(row.user_a)

    if (requester?.whatsapp_jid) {
      const name = accepter?.nombre_display || 'Tu amigo'
      await sendText(sock, requester.whatsapp_jid,
        `${name} acepto tu solicitud. 🤝\n\n` +
        `Ya podeis descubrir pelis en comun. 🎬`
      )
    }
    return
  }
}
