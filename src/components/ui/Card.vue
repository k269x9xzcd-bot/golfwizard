<template>
  <component
    :is="tag"
    class="ui-card"
    :class="[`ui-card--${variant}`, { 'ui-card--clickable': clickable, 'ui-card--accent': accent }]"
  >
    <slot />
  </component>
</template>

<script setup>
defineProps({
  tag: { type: String, default: 'div' },
  variant: {
    type: String,
    default: 'surface',
    validator: v => ['surface', 'elevated', 'flat'].includes(v),
  },
  clickable: { type: Boolean, default: false },
  accent: { type: Boolean, default: false },
})
</script>

<style scoped>
.ui-card {
  background: var(--gw-bg-surface);
  border-radius: var(--gw-card-radius);
  padding: 14px;
  color: var(--gw-text-primary);
  border: 1px solid transparent;
  text-align: left;
  width: 100%;
  font-family: var(--gw-font-body);
}
.ui-card--elevated {
  background: var(--gw-bg-surface);
  box-shadow: var(--gw-shadow-elev1);
}
.ui-card--flat {
  background: var(--gw-bg-input);
  border-color: var(--gw-border-subtle);
}
[data-theme="light"] .ui-card,
[data-theme="light"] .ui-card--elevated {
  border-color: var(--gw-border-subtle);
}
.ui-card--accent {
  border-left: 3px solid var(--gw-accent);
}
.ui-card--clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s, background .12s;
}
.ui-card--clickable:active { transform: scale(0.985); background: var(--gw-bg-surface-2); }
</style>
