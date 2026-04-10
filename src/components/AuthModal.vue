<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal auth-modal">
      <button class="modal-close" @click="$emit('close')">✕</button>
      <div class="auth-logo">⛳ GolfWizard</div>

      <div v-if="!emailSent">
        <h2 class="auth-title">Sign in to sync your rounds</h2>
        <p class="auth-sub">Your rounds, roster, and history — on any device.</p>

        <!-- Apple Sign In -->
        <button class="btn-auth btn-apple" @click="signInApple">
          <span class="auth-btn-icon">🍎</span> Continue with Apple
        </button>

        <!-- Google Sign In -->
        <button class="btn-auth btn-google" @click="signInGoogle">
          <span class="auth-btn-icon">G</span> Continue with Google
        </button>

        <div class="auth-divider"><span>or</span></div>

        <!-- Magic link -->
        <form @submit.prevent="signInEmail">
          <input
            v-model="email"
            type="email"
            class="auth-input"
            placeholder="your@email.com"
            required
          />
          <button type="submit" class="btn-auth btn-email" :disabled="sending">
            {{ sending ? 'Sending…' : 'Send magic link' }}
          </button>
        </form>

        <button class="btn-ghost auth-skip" @click="$emit('close')">
          Continue as guest
        </button>
      </div>

      <div v-else class="email-sent">
        <div class="sent-icon">📬</div>
        <h3>Check your email</h3>
        <p>We sent a sign-in link to <strong>{{ email }}</strong>. Tap the link to sign in.</p>
        <button class="btn-ghost" @click="emailSent = false">Try a different email</button>
      </div>

      <div v-if="error" class="auth-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits(['close'])
const authStore = useAuthStore()

const email = ref('')
const sending = ref(false)
const emailSent = ref(false)
const error = ref('')

async function signInApple() {
  try { await authStore.signInWithApple() }
  catch (e) { error.value = e.message }
}

async function signInGoogle() {
  try { await authStore.signInWithGoogle() }
  catch (e) { error.value = e.message }
}

async function signInEmail() {
  sending.value = true
  error.value = ''
  try {
    await authStore.signInWithEmail(email.value)
    emailSent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}
</script>
