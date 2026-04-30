<template>
  <span class="ui-avatar" :class="`ui-avatar--${size}`" :style="bgStyle" :title="name">
    <span class="ui-avatar__initials">{{ initials }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  initials: { type: String, default: '' },
  size: { type: String, default: 'md', validator: v => ['sm','md','lg'].includes(v) },
  tint: { type: String, default: '' },
})

const computedInitials = computed(() => {
  if (props.initials) return props.initials
  const parts = (props.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase()
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
})

const bgStyle = computed(() => props.tint ? { background: props.tint } : {})
</script>

<style scoped>
.ui-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--gw-bg-surface-2);
  color: var(--gw-accent);
  font-family: var(--gw-font-body);
  font-weight: 500;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
[data-theme="light"] .ui-avatar {
  background: #e8faf0;
  color: #114a35;
}
.ui-avatar__initials { line-height: 1; }
.ui-avatar--sm { width: 28px; height: 28px; font-size: 11px; }
.ui-avatar--md { width: 40px; height: 40px; font-size: 13px; }
.ui-avatar--lg { width: 56px; height: 56px; font-size: 18px; }
</style>
