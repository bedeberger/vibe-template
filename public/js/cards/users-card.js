// Users — the FEATURE CARD of the admin view (x-data="usersCard" at the root of
// partials/users.html). Owns the list + the create form; methods come from the
// domain module js/users/users-methods.js; lifecycle from card-lifecycle.js.
// Each listed account is a userItemCard sub-component.

import { t } from '../i18n.js';
import { formatDate } from '../utils.js';
import { usersMethods } from '../users/users-methods.js';
import { setupCardLifecycle } from './card-lifecycle.js';

export function usersCard() {
  return {
    // state (declared up front)
    users: [],
    loading: false,
    loadError: '',
    draftEmail: '',
    draftName: '',
    draftPassword: '',
    showDraftPassword: false,
    createError: '',
    createdEmail: '',
    busy: false,
    _lifecycle: null,

    t,
    fmt: formatDate,

    init() {
      this._lifecycle = setupCardLifecycle(this, {
        feature: 'users',
        load: (ctx) => ctx.loadUsers(),
        resetState: () => ({ users: [], draftEmail: '', draftName: '', draftPassword: '', createError: '', createdEmail: '' }),
      });
    },
    destroy() { this._lifecycle?.destroy(); },

    ...usersMethods,
  };
}

export function registerUsersCard(Alpine) {
  Alpine.data('usersCard', usersCard);
}
