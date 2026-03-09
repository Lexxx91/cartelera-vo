/**
 * Plan notifications — Watches plan state transitions and sends WhatsApp messages
 *
 * Each notification has:
 *   - Trigger: what DB change fires it
 *   - Recipients: who gets the message
 *   - Message: the text with VOSE tone
 *
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  WA-1  MATCH              INSERT planes (state=proposed)     ║
 * ║  WA-2  SESSION_ACCEPTED   Both response=yes, confirmed       ║
 * ║  WA-3  SESSION_REJECTED   One says no                        ║
 * ║  WA-4  AVAILABILITY_SENT  Availability array updated         ║
 * ║  WA-5  SESSION_PICKED     chosen_session set, confirmed      ║
 * ║  WA-6  NO_MATCH           state → no_match                   ║
 * ║  WA-7  ROULETTE_RESULT    payer_name set                     ║
 * ║  WA-8  PLAN_JOINED        participants[] grows               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { supabase } from './supabase.js'
import { sendText } from './messaging.js'

const APP_URL = 'https://cartelera-vo.vercel.app'

/**
 * Get the WhatsApp JID for a user (or null if not linked)
 */
async function getJid(userId) {
  const { data } = await supabase
    .from('perfiles')
    .select('whatsapp_jid, nombre_display')
    .eq('id', userId)
    .maybeSingle()
  return data
}

/**
 * Format a session for display: "Lunes 10 Mar a las 18:30 en OCine"
 */
function formatSession(session) {
  if (!session) return 'hora por confirmar'
  const { date, time, cinema } = session
  const days = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado']
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  if (date) {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const dayName = days[dt.getDay()]
    const monthName = months[m - 1]
    return `${dayName} ${d} ${monthName}${time ? ` a las ${time}` : ''}${cinema ? ` en ${cinema}` : ''}`
  }
  return `${time || '?'}${cinema ? ` en ${cinema}` : ''}`
}

/**
 * Main handler — dispatched from supabase-watcher on every plan change
 */
