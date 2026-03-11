/**
 * Friend notifications
 *
 * WA-11:  FRIEND_REQUEST      — INSERT amistades (status=pending)
 * WA-12:  FRIEND_ACCEPTED     — UPDATE amistades (status → accepted)
 * WA-12b: AUTO_FRIEND         — INSERT amistades (status=accepted) — invite link auto-friendship
 */

import { sendText } from '../messaging.js'
import { getJid, shouldNotify } from '../utils.js'

const APP_URL = 'https://cartelera-vo.vercel.app'

export async function handleFriendChange(sock, payload) {
  const { eventType, new: row, old: oldRow } = payload

  // ─── WA-11: FRIEND_REQUEST (manual request, pending) ───
  if (eventType === 'INSERT' && row.status === 'pending') {
    const sender = await getJid(row.user_a)
    const receiver = await getJid(row.user_b)
    if (!receiver) return

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

  // ─── WA-12b: AUTO_FRIEND (invite link — INSERT with status=accepted) ───
  if (eventType === 'INSERT' && row.status === 'accepted') {
    const userA = await getJid(row.user_a)
    const userB = await getJid(row.user_b)
    const newUserName = userA?.nombre_display || 'Alguien'

    // Notify the inviter (user_b) that the new user joined via their link
    if (userB && shouldNotify(userB, 'FRIEND_ACCEPTED')) {
      await sendText(sock, userB.whatsapp_jid,
        `${newUserName} ha entrado en VOSE con tu enlace. Ya sois amigos. 🤝\n\n` +
        `Abre la app y descubrid qué pelis tenéis en común 👉 ${APP_URL}`
      )
    }
    return
  }

  // ─── WA-12: FRIEND_ACCEPTED (manual accept, pending → accepted) ───
  if (eventType === 'UPDATE' && row.status === 'accepted' && oldRow?.status === 'pending') {
    const accepter = await getJid(row.user_b)
    const requester = await getJid(row.user_a)
    if (!requester) return

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
