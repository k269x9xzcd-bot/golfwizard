<template>
  <Teleport to="body">
    <div class="auth-backdrop" @click.self="$emit('close')">
      <div class="auth-sheet">

        <!-- Logo -->
        <div class="auth-logo">
          <span class="auth-logo-icon">⛳</span>
          <span class="auth-logo-text">GolfWizard</span>
        </div>

        <!-- Step 1: Enter email -->
        <div v-if="step === 'email'" class="auth-body">
          <h2 class="auth-title">Sign in to sync your rounds</h2>
          <p class="auth-sub">Your rounds, roster, and history — on every device.</p>

          <form @submit.prevent="sendOtp" class="auth-form">
            <label class="auth-label" for="auth-email">Email address</label>
            <input
              v-model="email"
              type="email"
              class="auth-input"
              placeholder="you@example.com"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              name="email"
              id="auth-email"
              required
            />
            <button
              type="submit"
              class="btn-magic"
              :disabled="sending || !email.trim()"
            >
              <span v-if="sending" class="btn-spinner">⟳</span>
              <span v-else>✉️</span>
              {{ sending ? 'Sending code…' : 'Send sign-in code' }}
            </button>
          </form>

          <div v-if="error" class="auth-error">
            <span class="error-icon">⚠️</span> {{ error }}
          </div>

          <div class="auth-divider"><span>or</span></div>

          <button class="btn-guest" @click="$emit('close')">
            Continue as guest
            <span class="guest-note">Data saved locally on this device</span>
          </button>
        </div>

        <!-- Step 2: Enter sign-in code -->
        <div v-else-if="step === 'otp'" class="auth-body">
          <div class="otp-icon">📬</div>
          <h2 class="auth-title">Check your email</h2>
          <p class="auth-sub">
            We sent a sign-in code to<br>
            <strong class="auth-email-highlight">{{ email }}</strong>
          </p>

          <form @submit.prevent="verifyOtp" class="auth-form">
            <label class="auth-label" for="auth-otp">Enter code</label>
            <input
              v-model="otp"
              type="text"
              class="auth-input auth-input--otp"
              placeholder="000000"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              minlength="6"
              id="auth-otp"
              name="otp"
              pattern="[0-9]{6}"
              required
              ref="otpInput"
            />
            <button
              type="submit"
              class="btn-magic"
              :disabled="verifying || otp.length < 6"
            >
              <span v-if="verifying" class="btn-spinner">⟳</span>
              <span v-else>✓</span>
              {{ verifying ? 'Verifying…' : 'Sign in' }}
            </button>
          </form>

          <div v-if="error" class="auth-error">
            <span class="error-icon">⚠️</span> {{ error }}
          </div>

          <button class="btn-retry" @click="resetForm">
            ← Try a different email
          </button>
        </div>

        <!-- Step 3: Success -->
        <div v-else-if="step === 'success'" class="auth-body auth-body--success">
          <div class="success-icon">🎉</div>
          <h2 class="auth-title">You're signed in!</h2>
          <p class="auth-sub">Welcome to GolfWizard. Your rounds are now syncing to the cloud.</p>
          <button class="btn-magic" @click="$emit('close')">Let's play →</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits(['close'])
const authStore = useAuthStore()

const step = ref('email')
const email = ref('')
const otp = ref('')
const sending = ref(false)
const verifying = ref(false)
const error = ref('')
const otpInput = ref(null)

async function sendOtp() {
  if (!email.value.trim()) return
  sending.value = true
  error.value = ''
  try {
    await authStore.signInWithEmail(email.value.trim())
    step.value = 'otp'
    // Focus OTP input after transition
    await nextTick()
    setTimeout(() => otpInput.value?.focus(), 100)
  } catch (e) {
    error.value = e.message || 'Could not send code. Please try again.'
  } finally {
    sending.value = false
  }
}

async function verifyOtp() {
  if (otp.value.length < 6) return
  verifying.value = true
  error.value = ''
  try {
    await authStore.verifyOtp(email.value.trim(), otp.value.trim())
    step.value = 'success'
    // Auto-close after 2 seconds
    setTimeout(() => emit('close'), 2000)
  } catch (e) {
    error.value = e.message || 'Invalid code. Please check and try again.'
    otp.value = ''
  } finally {
    verifying.value = false
  }
}

