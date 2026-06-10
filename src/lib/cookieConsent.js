/**
 * Vanilla CookieConsent v3 (orestbida) — https://cookieconsent.orestbida.com
 *
 * L'app usa solo storage tecnico strettamente necessario (carrello, ordini
 * effettuati, sessione bartender): non serve consenso, il banner è
 * puramente informativo. Stessa impostazione del sito karaoke-tana.
 */
import * as CookieConsent from 'vanilla-cookieconsent'
import 'vanilla-cookieconsent/dist/cookieconsent.css'

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

  return CookieConsent.run({
    guiOptions: {
      consentModal: {
        layout: 'bar',
        position: 'bottom',
        equalWeightButtons: false,
        flipButtons: false,
      },
      preferencesModal: {
        layout: 'box',
        equalWeightButtons: true,
        flipButtons: false,
      },
    },

    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
    },

    language: {
      default: 'it',
      translations: {
        it: {
          consentModal: {
            title: '🍪 Questo sito usa i cookie',
            description:
              'Utilizziamo solo cookie e storage tecnici strettamente necessari al ' +
              'funzionamento del servizio (carrello, ordini effettuati, accesso staff). ' +
              'Non raccogliamo dati per profilazione o marketing. ' +
              `<a href="${policyUrl}" class="cc__link">Leggi la Cookie Policy</a>.`,
            acceptAllBtn: 'Accetto',
            footer: `<a href="${policyUrl}" class="cc__link">Cookie Policy</a>`,
          },
          preferencesModal: {
            title: 'Impostazioni cookie',
            acceptAllBtn: 'Accetto tutto',
            savePreferencesBtn: 'Salva impostazioni',
            closeIconLabel: 'Chiudi',
            sections: [
              {
                title: 'Cookie strettamente necessari',
                description:
                  'Questi cookie e dati locali sono indispensabili per il corretto ' +
                  'funzionamento dell’app (carrello, stato degli ordini, sessione ' +
                  'bartender) e non possono essere disattivati. ' +
                  `<a href="${policyUrl}" class="cc__link">Cookie Policy completa</a>.`,
                linkedCategory: 'necessary',
              },
            ],
          },
        },
      },
    },
  })
}
