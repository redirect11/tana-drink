// ── IL PASSAGGIO DELLE CHIAVI, PRIMA DI OGNI ALTRO MODULO (REQ-VENUE-005) ──
//
// Va importato per PRIMO in main.jsx, ed è un modulo a parte apposta: gli
// import di un modulo girano prima del suo codice, e qualche modulo legge
// localStorage già mentre si carica (progressivi.js: i numeri assegnati e
// la cassa aperta). Con la chiamata nel corpo di main.jsx quei moduli
// leggevano le chiavi `drink:` ancora vuote, la prima sera dopo
// l'aggiornamento: è la finestra dei due ordini #5 (BUG-074). Da qui la
// copia avviene prima che chiunque legga.
import { migraChiaviLocali } from './migrazioneChiavi.js'

migraChiaviLocali()
