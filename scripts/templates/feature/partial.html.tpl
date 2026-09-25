<!-- __LABEL_EN__ feature partial — loaded on first open into
     <section data-feature="__ID__"> (js/app/feature-host.js). The root element
     IS the feature card (x-data="__CARD__", js/cards/__ID__-card.js).
     Anatomy + patterns: DESIGN.md → Feature anatomy, Card, Card interior. -->

<div x-data="__CARD__">
  <div class="card card--__ID__">
    <div class="card-header">
      <div class="card-header-titlebar">
        <h2 class="card-title" x-text="t('__CAMEL__.title')"></h2>
        <span class="spinner" x-show="loading" aria-hidden="true"></span>
      </div>
    </div>

    <div class="card-empty" x-show="!loading && !items.length">
      <p class="card-empty-text" x-text="t('__CAMEL__.empty')"></p>
    </div>

    <ul class="__ID__-list" x-show="items.length">
      <template x-for="item in items" :key="item.id">
        <li x-text="item.title"></li>
      </template>
    </ul>
  </div>
</div>
