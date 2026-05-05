<template>
  <button
    class="theme-toggle"
    :class="[`theme-toggle--${size}`, { 'is-light': theme === 'light' }]"
    @click="toggleTheme"
    :title="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    :aria-label="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    type="button"
  >
    <span class="tt-track">
      <span class="tt-icon tt-icon--sun" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4.2" fill="currentColor"/>
          <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="2.5" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="21.5"/>
            <line x1="2.5" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="21.5" y2="12"/>
            <line x1="5.3" y1="5.3" x2="7" y2="7"/>
            <line x1="17" y1="17" x2="18.7" y2="18.7"/>
            <line x1="5.3" y1="18.7" x2="7" y2="17"/>
            <line x1="17" y1="7" x2="18.7" y2="5.3"/>
          </g>
        </svg>
      </span>
      <span class="tt-icon tt-icon--moon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a.6.6 0 0 0-.8-.7 9.5 9.5 0 1 0 12.2 12.2.6.6 0 0 0-.7-.8z" fill="currentColor"/>
        </svg>
      </span>
      <span class="tt-thumb"></span>
    </span>
  </button>
</template>

<script setup>
import { useTheme } from '../../composables/useTheme'

defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v),
  },
})

const { theme, toggle: toggleTheme } = useTheme()
</script>

<style scoped>
.theme-toggle {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tt-track {
  position: relative;
  display: inline-block;
  border-radius: 999px;
  background: var(--gw-tt-track-bg, rgba(255,255,255,0.10));
  border: 1.5px solid var(--gw-tt-track-border, rgba(255,255,255,0.45));
  transition: background 0.25s, border-color 0.25s;
}

/* Sizes */
.theme-toggle--md .tt-track { width: 68px; height: 34px; }
.theme-toggle--sm .tt-track { width: 52px; height: 28px; }

/* Thumb */
.tt-thumb {
  position: absolute;
  top: 50%;
  border-radius: 50%;
  background: var(--gw-tt-thumb-bg, #f3f0e2);
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  transition: transform 0.25s cubic-bezier(.4,0,.2,1), background 0.25s;
}
.theme-toggle--md .tt-thumb {
  width: 26px; height: 26px;
  left: 3px;
  margin-top: -13px;
}
.theme-toggle--sm .tt-thumb {
  width: 20px; height: 20px;
  left: 3px;
  margin-top: -10px;
}

/* Thumb position: dark = left, light = right */
.theme-toggle--md.is-light .tt-thumb { transform: translateX(34px); }
.theme-toggle--sm.is-light .tt-thumb { transform: translateX(23px); }

/* Icons */
.tt-icon {
  position: absolute;
  top: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: color 0.2s, opacity 0.2s;
}
.theme-toggle--md .tt-icon { width: 18px; height: 18px; margin-top: -9px; }
.theme-toggle--sm .tt-icon { width: 14px; height: 14px; margin-top: -7px; }

.theme-toggle--md .tt-icon--sun  { left: 7px; }
.theme-toggle--md .tt-icon--moon { right: 7px; }
.theme-toggle--sm .tt-icon--sun  { left: 5px; }
.theme-toggle--sm .tt-icon--moon { right: 5px; }

.tt-icon svg { width: 100%; height: 100%; display: block; }

/* Active = bright; inactive = dim. Default state = dark mode → moon active. */
.tt-icon--sun  { color: var(--gw-tt-icon-dim, rgba(255,255,255,0.45)); }
.tt-icon--moon { color: var(--gw-tt-icon-active, #f3d35e); }

.theme-toggle.is-light .tt-icon--sun  { color: var(--gw-tt-icon-active-light, #d4a017); }
.theme-toggle.is-light .tt-icon--moon { color: var(--gw-tt-icon-dim-light, rgba(13,31,18,0.32)); }

/* Light theme overrides for track + thumb visibility */
:global([data-theme="light"]) .theme-toggle .tt-track {
  background: rgba(13,31,18,0.06);
  border-color: rgba(13,31,18,0.45);
}
:global([data-theme="light"]) .theme-toggle .tt-thumb {
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(13,31,18,0.18);
}
</style>
