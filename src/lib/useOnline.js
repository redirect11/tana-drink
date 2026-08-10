import { useEffect, useState } from 'react'

// Stato di connessione del dispositivo. `navigator.onLine` + eventi
// online/offline: non è infallibile (una LAN senza internet risulta
// "online"), ma copre il caso d'uso — sapere se stiamo lavorando offline.
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  )
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
