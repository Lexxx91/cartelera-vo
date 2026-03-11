/**
 * In-memory conversation history per WhatsApp JID
 *
 * - Max 10 messages (5 user + 5 assistant)
 * - 30-minute inactivity timeout → auto-clear
 * - Lost on restart — acceptable for WhatsApp
 */

const conversations = new Map()
const MAX_MESSAGES = 10
const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function addMessage(jid, role, content) {
  let conv = conversations.get(jid)
  if (!conv) {
    conv = { messages: [], timer: null }
    conversations.set(jid, conv)
  }

  conv.messages.push({ role, content, timestamp: Date.now() })

  // Trim to max
  if (conv.messages.length > MAX_MESSAGES) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES)
  }

  // Reset inactivity timer
  if (conv.timer) clearTimeout(conv.timer)
  conv.timer = setTimeout(() => clearHistory(jid), TIMEOUT_MS)
}

export function getHistory(jid) {
  const conv = conversations.get(jid)
  if (!conv) return []
  return conv.messages.map(({ role, content }) => ({ role, content }))
}

export function clearHistory(jid) {
  const conv = conversations.get(jid)
  if (conv?.timer) clearTimeout(conv.timer)
  conversations.delete(jid)
}
