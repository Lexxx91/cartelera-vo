/**
 * Friend notifications
 *
 * WA-11: FRIEND_REQUEST  — INSERT amistades (status=pending)
 * WA-12: FRIEND_ACCEPTED — UPDATE amistades (status → accepted)
 */

import { sendText } from '../messaging.js'
import { getJid, shouldNotify } from '../utils.js'

const APP_URL = 'https://cartelera-vo.vercel.app'

export async function handleFriendChange(sock, payload) {
  const { eventType, new: row, old: oldRow } = payload

  // ─── WA-11: FRIEND_REQUEST ───
  if (eventType === 'INSERT' && row.status === 'pending') {
    const sender = await getJid(row.user_a)
    const receiver = await getJid(row.user_b)

    if (shouldNotify(receiver, 'FRIEND_REQUEST')) {
      const name = sender?.nombre_display || 'Alguien'
      await sendText(sock, receiver.whatsapp_jid,
        `${name} quiere ser tu bro en VOSE. 🎬\n\n` +
        `Más matches, más cine, menos grupos muertos.\n` +
        `Acepta en la app 👉 ${APP_URL}`
      )
    }
    return
  }

  // ─── WA-12: FRIEND_ACCEPTED ───
  if (eventType === 'UPDATE' && row.status === 'accepted' && oldRow?.status === 'pending') {
    // Notify user_a (the one who sent the request)
    const accepter = await getJid(row.user_b)
    const requester = await getJid(row.user_a)

    if (shouldNotify(requester, 'FRIEND_ACCEPTED')) {
      const name = accepter?.nombre_display || 'Tu amigo'
      await sendText(sock, requester.whatsapp_jid,
        `${name} aceptó. 🤝\n\n` +
        `Ya podéis descubrir pelis en común. Networking nivel Ayaki doblando a Kevin Costner. 🎬`
      )
    }
    return
  }
}