export async function handlePlanChange(sock, payload) {
  const { eventType, new: plan, old: oldPlan } = payload

  // ─── WA-1: MATCH (new plan created) ───
  if (eventType === 'INSERT' && plan.state === 'proposed') {
    const initiator = await getJid(plan.initiator_id)
    const partner = await getJid(plan.partner_id)

    if (partner?.whatsapp_jid) {
      const initiatorName = initiator?.nombre_display || 'Alguien'
      const session = formatSession(plan.proposed_session)
      await sendText(sock, partner.whatsapp_jid,
        `CHACHO. Match con ${initiatorName}! 🎬\n\n` +
        `Los dos queréis ver *${plan.movie_title}*. Como cuando tu madre dice "mira, Armiche también va p'allá".\n\n` +
        `${session}\n\n` +
        `¿Te apuntas? 👉 ${APP_URL}`
      )
    }
    return
  }

  if (eventType !== 'UPDATE' || !plan || !oldPlan) return

  // ─── WA-2: SESSION_ACCEPTED (both said yes → confirmed) ───
  if (plan.state === 'confirmed' && oldPlan.state !== 'confirmed' && plan.chosen_session) {
    // Check if it's a confirmation from both saying yes (not a session pick)
    const bothYes = plan.initiator_response === 'yes' && plan.partner_response === 'yes'
    const wasNotConfirmed = !oldPlan.initiator_response || !oldPlan.partner_response
      || oldPlan.initiator_response !== 'yes' || oldPlan.partner_response !== 'yes'

    if (bothYes && wasNotConfirmed) {
      const session = formatSession(plan.chosen_session)
      for (const userId of [plan.initiator_id, plan.partner_id]) {
        const user = await getJid(userId)
        if (user?.whatsapp_jid) {
          await sendText(sock, user.whatsapp_jid,
            `Plan cerrao, bro ✓\n\n` +
            `*${plan.movie_title}* · ${session}\n\n` +
            `🍿 Nos vemos ahí. Sin audios. Sin dramas. Solo cine.`
          )
        }
      }
      return
    }
  }

  // ─── WA-3: SESSION_REJECTED (someone said no) ───
  if (
    (plan.initiator_response === 'no' && oldPlan.initiator_response !== 'no') ||
    (plan.partner_response === 'no' && oldPlan.partner_response !== 'no')
  ) {
    const whoSaidNo = plan.initiator_response === 'no' && oldPlan.initiator_response !== 'no'
      ? plan.initiator_id : plan.partner_id
    const otherId = whoSaidNo === plan.initiator_id ? plan.partner_id : plan.initiator_id

    const whoSaidNoProfile = await getJid(whoSaidNo)
    const other = await getJid(otherId)

    if (other?.whatsapp_jid) {
      const name = whoSaidNoProfile?.nombre_display || 'Tu amigo'
      await sendText(sock, other.whatsapp_jid,
        `${name} no puede ese día para *${plan.movie_title}*. No te lo tomes personal, la vida. 🤷\n\n` +
        `Abre VOSE y comparte tu disponibilidad 👉 ${APP_URL}`
      )
    }
    return
  }

  // ─── WA-4: AVAILABILITY_SENT (someone sent availability options) ───
  const initAvailChanged = plan.initiator_availability?.length > 0
    && (!oldPlan.initiator_availability || oldPlan.initiator_availability.length === 0)
  const partnerAvailChanged = plan.partner_availability?.length > 0
    && (!oldPlan.partner_availability || oldPlan.partner_availability.length === 0)

  if (initAvailChanged || partnerAvailChanged) {
    const senderId = initAvailChanged ? plan.initiator_id : plan.partner_id
    const receiverId = senderId === plan.initiator_id ? plan.partner_id : plan.initiator_id
    const avail = initAvailChanged ? plan.initiator_availability : plan.partner_availability

    const sender = await getJid(senderId)
    const receiver = await getJid(receiverId)

    if (receiver?.whatsapp_jid) {
      const name = sender?.nombre_display || 'Tu amigo'
      await sendText(sock, receiver.whatsapp_jid,
        `${name} te ha mandao ${avail.length} opciones de horario para *${plan.movie_title}*. Sin audio de 3 minutos, solo opciones limpias. 🙌\n\n` +
        `Elige la tuya 👉 ${APP_URL}`
      )
    }
    return
  }

  // ─── WA-5: SESSION_PICKED (chosen_session set → confirmed) ───
  if (plan.chosen_session && !oldPlan.chosen_session && plan.state === 'confirmed') {
    // Someone picked from availability options
    const session = formatSession(plan.chosen_session)

    // Notify the person who sent availability (the other one picked)
    for (const userId of [plan.initiator_id, plan.partner_id]) {
      const user = await getJid(userId)
      if (user?.whatsapp_jid) {
        await sendText(sock, user.whatsapp_jid,
          `Plan cerrao, bro ✓\n\n` +
          `*${plan.movie_title}* · ${session}\n\n` +
          `Menos logística que explicarle a un peninsular qué es una guagua. 🎬`
        )
      }
    }
    return
  }

  // ─── WA-6: NO_MATCH ───
  if (plan.state === 'no_match' && oldPlan.state !== 'no_match') {
    for (const userId of [plan.initiator_id, plan.partner_id]) {
      const user = await getJid(userId)
      if (user?.whatsapp_jid) {
        await sendText(sock, user.whatsapp_jid,
          `No hay fechas en común para *${plan.movie_title}*. 😔\n\n` +
          `Como 6 colegas queriendo ir al cine un lunes. Quizá la semana que viene.`
        )
      }
    }
    return
  }

  // ─── WA-7: ROULETTE_RESULT (payer_name set) ───
  if (plan.payer_name && !oldPlan.payer_name) {
    const participants = plan.participants || [plan.initiator_id, plan.partner_id]
    for (const userId of participants) {
      const user = await getJid(userId)
      if (user?.whatsapp_jid) {
        const isThePayer = user.nombre_display === plan.payer_name
        if (isThePayer) {
          await sendText(sock, user.whatsapp_jid,
            `🎰 La ruleta ha hablao!\n\nTe toca comprar las entradas, bro. ¿Y qué hago, mi niño? Pues pasar por caja. 😄`
          )
        } else {
          await sendText(sock, user.whatsapp_jid,
            `🎰 A *${plan.payer_name}* le toca soltar la pasta por las entradas.\n\nTú relax. Palomitas y a esperar. 🍿`
          )
        }
      }
    }
    return
  }

  // ─── WA-8: PLAN_JOINED (participants array grows) ───
  if (plan.participants?.length > (oldPlan.participants?.length || 0)) {
    const newParticipants = (plan.participants || []).filter(
      p => !(oldPlan.participants || []).includes(p)
    )

    for (const newUserId of newParticipants) {
      const newUser = await getJid(newUserId)
      const newName = newUser?.nombre_display || 'Alguien'

      // Notify existing participants
      const existingParticipants = (oldPlan.participants || [])
      for (const existingId of existingParticipants) {
        const existing = await getJid(existingId)
        if (existing?.whatsapp_jid) {
          await sendText(sock, existing.whatsapp_jid,
            `${newName} se ha apuntao al plan de *${plan.movie_title}*. 🙌\n\n` +
            `Ya sois ${plan.participants.length}. El grupo crece como cineros que encuentran VO en Las Palmas.`
          )
        }
      }
    }
    return
  }
}
