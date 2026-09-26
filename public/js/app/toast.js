// Root toast (DESIGN.md → "Job-Toast"): ONE toast state on the root, fed from
// two sources —
//
//   1. notify(kind, text) from anywhere (utils.js → EVT.NOTIFY), e.g. "saved";
//   2. every api() error that NO card caught: a card method that just awaits
//      api() and lets it throw still tells the user something went wrong.
//
// A card that wants its own wording (a form field error, a retry hint) catches
// the ApiError itself — then the toast stays out of it. 401 is never a toast:
// the session banner covers it.

import { EVT } from '../events.js';
import { isApiError, apiErrorKey, notify } from '../utils.js';
import { t } from '../i18n.js';

const OK_MS = 4000; // a success fades; an error stays until closed

export const toastMethods = {
  showToast(kind, text) {
    clearTimeout(this._toastTimer);
    this.toast = { kind, text };
    this._toastTimer = kind === 'ok' ? setTimeout(() => this.closeToast(), OK_MS) : null;
  },
  closeToast() {
    clearTimeout(this._toastTimer);
    this._toastTimer = null;
    this.toast = null;
  },
};

// Root init: show whatever notify() sends.
export function listenForToasts(root) {
  window.addEventListener(EVT.NOTIFY, (e) => root.showToast(e.detail.kind, e.detail.text));
}

// Alpine's own handler for an error thrown in an expression (verbatim default:
// warn + rethrow async, so bugs stay loud — the e2e console guard sees them).
function alpineDefault(error, el, expression) {
  const err = Object.assign(error ?? { message: 'No error message given.' }, { el, expression });
  console.warn(`Alpine Expression Error: ${err.message}\n\n${expression ? `Expression: "${expression}"\n\n` : ''}`, el);
  setTimeout(() => { throw err; }, 0);
}

function toToast(error) {
  if (error.status !== 401) notify('err', t(apiErrorKey(error)));
}

// App boot only (not the harnesses — there an uncaught error must stay loud).
// Uncaught ApiErrors become a toast; everything else keeps Alpine's default.
// Covers both paths an error takes: Alpine expressions (@click="save()") and
// plain promises outside Alpine (a timer, an init chain).
export function installApiErrorToast(Alpine) {
  Alpine.setErrorHandler((error, el, expression) => {
    if (isApiError(error)) return toToast(error);
    alpineDefault(error, el, expression);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    if (!isApiError(ev.reason)) return;
    ev.preventDefault();
    toToast(ev.reason);
  });
}
