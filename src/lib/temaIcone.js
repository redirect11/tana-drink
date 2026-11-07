import { createContext, useContext } from 'react'
import { testoConIcona, GRUPPO_DI_PARTENZA, TEMA_ICONE_DI_PARTENZA } from './icone.js'

// Il contesto porta il tema di OGNI gruppo ({ navigazione, tasti,
// segnali }, lib/icone.js): ogni icona dice di che gruppo è, e la
// navigazione è quello di partenza. Sta qui e non in Icona.jsx perché un
// file di componenti che esporta anche altro rompe il ricaricamento a caldo
// di Vite (la regola react-refresh del lint).
export const TemaIcone = createContext({})

export function useTemaIcone(gruppo = GRUPPO_DI_PARTENZA) {
  return useContext(TemaIcone)?.[gruppo] ?? TEMA_ICONE_DI_PARTENZA
}

// Per le icone che stanno dentro un TESTO (un segnaposto, una voce di
// tendina, un titolo passato come stringa): `testo('cerca', 'Cerca…')`.
// I segnali sono il gruppo di partenza: in un testo, un'icona è quasi
// sempre un avviso o un'indicazione.
export function useTestoConIcona(gruppo = 'segnali') {
  const tema = useTemaIcone(gruppo)
  return (nome, testo) => testoConIcona(tema, nome, testo)
}
