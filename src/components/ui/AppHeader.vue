<template>
  <header class="ui-app-header" :class="{ 'ui-app-header--gradient': gradient }">
    <div v-if="$slots.left" class="ui-app-header__left"><slot name="left" /></div>
    <div class="ui-app-header__main">
      <h1 class="ui-app-header__title">{{ title }}</h1>
      <div v-if="subtitle || $slots.subtitle" class="ui-app-header__sub">
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
    </div>
    <div v-if="$slots.right" class="ui-app-header__right"><slot name="right" /></div>
    <div v-if="$slots.actions" class="ui-app-header__actions"><slot name="actions" /></div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  gradient: { type: Boolean, default: true },
})
</script>

<style scoped>
.ui-app-header {
  padding: 24px 20px 16px;
  background: var(--gw-bg-surface);
  position: relative;
}
.ui-app-header--gradient {
  background: linear-gradient(180deg, var(--gw-bg-surface-2) 0%, var(--gw-bg-surface) 100%);
}
[data-theme="light"] .ui-app-header,
[data-theme="light"] .ui-app-header--gradient {
  background: linear-gradient(180deg, #114a35 0%, #0d3325 100%);
  color: var(--gw-text-primary);
}
.ui-app-header__main { display: flex; flex-direction: column; gap: 4px; }
.ui-app-header__title {
  font-family: var(--gw-font-display);
  font-size: 30px;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--gw-text-primary);
  margin: 0;
}
[data-theme="light"] .ui-app-header__title { color: #f0ede0; }
.ui-app-header__sub {
  font-family: var(--gw-font-body);
  font-size: 13px;
  color: var(--gw-text-tertiary);
}
[data-theme="light"] .ui-app-header__sub { color: rgba(240,237,224,.7); }
.ui-app-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.ui-app-header__left,
.ui-app-header__right {
  position: absolute;
  top: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ui-app-header__left  { left: 16px; }
.ui-app-header__right { right: 16px; }
</style>
