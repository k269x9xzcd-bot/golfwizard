<template>
  <Teleport to="body">
    <Transition name="pwa-slide">
      <div v-if="visible" class="pwa-backdrop" @click.self="dismiss">
        <div class="pwa-sheet">
          <div class="pwa-handle"></div>

          <div class="pwa-header">
            <div class="pwa-logo">⛳</div>
            <div class="pwa-header-text">
              <div class="pwa-title">Add GolfWizard to your Home Screen</div>
              <div class="pwa-sub">Works like a real app — no App Store needed</div>
            </div>
          </div>

          <div class="pwa-steps">
            <div class="pwa-step">
              <div class="pwa-step-icon">
                <!-- Safari Share icon SVG -->
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="9" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>
                  <path d="M12 3v10M9 6l3-3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="pwa-step-text">
                Tap the <strong>Share</strong> button at the bottom of Safari
              </div>
            </div>

            <div class="pwa-step-arrow">↓</div>

            <div class="pwa-step">
              <div class="pwa-step-icon pwa-step-icon--add">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="1.8" fill="none"/>
                  <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="pwa-step-text">
                Scroll down and tap <strong>"Add to Home Screen"</strong>
              </div>
            </div>

            <div class="pwa-step-arrow">↓</div>

            <div class="pwa-step">
              <div class="pwa-step-icon pwa-step-icon--done">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/>
                  <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="pwa-step-text">
                Tap <strong>Add</strong> — GolfWizard is on your Home Screen!
              </div>
            </div>
          </div>

          <div class="pwa-actions">
            <button class="pwa-btn-dismiss" @click="dismiss">Got it</button>
            <button class="pwa-btn-later" @click="later">Maybe later</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'gw_pwa_prompted'
const LATER_KEY   = 'gw_pwa_later_ts'
const LATER_DELAY = 3 * 24 * 60 * 60 * 1000  // re-prompt after 3 days if "later"

const visible = ref(false)

function isIosSafari() {
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // Safari on iOS: has 'Safari' but not 'CriOS' (Chrome) or 'FxiOS' (Firefox)
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua)
  return isIos && isSafari
}

function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}

function shouldShow() {
  // Only on iOS Safari, not already installed
  if (!isIosSafari() || isStandalone()) return false
  // Don't show if permanently dismissed
  if (localStorage.getItem(STORAGE_KEY) === 'dismissed') return false
  // Don't show if user said "later" within the delay window
  const laterTs = localStorage.getItem(LATER_KEY)
  if (laterTs && Date.now() - parseInt(laterTs) < LATER_DELAY) return false
  return true
}

function dismiss() {
  visible.value = false
  localStorage.setItem(STORAGE_KEY, 'dismissed')
}

function later() {
  visible.value = false
  localStorage.setItem(LATER_KEY, String(Date.now()))
}

onMounted(() => {
  // Delay slightly so it doesn't fire on top of the splash screen
  setTimeout(() => {
    if (shouldShow()) visible.value = true
  }, 2500)
})
</script>

<style scoped>
.pwa-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
}

.pwa-sheet {
  width: 100%;
  background: var(--gw-neutral-900, #141a16);
  border-radius: 24px 24px 0 0;
  padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 28px);
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.5);
}

.pwa-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 auto 4px;
}

.pwa-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.pwa-logo {
  font-size: 36px;
  flex-shrink: 0;
}

.pwa-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
  line-height: 1.3;
  margin-bottom: 3px;
}

.pwa-sub {
  font-size: 13px;
  color: rgba(240, 237, 224, 0.5);
}

.pwa-steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px;
}

.pwa-step {
  display: flex;
  align-items: center;
  gap: 14px;
}

.pwa-step-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(22, 163, 74, 0.15);
  border: 1px solid rgba(22, 163, 74, 0.3);
  color: #4ade80;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pwa-step-icon--add {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.pwa-step-icon--done {
  background: rgba(212, 175, 55, 0.15);
  border-color: rgba(212, 175, 55, 0.3);
  color: #d4af37;
}

.pwa-step-text {
  font-size: 14px;
  color: rgba(240, 237, 224, 0.8);
  line-height: 1.4;
}

.pwa-step-text strong {
  color: var(--gw-text, #f0ede0);
  font-weight: 700;
}

.pwa-step-arrow {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.2);
  text-align: center;
  padding-left: 20px;
}

.pwa-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pwa-btn-dismiss {
  padding: 15px;
  border-radius: 14px;
  background: linear-gradient(145deg, #edd655, #d4af37 50%, #b8961e);
  color: #0c0f0d;
  border: none;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.pwa-btn-dismiss:active { transform: scale(0.98); }

.pwa-btn-later {
  padding: 12px;
  border-radius: 14px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(240, 237, 224, 0.5);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* Slide-up transition */
.pwa-slide-enter-active,
.pwa-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.pwa-slide-enter-from,
.pwa-slide-leave-to {
  transform: translateY(100%);
}
</style>