function resetForm() {
  step.value = 'email'
  otp.value = ''
  error.value = ''
}
</script>

<style scoped>
/* ── Backdrop ────────────────────────────────────────────── */
.auth-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 34, 24, 0.55);
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(3px);
  animation: fade-in .2s ease;
}

/* ── Sheet ───────────────────────────────────────────────── */
.auth-sheet {
  width: 100%;
  max-width: 480px;
  background: white;
  border-radius: 24px 24px 0 0;
  padding: 0 0 env(safe-area-inset-bottom);
  animation: slide-up .28s cubic-bezier(.32,1,.28,1);
}

/* ── Logo ────────────────────────────────────────────────── */
.auth-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 24px 0;
}
.auth-logo-icon { font-size: 28px; }
.auth-logo-text {
  font-family: var(--gw-font-display);
  font-size: 26px;
  color: var(--gw-green-700);
}

/* ── Body ────────────────────────────────────────────────── */
.auth-body {
  padding: 20px 24px 28px;
}
.auth-body--success {
  text-align: center;
}

.auth-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-neutral-900);
  margin: 0 0 6px;
  text-align: center;
}
.auth-sub {
  font-size: 14px;
  color: var(--gw-neutral-500);
  text-align: center;
  margin: 0 0 24px;
  line-height: 1.6;
}
.auth-email-highlight {
  color: var(--gw-neutral-900);
}

/* ── OTP icon ────────────────────────────────────────────── */
.otp-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 8px;
}
.success-icon {
  font-size: 52px;
  text-align: center;
  margin-bottom: 12px;
}

/* ── Form ────────────────────────────────────────────────── */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}
.auth-label {
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-neutral-600);
}
.auth-input {
  width: 100%;
  box-sizing: border-box;
  padding: 15px 16px;
  font-family: var(--gw-font-body);
  font-size: 16px;
  color: var(--gw-neutral-900);
  background: var(--gw-neutral-50);
  border: 1.5px solid var(--gw-neutral-200);
  border-radius: var(--gw-radius-md);
  outline: none;
  transition: border-color .2s;
  -webkit-appearance: none;
  appearance: none;
}
.auth-input:focus {
  border-color: var(--gw-green-400);
  background: white;
}
.auth-input--otp {
  font-family: var(--gw-font-mono);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-align: center;
  padding: 16px;
}

/* ── Button ──────────────────────────────────────────────── */
.btn-magic {
  width: 100%;
  padding: 16px;
  background: var(--gw-green-500);
  color: white;
  border: none;
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background .15s, transform .1s;
  -webkit-tap-highlight-color: transparent;
}
.btn-magic:active:not(:disabled) {
  background: var(--gw-green-600);
  transform: scale(.98);
}
.btn-magic:disabled {
  opacity: .5;
  cursor: default;
}
.btn-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

/* ── Error ───────────────────────────────────────────────── */
.auth-error {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--gw-radius-sm);
  padding: 10px 14px;
  font-size: 13px;
  color: #991b1b;
  margin-top: 8px;
}

/* ── Divider ─────────────────────────────────────────────── */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0;
  color: var(--gw-neutral-300);
  font-size: 13px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--gw-neutral-200);
}

/* ── Guest button ────────────────────────────────────────── */
.btn-guest {
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: 1.5px solid var(--gw-neutral-200);
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 15px;
  font-weight: 500;
  color: var(--gw-neutral-700);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  -webkit-tap-highlight-color: transparent;
}
.btn-guest:active {
  background: var(--gw-neutral-50);
}
.guest-note {
  font-size: 11px;
  color: var(--gw-neutral-400);
  font-weight: 400;
}

/* ── Retry ───────────────────────────────────────────────── */
.btn-retry {
  display: block;
  width: 100%;
  text-align: center;
  background: none;
  border: none;
  color: var(--gw-green-600);
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 12px 8px 0;
  -webkit-tap-highlight-color: transparent;
}

/* ── Animations ──────────────────────────────────────────── */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
