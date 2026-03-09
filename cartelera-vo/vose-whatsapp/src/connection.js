/**
 * Baileys WhatsApp connection
 *
 * - Uses useMultiFileAuthState for persistent sessions
 * - Displays QR code in terminal on first login
 * - Automatic reconnect with exponential backoff
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

const logger = pino({ level: 'warn' })
const AUTH_DIR = './auth_session'
const MAX_RETRIES = 5

let retryCount = 0

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    // Reduce message history download on reconnect
    syncFullHistory: false,
  })

  // Save credentials whenever they update
  sock.ev.on('creds.update', saveCreds)

  // Connection state handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // Display QR code in terminal
    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp:\n')
      qrcode.generate(qr, { small: true })
      console.log('\nAbre WhatsApp → Dispositivos vinculados → Vincular dispositivo\n')
    }

    if (connection === 'open') {
      retryCount = 0
      console.log('📲 WhatsApp conectado!')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.log(`⚠️  Conexion cerrada (status: ${statusCode})`)

      if (shouldReconnect && retryCount < MAX_RETRIES) {
        retryCount++
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        console.log(`🔄 Reconectando en ${delay / 1000}s (intento ${retryCount}/${MAX_RETRIES})...`)
        await new Promise(r => setTimeout(r, delay))
        return connectWhatsApp()
      }

      if (!shouldReconnect) {
        console.log('🚪 Sesion cerrada. Borra la carpeta auth_session/ y escanea un nuevo QR.')
        process.exit(0)
      }

      console.error('💥 Maximos reintentos alcanzados.')
      process.exit(1)
    }
  })

  return sock
}
