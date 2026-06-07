// Conversione di una foto in un data URL compresso, da salvare direttamente
// in Firestore (campo `image_url` del drink). Evita Firebase Storage, che
// richiede il piano a pagamento.
//
// La compressione è aggressiva di proposito: le immagini finiscono dentro il
// documento Firestore (limite 1 MB/doc) e vengono scaricate insieme al menù,
// quindi vanno tenute piccole.

const MAX_DIM = 600 // lato massimo in px
const TARGET_BYTES = 80 * 1024 // ~80 KB obiettivo
const MIN_QUALITY = 0.4
const START_QUALITY = 0.72

function loadImageEl(file) {
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

// Usa createImageBitmap quando disponibile per rispettare l'orientamento EXIF.
async function loadSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fallback sotto */
    }
  }
  return loadImageEl(file)
}

function toBlob(canvas, quality) {
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Ridimensiona e comprime un file immagine in un data URL JPEG.
// Lancia un errore se il file non è un'immagine o non è elaborabile,
// così non finiscono mai blob enormi (o non immagini) dentro Firestore.
export async function fileToDataUrl(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Seleziona un file immagine valido.')
  }

  const src = await loadSource(file)
  const sw = src.width
  const sh = src.height
  const scale = Math.min(1, MAX_DIM / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(src, 0, 0, w, h)
  if (typeof src.close === 'function') src.close()

  // Riduci la qualità finché l'immagine non rientra nel budget di byte.
  let quality = START_QUALITY
  let blob = await toBlob(canvas, quality)
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12)
    blob = await toBlob(canvas, quality)
  }

  if (!blob) throw new Error('Impossibile elaborare l’immagine.')
  return blobToDataUrl(blob)
}
