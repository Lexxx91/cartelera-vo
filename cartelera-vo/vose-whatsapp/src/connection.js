/**
 * Baileys WhatsApp connection
 *
 * - Uses useMultiFileAuthState for persistent sessions
 * - Pairing code method (no QR needed) on first login
 * - Overrides WA protocol version to avoid 405 rejection
 * - Automatic reconnect with exponential backoff
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' })
const AUTH_DIR = './auth_session'
const MAX_RETRIES = 5
const MAX_PAIRING_RETRIES = 10
const PHONE_NUMBER = process.env.WA_PHONE_NUMBER || '34609962190'

// Updated WA protocol version — the one shipped with Baileys is stale
// and WhatsApp servers reject it with 405.
// See: https://github.com/WhiskeySockets/Baileys/issues/2376
const WA_VERSION = [2, 3000, 1034074495]

let retryCount = 0
let isPairing = false

/**
 * Connect to WhatsApp. Accepts an optional onReady callback
 * that fires on every (re)connection, so listeners can be
 * re-attached to the new socket.
 */
export async function connectWhatsApp(onReady) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  isPairing = !state.creds.registered

  // Try to fetch latest version from WA servers; fall back to our hardcoded one
  let version = WA_VERSION
  try {
    const { version: latest } = await fetchLatestBaileysVersion()
    if (latest && latest[2] > WA_VERSION[2]) {
      version = latest
      console.log(`📡 Usando version WA del servidor: ${latest.join('.')}`)
    }
  } catch {
    console.log(`📡 Usando version WA manual: ${WA_VERSION.join('.')}`)
  }

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version,
    printQRInTerminal: false,
    logger,
    syncFullHistory: false,
    // Use macOS identity — WhatsApp rejects custom browser names
    // and has started rejecting the 'WEB' platform since Feb 2026
    browser: ['macOS', 'Chrome', '131.0.0'],
    connectTimeoutMs: isPairing ? 60000 : 20000,
    keepAliveIntervalMs: isPairing ? 5000 : 30000,
  })

  // Save credentials whenever they update
  sock.ev.on('creds.update', saveCreds)

  // If not registered (first time), request pairing code
  if (isPairing) {
    // Wait for socket to initialize
    await new Promise(r => setTimeout(r, 4000))

    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER)
      console.log('\n' + '='.repeat(50))
      console.log('📱 CODIGO DE EMPAREJAMIENTO:')
      console.log(`\n   >>> ${code} <<<\n`)
      console.log('Abre WhatsApp en tu telefono:')
      console.log('  1. Ajustes → Dispositivos vinculados')
      console.log('  2. Vincular dispositivo')
      console.log('  3. "Vincular con numero de telefono"')
      console.log(`  4. Introduce: ${code}`)
      console.log('='.repeat(50) + '\n')
      console.log('⏳ Esperando emparejamiento...')
    } catch (err) {
      console.error('❌ Error al solicitar pairing code:', err.message)
    }
  }

  // Connection state handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      retryCount = 0
      isPairing = false
      console.log('📲 WhatsApp conectado!')
      // Re-attach listeners on every successful connection
      if (onReady) onReady(sock)
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      const maxRetries = isPairing ? MAX_PAIRING_RETRIES : MAX_RETRIES

      console.log(`⚠️  Conexion cerrada (status: ${statusCode})${isPairing ? ' [pairing]' : ''}`)

      if (shouldReconnect && retryCount < maxRetries) {
        retryCount++
        const delay = isPairing
          ? 5000 + Math.random() * 3000
          : Math.min(1000 * Math.pow(2, retryCount), 30000)

        console.log(`🔄 Reconectando en ${Math.round(delay / 1000)}s (${retryCount}/${maxRetries})...`)
        await new Promise(r => setTimeout(r, delay))
        return connectWhatsApp(onReady)
      }

      if (!shouldReconnect) {
        console.log('🚪 Sesion cerrada. Borra auth_session/ y reinicia.')
        process.exit(0)
      }

      console.error('💥 Maximos reintentos alcanzados.')
      process.exit(1)
    }
  })

  return sock
}
