---
category: Stato
---

La campanella dello stato: dice se c'è qualcosa in sospeso — scritture non
ancora arrivate al server, notifiche da leggere — e permette di riprovare.

Serve perché nell'app **niente aspetta la rete**: le scritture partono in
sottofondo e le schermate si aggiornano subito. È una scelta voluta (un `await`
su una scrittura offline non torna mai, e al banco vuol dire app bloccata), ma
qualcuno deve pur dire che quella roba non è ancora atterrata. Quel qualcuno è
questa campanella.

## Props

| prop | tipo | |
|---|---|---|
| `floating` | `boolean` | `false`: sta in linea, dentro la barra in alto. `true`: tasto tondo in basso a destra, per la coda a tutto schermo, dove la barra non c'è e gli avvisi non devono sparire proprio nella schermata in cui si lavora tutta la sera |

Il pallino della campanella cambia col ciclo della sincronizzazione (`idle`,
`syncing`, `synced`, `error`) e un contatore segna le notifiche non lette
(`9+` oltre nove). Toccandola si apre il pannello: stato della sincronizzazione
— in errore, «riprova l'ultima» o «riprova tutte» — e lo storico degli avvisi.
**Aprire non è leggere**: una notifica si segna letta toccandola, o con «segna
tutte lette», che è una decisione presa; prima bastava aprire il pannello e
l'avviso spariva senza essere stato letto davvero.

Usa `<Link>` di react-router: va montata dentro un Router.

## Esempio

```jsx
<header className="topbar">
  <Logo />
  <StatusBell />
</header>
```
