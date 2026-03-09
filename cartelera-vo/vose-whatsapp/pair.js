/**
 * Minimal pairing script — run once to link the phone number.
 * After successful pairing, auth_session/ will contain the credentials.
 * Then run `npm start` to start the full agent.
 *
 * Usage: node --env-file=.env pair.js
 */

import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import pino from 'pino'

const PHONE = process.env.WA_PHONE_NUMBER || '34609962190'
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

// Updated WA protocol version to avoid 405 rejection
// See: https://github.com/WhiskeySockets/Baileys/issues/2376
const WA_VERSION = [2, 3000, 1034074495]

async function getVersion() {
  try {
    const { version } = await fetchLatestBaileysVersion()
    if (version && version[2] > WA_VERSION[2]) {
      console.log(`📡 Version WA del servidor: ${version.join('.')}`)
      return version
    }
  } catch {}
  console.log(`📡 Version WA manual: ${WA_VERSION.join('.')}`)
  return WA_VERSION
}

async function pair() {
  console.log('🔗 VOSE WhatsApp Pairing Tool')
  console.log(`📞 Numero: +${PHONE}\n`)

  const { state } = await useMultiFileAuthState('./auth_session')

  if (state.creds.registered) {
    console.log('✅ Ya hay una sesion activa en auth_session/.')
    console.log('   Si quieres re-emparejar, borra la carpeta: rm -rf auth_session')
    process.exit(0)
  }

  const version = await getVersion()

  let attempt = 0
  const MAX_ATTEMPTS = 12

  async function tryPair() {
    attempt++
    console.log(`\n--- Intento ${attempt}/${MAX_ATTEMPTS} ---`)

    const { state: freshState, saveCreds } = await useMultiFileAuthState('./auth_session')

    const sock = makeWASocket({
      auth: {
        creds: freshState.creds,
        keys: makeCacheableSignalKeyStore(freshState.keys, logger),
      },
      version,
      printQRInTerminal: false,
      logger,
      syncFullHistory: false,
      browser: ['macOS', 'Chrome', '131.0.0'],
      connectTimeoutMs: 60000,
    })

    sock.ev.on('creds.update', saveCreds)

    let resolved = false

    return new Promise((resolve, reject) => {
      const pairingTimer = setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PHONE)
          console.log('\n' + '═'.repeat(40))
          console.log('  CODIGO:  ' + code)
          console.log('═'.repeat(40))
          console.log('\n📱 En tu telefono:')
          console.log('   WhatsApp → Ajustes → Dispositivos vinculados')
          console.log('   → Vincular dispositivo')
          console.log('   → "Vincular con numero de telefono"')
          console.log(`   → Introduce: ${code}\n`)
        } catch (err) {
          console.log('⚠️  No se pudo generar codigo:', err.message)
          if (!resolved) {
            resolved = true
            sock.end(undefined)
            if (attempt < MAX_ATTEMPTS) {
              const wait = 5000 + Math.random() * 5000
              console.log(`   Reintentando en ${Math.round(wait / 1000)}s...`)
              setTimeout(() => tryPair().then(resolve).catch(reject), wait)
            } else {
              reject(new Error('Max pairing attempts reached'))
            }
          }
        }
      }, 5000)

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
          if (!resolved) {
            resolved = true
            clearTimeout(pairingTimer)
            console.log('\n✅ ¡EMPAREJAMIENTO EXITOSO!')
            console.log('   Sesion guardada en auth_session/')
            console.log('   Ahora ejecuta: npm start\n')
            setTimeout(() => {
              sock.end(undefined)
              resolve(true)
            }, 3000)
          }
        }

        if (connection === 'close' && !resolved) {
          clearTimeout(pairingTimer)
          const statusCode = lastDisconnect?.error?.output?.statusCode

          console.log(`⚠️  Desconexion (${statusCode})`)

          if (statusCode === DisconnectReason.loggedOut) {
            resolved = true
            reject(new Error('logged out'))
            return
          }

          if (attempt < MAX_ATTEMPTS) {
            resolved = true
            const wait = 4000 + Math.random() * 4000
            console.log(`   Reintentando en ${Math.round(wait / 1000)}s...`)
            setTimeout(() => tryPair().then(resolve).catch(reject), wait)
          } else {
            resolved = true
            reject(new Error('Max pairing attempts reached'))
          }
        }
      })
    })
  }

  try {
    await tryPair()
  } catch (err) {
    console.error('\n❌ Fallo el emparejamiento:', err.message)
    console.log('Posibles causas:')
    console.log('  - WhatsApp esta bloqueando conexiones desde este IP')
    console.log('  - El numero no esta registrado en WhatsApp')
    console.log('  - Demasiados intentos. Espera unos minutos.')
    process.exit(1)
  }

  process.exit(0)
}

pair()
