<template>
  <component
    :is="tag"
    class="ui-pill"
    :class="[
      `ui-pill--${variant}`,
      { 'ui-pill--active': active, 'ui-pill--block': block, 'ui-pill--sm': size === 'sm' }
    ]"
    v-bind="$attrs"
  >
    <slot />
  </component>
</template>

<script setup>
defineProps({
  tag: { type: String, default: 'button' },
  variant: { type: String, default: 'outline', validator: v => ['filled','outline','ghost','danger'].includes(v) },
  active: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  size: { type: String, default: 'md', validator: v => ['sm','md'].includes(v) },
})
</script>

<style scoped>
.ui-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  padding: 9px 16px;
  border-radius: var(--gw-pill-radius);
  border: 1px solid transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .1s, background .1s;
  white-space: nowrap;
  text-decoration: none;
}
.ui-pill:active { transform: scale(0.96); }
.ui-pill--sm { padding: 7px 12px; font-size: 12px; }
.ui-pill--block { width: 100%; }

.ui-pill--filled {
  background: var(--gw-accent);
  color: var(--gw-text-on-gold);
  border-color: var(--gw-accent);
}
.ui-pill--filled:active { background: var(--gw-accent-strong); }

.ui-pill--outline {
  background: transparent;
  color: var(--gw-accent);
  border-color: var(--gw-border-strong);
}
.ui-pill--outline.ui-pill--active {
  background: var(--gw-accent);
  color: var(--gw-text-on-gold);
}

.ui-pill--ghost {
  background: var(--gw-bg-input);
  color: var(--gw-text-secondary);
  border-color: transparent;
}
.ui-pill--ghost:active { background: var(--gw-bg-surface-2); }

.ui-pill--danger {
  background: transparent;
  color: var(--gw-danger);
  border-color: var(--gw-danger);
}
</style>
