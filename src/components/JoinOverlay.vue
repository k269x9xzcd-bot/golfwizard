<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal join-modal">
      <button class="modal-close" @click="$emit('close')">✕</button>
      <h2 class="join-title">⛳ Join a Round</h2>
      <p class="join-sub">Enter the 6-digit code from the round creator.</p>

      <div class="code-input-row">
        <input
          v-model="code"
          class="code-input"
          placeholder="ABC123"
          maxlength="6"
          @input="code = code.toUpperCase()"
          @keyup.enter="join"
        />
        <button class="btn-primary" :disabled="code.length < 6 || loading" @click="join">
          {{ loading ? '…' : 'Join' }}
        </button>
      </div>

      <div v-if="error" class="join-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoundsStore } from '../stores/rounds'

const emit = defineEmits(['close'])
const roundsStore = useRoundsStore()
const router = useRouter()

const code = ref('')
const loading = ref(false)
const error = ref('')

async function join() {
  loading.value = true
  error.value = ''
  try {
    await roundsStore.joinByRoomCode(code.value)
    emit('close')
    router.push('/scoring')
  } catch (e) {
    error.value = e.message || 'Room code not found'
  } finally {
    loading.value = false
  }
}
</script>
