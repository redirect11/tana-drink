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

// Il banner prende i colori del tema in uso (REQ-UI-033): era scritto a mano
// con la notte e l'oro della Tana, e un locale con Lime lo vedeva dorato al
// primo avvio, prima ancora del menù. Con «Tana scuro» i valori sono quelli
// di prima: --btn-1/--btn-2 sono l'oro di casa, i separatori un grigio
// mescolato dal testo.
const theme = `
#cc-main {
  --cc-font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --cc-modal-border-radius: 16px;
  --cc-btn-border-radius: 999px;
  --cc-bg: var(--card);
  --cc-secondary-color: var(--text);
  --cc-primary-color: var(--accent-2);
  --cc-link-color: var(--accent-2);
  --cc-btn-primary-bg: var(--btn-2);
  --cc-btn-primary-border-color: var(--btn-2);
  --cc-btn-primary-color: var(--btn-ink);
  --cc-btn-primary-hover-bg: var(--btn-1);
  --cc-btn-primary-hover-border-color: var(--btn-1);
  --cc-btn-primary-hover-color: var(--btn-ink);
  --cc-btn-secondary-bg: var(--bg-2);
  --cc-btn-secondary-color: var(--text);
  --cc-btn-secondary-border-color: color-mix(in srgb, var(--text) 14%, var(--card));
  --cc-btn-secondary-hover-bg: var(--card);
  --cc-btn-secondary-hover-border-color: color-mix(in srgb, var(--text) 14%, var(--card));
  --cc-btn-secondary-hover-color: var(--text);
  --cc-separator-border-color: color-mix(in srgb, var(--text) 14%, var(--card));
  --cc-footer-bg: var(--bg-2);
  --cc-footer-color: var(--muted);
  --cc-footer-border-color: color-mix(in srgb, var(--text) 14%, var(--card));
  --cc-cookie-category-block-bg: var(--bg-2);
  --cc-cookie-category-block-border: 1px solid color-mix(in srgb, var(--text) 14%, var(--card));
  --cc-overlay-bg: rgba(0, 0, 0, 0.55);
  --cc-toggle-readonly-bg: color-mix(in srgb, var(--btn) 40%, var(--card));
  --cc-toggle-on-bg: var(--btn-2);
  --cc-toggle-off-bg: color-mix(in srgb, var(--text) 14%, var(--card));
}
#cc-main .cm,
#cc-main .cm__body,
#cc-main .cm__btns {
  background: var(--card);
}
#cc-main .cm__footer {
  background: var(--bg-2);
  border-top-color: color-mix(in srgb, var(--text) 14%, var(--card));
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
