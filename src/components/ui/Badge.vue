<template>
  <span class="ui-badge" :class="`ui-badge--${variant}`"><slot /></span>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'neutral', validator: v => ['neutral','success','warning','danger','accent'].includes(v) },
})
</script>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--gw-font-body);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 999px;
  line-height: 1;
}
.ui-badge--neutral { background: var(--gw-bg-input); color: var(--gw-text-tertiary); }
.ui-badge--success { background: rgba(34,197,94,.16); color: var(--gw-success-on-bg); }
[data-theme="light"] .ui-badge--success { background: #e8faf0; color: #166044; }
.ui-badge--warning { background: rgba(245,158,11,.16); color: #fbbf24; }
[data-theme="light"] .ui-badge--warning { background: #fef3c7; color: #78350f; }
.ui-badge--danger  { background: rgba(239,68,68,.16); color: var(--gw-danger-on-bg); }
[data-theme="light"] .ui-badge--danger  { background: #fee2e2; color: #b91c1c; }
.ui-badge--accent  { background: var(--gw-accent-soft); color: var(--gw-accent); }
</style>
