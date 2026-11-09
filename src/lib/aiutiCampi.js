import { createContext, useContext } from 'react'

// GLI AIUTI SOTTO I CAMPI DELLE SCHEDE (REQ-UI-032).
//
// Richiesta dell'08/11/2026: «rimuovere gli aiuti sopra tutti i campi
// compilabili o almeno permettere di abilitarli/disabilitarli». In una
// scheda lunga — il drink, il prodotto di magazzino — la riga d'aiuto di un
// campo finisce sopra l'etichetta del successivo, e a chi la compila tutti
// i giorni ripete cose che sa già. Di partenza sono nascosti; si
// riaccendono da Impostazioni → Aspetto, per tutto il locale.
//
// Il contesto vale `true` fuori dall'app (un componente provato da solo
// mostra i suoi aiuti): la scelta del locale la mette App.jsx.
// Sta in un file suo e non in AiutoCampo.jsx per la regola react-refresh
// del lint (un file di componenti esporta solo componenti).
export const CHIAVE_AIUTI_CAMPI = 'aiuti_campi'
export const AiutiCampi = createContext(true)
export const aiutiCampiAccesi = (settings) => settings?.[CHIAVE_AIUTI_CAMPI] === true
export const useAiutiCampi = () => useContext(AiutiCampi)
