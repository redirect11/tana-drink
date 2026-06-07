import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebaseClient.js'

// Lato massimo (px) e qualità JPEG per il ridimensionamento delle foto drink.
// Le foto scattate da smartphone pesano spesso diversi MB: le riduciamo prima
// dell'upload per risparmiare banda e spazio su Storage.
const MAX_DIM = 1200
const QUALITY = 0.82

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

// Ridimensiona l'immagine via canvas. In caso di errore (o immagine già piccola)
// restituisce il file originale, così l'upload non fallisce mai per questo.
async function downscaleImage(file) {
  if (!file.type || !file.type.startsWith('image/')) return file
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
    if (scale >= 1) return file // già entro i limiti

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY))
    return blob || file
  } catch {
    return file
  }
}

// Carica la foto di un drink su Firebase Storage e restituisce l'URL pubblico.
// Le immagini sono salvate sotto `drinks/` (lette pubblicamente, scritte solo
// da utenti autenticati — vedi storage.rules).
export async function uploadDrinkImage(file) {
  const processed = await downscaleImage(file)
  const isJpeg = (processed.type || '') === 'image/jpeg'
  const ext = isJpeg ? 'jpg' : (file.name.includes('.') ? file.name.split('.').pop() : 'img')
  const path = `drinks/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, processed, { contentType: processed.type || file.type || 'image/jpeg' })
  return getDownloadURL(storageRef)
}

// Cancella (best-effort) una foto a partire dal suo download URL.
// Non solleva eccezioni: l'eliminazione del drink non deve fallire se la foto
// è già assente o le regole lo impediscono.
export async function deleteDrinkImageByUrl(url) {
  if (!url) return
  try {
    await deleteObject(ref(storage, url))
  } catch {
    /* best effort: ignora */
  }
}
