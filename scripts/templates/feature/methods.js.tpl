// __LABEL_EN__ — domain module of the feature. Methods spread into the feature
// card (js/cards/__ID__-card.js); `this` is the card, so every field assigned
// here must be declared in the card's initial state. Pure computations go into
// plain exported functions (unit-testable without Alpine).

// import { api } from '../utils.js';

export const __CAMEL__Methods = {
  async load__PASCAL__() {
    this.loading = true;
    try {
      // Replace with the real call once the route exists:
      //   this.items = await api('/api/__ID__');
      this.items = [];
    } finally {
      this.loading = false;
    }
  },
};
