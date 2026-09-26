// User item — a sub-component of the users feature card. Each account in the
// list is its own instance via x-data="userItemCard(user)" (partials/users.html);
// it owns its dialogs + busy state and reports changes to the feature card via
// the `user-updated` / `user-removed` events. Env-managed accounts (the .env
// admin) render without actions — the server refuses them anyway.

import { api } from '../utils.js';
import { t } from '../i18n.js';
import { formatDate } from '../utils.js';
import { errorKey, generatePassword } from '../users/users-methods.js';

export function userItemCard(user) {
  return {
    user,
    busy: false,
    error: '',
    pwDraft: '',
    pwError: '',
    pwSaved: false,

    t,
    fmt: formatDate,

    get isDisabled() { return this.user.status === 'disabled'; },

    async patch(body) {
      this.busy = true;
      this.error = '';
      try {
        this.user = await api(`/api/admin/users/${encodeURIComponent(this.user.email)}`, { method: 'PATCH', body });
        this.$dispatch('user-updated', this.user);
      } catch (e) {
        this.error = t(errorKey(e.message));
      } finally {
        this.busy = false;
      }
    },

    toggleStatus() {
      return this.patch({ status: this.isDisabled ? 'active' : 'disabled' });
    },

    openPassword() {
      this.pwDraft = generatePassword();
      this.pwError = '';
      this.pwSaved = false;
      this.$refs.pwDlg.showModal();
    },

    async savePassword() {
      this.busy = true;
      this.pwError = '';
      try {
        this.user = await api(`/api/admin/users/${encodeURIComponent(this.user.email)}/password`, {
          method: 'PUT', body: { password: this.pwDraft },
        });
        this.pwSaved = true;
        this.$dispatch('user-updated', this.user);
      } catch (e) {
        this.pwError = t(errorKey(e.message), { min: 12 });
      } finally {
        this.busy = false;
      }
    },

    async remove() {
      this.busy = true;
      this.error = '';
      try {
        await api(`/api/admin/users/${encodeURIComponent(this.user.email)}`, { method: 'DELETE' });
        this.$refs.deleteDlg.close();
        this.$dispatch('user-removed', this.user.email);
      } catch (e) {
        this.error = t(errorKey(e.message));
        this.$refs.deleteDlg.close();
      } finally {
        this.busy = false;
      }
    },
  };
}

export function registerUserItemCard(Alpine) {
  Alpine.data('userItemCard', userItemCard);
}
