import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook para detectar el estado de instalación PWA y exponer
 * la funcionalidad de instalación.
 *
 * Casos posibles:
 * - isInstalled: ya está instalada como PWA (standalone)
 * - canInstall: Chrome/Android puede mostrar prompt nativo
 * - isIOS: es iOS Safari → tutorial manual (compartir → añadir)
 * - isIOSChrome: es iOS pero NO Safari (Chrome, Firefox, etc.)
 *     → no puede instalar, hay que abrir en Safari
 */
export default function usePWAInstall() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isIOSChrome, setIsIOSChrome] = useState(false)
  const deferredPromptRef = useRef(null)

  useEffect(() => {
    // 1. Detect standalone mode (already installed as PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true // iOS Safari standalone

    setIsInstalled(isStandalone)

    // 2. Detect iOS device
    const ua = navigator.userAgent
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream

    if (isIOSDevice && !isStandalone) {
      // Check if it's Safari or another browser on iOS
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua)

      if (isSafari) {
        setIsIOS(true)        // Safari → can add to home screen manually
      } else {
        setIsIOSChrome(true)  // Chrome/Firefox/etc on iOS → must open in Safari
      }
    }

    // 3. Listen for beforeinstallprompt (Chrome Android, Edge, Samsung Internet)
    function handleBeforeInstallPrompt(e) {
      e.preventDefault() // Prevent browser's default mini-infobar
      deferredPromptRef.current = e
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 4. Listen for successful installation
    function handleAppInstalled() {
      setIsInstalled(true)
      setCanInstall(false)
      setIsIOS(false)
      setIsIOSChrome(false)
      deferredPromptRef.current = null
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Trigger the native install prompt (Android/Chrome only)
  const promptInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current
    if (!prompt) return false

    prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPromptRef.current = null
    setCanInstall(false)

    return outcome === 'accepted'
  }, [])

  return { isInstalled, canInstall, isIOS, isIOSChrome, promptInstall }
}
