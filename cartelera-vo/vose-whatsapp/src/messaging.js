/**
 * Messaging utilities
 *
 * - sendText(): send a text message with "typing..." simulation
 * - Rate limiting: min 2s between messages to same contact
 * - Random delay 1-3s between messages to different contacts
 */

const lastMessageTime = new Map() // jid → timestamp
const MIN_INTERVAL_SAME = 2000 // 2s between messages to same contact
const MIN_INTERVAL_DIFF = 1000 // 1s min between any messages

let lastGlobalSend = 0

/**
 * Send a text message with natural typing delay
 */
export async function sendText(sock, jid, text) {
  // Rate limit: same contact
  const lastToThis = lastMessageTime.get(jid) || 0
  const sinceLast = Date.now() - lastToThis
  if (sinceLast < MIN_INTERVAL_SAME) {
    await delay(MIN_INTERVAL_SAME - sinceLast)
  }

  // Rate limit: global (different contacts)
  const sinceGlobal = Date.now() - lastGlobalSend
  if (sinceGlobal < MIN_INTERVAL_DIFF) {
    await delay(MIN_INTERVAL_DIFF - sinceGlobal + randomMs(500, 2000))
  }

  // Simulate "typing..." (non-critical, don't crash if presence fails)
  try {
    await sock.presenceSubscribe(jid)
    await sock.sendPresenceUpdate('composing', jid)
    await delay(500 + randomMs(300, 1500))
    await sock.sendPresenceUpdate('paused', jid)
  } catch {
    // Presence APIs can fail without affecting message delivery
  }

  // Send
  await sock.sendMessage(jid, { text })

  // Track timing
  lastMessageTime.set(jid, Date.now())
  lastGlobalSend = Date.now()

  console.log(`📤 → ${jid.split('@')[0]}: ${text.slice(0, 60)}...`)
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function randomMs(min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}
