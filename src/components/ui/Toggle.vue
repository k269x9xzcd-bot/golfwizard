<template>
  <label class="ui-toggle" :class="{ 'ui-toggle--on': modelValue }">
    <input
      type="checkbox"
      class="ui-toggle__input"
      :checked="modelValue"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="ui-toggle__track">
      <span class="ui-toggle__thumb" />
    </span>
    <span v-if="$slots.default" class="ui-toggle__label"><slot /></span>
  </label>
</template>

<script setup>
defineProps({ modelValue: { type: Boolean, required: true } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.ui-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-family: var(--gw-font-body);
  font-size: 13px;
  color: var(--gw-text-secondary);
  -webkit-tap-highlight-color: transparent;
}
.ui-toggle__input { position: absolute; opacity: 0; pointer-events: none; }
.ui-toggle__track {
  width: 38px; height: 22px;
  background: var(--gw-border-default);
  border-radius: 999px;
  position: relative;
  transition: background .18s ease;
  flex-shrink: 0;
}
.ui-toggle__thumb {
  position: absolute;
  left: 2px; top: 2px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform .18s cubic-bezier(.32,.72,0,1);
  box-shadow: 0 1px 2px rgba(0,0,0,.25);
}
.ui-toggle--on .ui-toggle__track { background: var(--gw-accent); }
.ui-toggle--on .ui-toggle__thumb { transform: translateX(16px); }
.ui-toggle__label { color: var(--gw-text-secondary); }
</style>
