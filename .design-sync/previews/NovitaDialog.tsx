import { NovitaDialog } from 'karaoke-drink'

// Il box che compare una volta sola dopo un aggiornamento. Le note se le va a
// prendere da sé: legge `changelog.md` pubblicato insieme all'app e ne mostra
// la sezione più in alto. Fuori dall'app quel file non c'è, quindi qui si vede
// la strada di riserva — che è comunque un caso vero: quando le note non
// arrivano il box lo dice e rimanda a Impostazioni → Informazioni, invece di
// restare vuoto.
export const CosaECambiato = () => (
  <div style={{ minHeight: 560 }}>
    <NovitaDialog onClose={() => {}} />
  </div>
)
