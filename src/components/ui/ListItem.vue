<template>
  <component
    :is="tag"
    class="ui-list-item"
    :class="[`ui-list-item--${variant}`, { 'ui-list-item--clickable': clickable }]"
    v-bind="$attrs"
  >
    <span v-if="$slots.lead" class="ui-list-item__lead"><slot name="lead" /></span>
    <span class="ui-list-item__main">
      <span class="ui-list-item__title"><slot /></span>
      <span v-if="$slots.subtitle" class="ui-list-item__sub"><slot name="subtitle" /></span>
    </span>
    <span v-if="$slots.trail" class="ui-list-item__trail"><slot name="trail" /></span>
  </component>
</template>

<script setup>
defineProps({
  tag: { type: String, default: 'div' },
  variant: { type: String, default: 'card', validator: v => ['card','flat'].includes(v) },
  clickable: { type: Boolean, default: false },
})
</script>

<style scoped>
.ui-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  font-family: var(--gw-font-body);
  color: var(--gw-text-primary);
  width: 100%;
  text-align: left;
  border: 0;
  text-decoration: none;
}
.ui-list-item--card {
  background: var(--gw-bg-surface);
  border-radius: var(--gw-card-radius);
  box-shadow: var(--gw-shadow-elev1);
}
[data-theme="light"] .ui-list-item--card {
  border: 1px solid var(--gw-border-subtle);
}
.ui-list-item--flat {
  background: transparent;
  border-bottom: 1px solid var(--gw-border-subtle);
  border-radius: 0;
}
.ui-list-item--clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .1s, background .12s;
}
.ui-list-item--clickable:active {
  transform: scale(0.99);
  background: var(--gw-bg-surface-2);
}
.ui-list-item__lead { flex-shrink: 0; }
.ui-list-item__main {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1; min-width: 0;
}
.ui-list-item__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-list-item__sub {
  font-size: 12px;
  color: var(--gw-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-list-item__trail {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
