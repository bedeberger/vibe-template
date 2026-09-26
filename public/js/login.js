// Login page (public/login.html, docs/auth.md). A pre-auth Alpine page of its
// own — NOT part of the SPA shell and its card inventory: it runs without a
// session, so it may only load public paths (lib/auth.js → isPublicPath).
//
// Flow: POST /auth/login → { ok } (session, go to /) | { mustChange } (initial
// password: switch to the change form, which re-authenticates with the same
// password via POST /auth/password and opens the session there).

import Alpine from '/vendor/alpine-3.15.12.esm.min.js';
import { configureI18n, t } from '/js/i18n.js';

const MIN_LENGTH = 12; // lib/password.js → MIN_LENGTH

// Server error strings (routes/auth.js, lib/password.js) → i18n keys.
const ERROR_KEYS = {
  'invalid credentials': 'login.err.invalid',
  'account disabled': 'login.err.disabled',
  'rate limited': 'login.err.rateLimited',
  'password too short': 'login.err.tooShort',
  'password too long': 'login.err.tooLong',
  'password unchanged': 'login.err.unchanged',
};

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'error');
  return data;
}

function loginPage() {
  return {
    methods: { method: 'local', adminLogin: false, devMode: false },
    mode: 'login', // 'login' | 'change'
    email: '',
    password: '',
    newPassword: '',
    repeatPassword: '',
    error: '',
    busy: false,
    minLength: MIN_LENGTH,
    t,

    get showPasswordForm() {
      return this.methods.method === 'local' || this.methods.adminLogin;
    },

    async init() {
      try {
        const r = await fetch('/auth/methods');
        if (r.ok) this.methods = await r.json();
      } catch (e) {
        console.error('[login] methods unavailable', e);
      }
    },

    fail(e) {
      this.error = t(ERROR_KEYS[e.message] || 'login.err.generic', { min: MIN_LENGTH });
    },

    async login() {
      this.error = '';
      this.busy = true;
      try {
        const r = await post('/auth/login', { email: this.email, password: this.password });
        if (r.mustChange) {
          this.mode = 'change';
          return;
        }
        location.assign('/');
      } catch (e) {
        this.fail(e);
      } finally {
        this.busy = false;
      }
    },

    async changePassword() {
      this.error = '';
      if (this.newPassword !== this.repeatPassword) {
        this.error = t('login.err.mismatch');
        return;
      }
      this.busy = true;
      try {
        await post('/auth/password', { email: this.email, password: this.password, newPassword: this.newPassword });
        location.assign('/');
      } catch (e) {
        this.fail(e);
      } finally {
        this.busy = false;
      }
    },
  };
}

async function boot() {
  // Same locale choice as the SPA (js/app.js).
  await configureI18n('de');
  Alpine.data('loginPage', loginPage);
  Alpine.start();
}

boot();
