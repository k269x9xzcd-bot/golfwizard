<template>
  <Teleport to="body">
    <Transition name="ui-sheet">
      <div v-if="modelValue" class="ui-sheet-backdrop" @click.self="onBackdrop">
        <div class="ui-sheet" :class="{ 'ui-sheet--full': fullHeight }" role="dialog" aria-modal="true">
          <div class="ui-sheet__handle" />
          <header v-if="title || $slots.title" class="ui-sheet__header">
            <button v-if="back" class="ui-sheet__back" @click="$emit('back')" aria-label="Back">←</button>
            <h2 class="ui-sheet__title">
              <slot name="title">{{ title }}</slot>
            </h2>
            <button v-if="dismissible" class="ui-sheet__close" @click="close" aria-label="Close">×</button>
            <span v-else class="ui-sheet__close-spacer" />
          </header>
          <div v-if="hint || $slots.hint" class="ui-sheet__hint">
            <slot name="hint">{{ hint }}</slot>
          </div>
          <div class="ui-sheet__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  dismissible: { type: Boolean, default: true },
  back: { type: Boolean, default: false },
  fullHeight: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'back', 'close'])

function close() {
  emit('update:modelValue', false)
  emit('close')
}
function onBackdrop() {
  if (props.dismissible) close()
}
</script>

<style>
.ui-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 320;
  background: var(--gw-bg-overlay);
  display: flex;
  align-items: flex-end;
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}
.ui-sheet {
  width: 100%;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--gw-bg-sheet);
  border-radius: var(--gw-sheet-radius) var(--gw-sheet-radius) 0 0;
  padding: 0 0 env(safe-area-inset-bottom);
  box-shadow: var(--gw-shadow-sheet);
  -webkit-overflow-scrolling: touch;
}
.ui-sheet--full { max-height: 100vh; }
.ui-sheet__handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: var(--gw-border-default);
  margin: 12px auto 4px;
}
.ui-sheet__header {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--gw-border-subtle);
}
.ui-sheet__back, .ui-sheet__close {
  background: none; border: none;
  color: var(--gw-accent);
  font-size: 22px; line-height: 1;
  cursor: pointer; padding: 8px;
  -webkit-tap-highlight-color: transparent;
  border-radius: 8px;
}
.ui-sheet__back { font-size: 18px; }
.ui-sheet__back:active, .ui-sheet__close:active { background: var(--gw-bg-input); }
.ui-sheet__close { color: var(--gw-text-tertiary); justify-self: end; }
.ui-sheet__close-spacer { display: block; width: 40px; }
.ui-sheet__title {
  font-family: var(--gw-font-display);
  font-size: 18px;
  font-weight: 400;
  color: var(--gw-text-primary);
  margin: 0;
  text-align: center;
  letter-spacing: -0.005em;
}
.ui-sheet__hint {
  padding: 12px 20px 4px;
  text-align: center;
  font-size: 13px;
  color: var(--gw-text-tertiary);
  font-family: var(--gw-font-body);
}
.ui-sheet__body { padding: 12px 16px 20px; }

/* Transition */
.ui-sheet-enter-active, .ui-sheet-leave-active { transition: opacity .22s ease, transform .22s ease; }
.ui-sheet-enter-active .ui-sheet, .ui-sheet-leave-active .ui-sheet { transition: transform .26s cubic-bezier(.32,.72,0,1); }
.ui-sheet-enter-from, .ui-sheet-leave-to { opacity: 0; }
.ui-sheet-enter-from .ui-sheet, .ui-sheet-leave-to .ui-sheet { transform: translateY(100%); }
</style>
