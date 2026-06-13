/**
 * Vanilla CookieConsent v3 (orestbida) — https://cookieconsent.orestbida.com
 *
 * L'app usa solo storage tecnico strettamente necessario (carrello, ordini
 * effettuati, sessione bartender): non serve consenso, il banner è
 * puramente informativo. Stessa impostazione del sito karaoke-tana.
 */
import * as CookieConsent from 'vanilla-cookieconsent'
import 'vanilla-cookieconsent/dist/cookieconsent.css'
import { enableAnalytics, disableAnalytics } from './analytics.js'

// Tema scuro/oro del sito applicato alle variabili CSS di CookieConsent.
const theme = `
#cc-main {
  --cc-font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --cc-modal-border-radius: 16px;
  --cc-btn-border-radius: 999px;
  --cc-bg: #1a1a26;
  --cc-secondary-color: #f5f5f7;
  --cc-primary-color: #f5b94a;
  --cc-link-color: #f5b94a;
  --cc-btn-primary-bg: #e8a32e;
  --cc-btn-primary-border-color: #e8a32e;
  --cc-btn-primary-color: #1c1305;
  --cc-btn-primary-hover-bg: #f7c45e;
  --cc-btn-primary-hover-border-color: #f7c45e;
  --cc-btn-primary-hover-color: #1c1305;
  --cc-btn-secondary-bg: #15151f;
  --cc-btn-secondary-color: #f5f5f7;
  --cc-btn-secondary-border-color: #33333f;
  --cc-btn-secondary-hover-bg: #1a1a26;
  --cc-btn-secondary-hover-border-color: #33333f;
  --cc-btn-secondary-hover-color: #f5f5f7;
  --cc-separator-border-color: #33333f;
  --cc-footer-bg: #15151f;
  --cc-footer-color: #9b9ba8;
  --cc-footer-border-color: #33333f;
  --cc-cookie-category-block-bg: #15151f;
  --cc-cookie-category-block-border: 1px solid #33333f;
  --cc-overlay-bg: rgba(0, 0, 0, 0.55);
  --cc-toggle-readonly-bg: #6b5a35;
  --cc-toggle-on-bg: #e8a32e;
  --cc-toggle-off-bg: #33333f;
}
#cc-main .cm,
#cc-main .cm__body,
#cc-main .cm__btns {
  background: #1a1a26;
}
#cc-main .cm__footer {
  background: #15151f;
  border-top-color: #33333f;
}
`

export function initCookieConsent() {
  const s = document.createElement('style')
  s.textContent = theme
  document.head.appendChild(s)

  const policyUrl = `${import.meta.env.BASE_URL}cookie-policy.html`

  // Attiva/disattiva Google Analytics in base alla scelta dell'utente.
  // Chiamata sia al primo consenso sia a ogni modifica successiva.
  function applyConsent() {
    if (CookieConsent.acceptedCategory('analytics')) enableAnalytics()
    else disableAnalytics()
  }

  return CookieConsent.run({
    guiOptions: {
      consentModal: {
        layout: 'bar',
        position: 'bottom',
        // Rifiuta e Accetta con uguale evidenza (richiesto dal Garante).
        equalWeightButtons: true,
        flipButtons: false,
      },
      preferencesModal: {
        layout: 'box',
        equalWeightButtons: true,
        flipButtons: false,
      },
    },

    // GA parte solo dopo il consenso e si ferma se revocato.
    onConsent: applyConsent,
    onChange: applyConsent,

    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      // Statistiche (Google Analytics): spenta di default → opt-in.
      analytics: {},
    },

    language: {
      default: 'it',
      translations: {
        it: {
          consentModal: {
            title: '🍪 Questo sito usa i cookie',
            description:
              'Usiamo cookie tecnici necessari al funzionamento (carrello, ordini, ' +
              'accesso staff) e, solo col tuo consenso, cookie di statistica ' +
              '(Google Analytics) per capire come viene usato il servizio. ' +
              `<a href="${policyUrl}" class="cc__link">Cookie Policy</a>.`,
            acceptAllBtn: 'Accetta tutti',
            acceptNecessaryBtn: 'Rifiuta',
            showPreferencesBtn: 'Personalizza',
            footer: `<a href="${policyUrl}" class="cc__link">Cookie Policy</a>`,
          },
          preferencesModal: {
            title: 'Impostazioni cookie',
            acceptAllBtn: 'Accetta tutti',
            acceptNecessaryBtn: 'Rifiuta tutti',
            savePreferencesBtn: 'Salva impostazioni',
            closeIconLabel: 'Chiudi',
            sections: [
              {
                title: 'Cookie strettamente necessari',
                description:
                  'Indispensabili per il funzionamento dell’app (carrello, stato ' +
                  'degli ordini, sessione staff): non possono essere disattivati.',
                linkedCategory: 'necessary',
              },
              {
                title: 'Cookie di statistica',
                description:
                  'Google Analytics, in forma aggregata, per capire come viene usata ' +
                  'l’app e migliorarla. Attivi solo se acconsenti; puoi cambiare idea ' +
                  'in qualsiasi momento. ' +
                  `<a href="${policyUrl}" class="cc__link">Dettagli nella Cookie Policy</a>.`,
                linkedCategory: 'analytics',
              },
            ],
          },
        },
      },
    },
  })
}

// Riapre il pannello delle preferenze (link "Preferenze cookie" nel footer).
export function openCookiePreferences() {
  CookieConsent.showPreferences()
}
