// Users — domain module of the admin feature "users" (docs/auth.md). Methods
// spread into the feature card (js/cards/users-card.js); `this` is the card, so
// every field assigned here is declared in the card's initial state. Pure
// helpers are plain exports (unit-testable without Alpine).

import { api } from '../utils.js';

// Server error codes (lib/user-store.js, lib/password.js) → i18n keys.
const ERROR_KEYS = {
  'valid email required': 'users.err.email',
  'user exists': 'users.err.exists',
  'managed by env': 'users.err.envManaged',
  'password required': 'users.err.passwordRequired',
  'password too short': 'users.err.tooShort',
  'password too long': 'users.err.tooLong',
  'not found': 'users.err.notFound',
};

export function errorKey(message) {
  return ERROR_KEYS[message] || 'users.err.generic';
}

// Pure: env-managed accounts (the .env admin) first, then by email.
export function sortUsers(users) {
  return [...users].sort((a, b) => (b.env_managed - a.env_managed) || a.email.localeCompare(b.email));
}

// A random initial password the admin can hand over (unambiguous alphabet,
// 16 chars ≈ 90 bit). crypto.getRandomValues — never Math.random for secrets.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePassword(length = 16) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

export const usersMethods = {
  async loadUsers() {
    this.loading = true;
    this.loadError = '';
    try {
      this.users = sortUsers(await api('/api/admin/users'));
    } catch (e) {
      this.loadError = this.t(errorKey(e.message));
    } finally {
      this.loading = false;
    }
  },

  fillPassword() {
    this.draftPassword = generatePassword();
    this.showDraftPassword = true;
  },

  async createUser() {
    this.createError = '';
    this.createdEmail = '';
    this.busy = true;
    try {
      const user = await api('/api/admin/users', {
        method: 'POST',
        body: { email: this.draftEmail, display_name: this.draftName, password: this.draftPassword },
      });
      this.users = sortUsers([...this.users, user]);
      this.createdEmail = user.email;
      this.draftEmail = '';
      this.draftName = '';
      this.draftPassword = '';
      this.showDraftPassword = false;
    } catch (e) {
      this.createError = this.t(errorKey(e.message), { min: 12 });
    } finally {
      this.busy = false;
    }
  },

  // Listens for the item card's events.
  replaceUser(user) {
    this.users = this.users.map((u) => (u.email === user.email ? user : u));
  },
  removeUser(email) {
    this.users = this.users.filter((u) => u.email !== email);
  },
};
