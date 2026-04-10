<template>
  <div class="view settings-view">
    <header class="view-header"><h2>Settings</h2></header>
    <div v-if="authStore.isAuthenticated" class="settings-section card">
      <div class="settings-title">Account</div>
      <div class="settings-row">
        <label>Display name</label>
        <input v-model="displayName" class="wiz-input" />
      </div>
      <div class="settings-row">
        <label>Short name</label>
        <input v-model="shortName" class="wiz-input wiz-input-sm" maxlength="6" />
      </div>
      <div class="settings-row">
        <label>GHIN index</label>
        <input v-model="ghin" type="number" step="0.1" class="wiz-input wiz-input-sm" />
      </div>
      <button class="btn-primary btn-sm" @click="save">Save</button>
      <button class="btn-ghost btn-sm" @click="authStore.signOut()">Sign Out</button>
    </div>
    <div v-else class="settings-section card">
      <p>Sign in to sync your data across devices.</p>
      <button class="btn-primary" @click="showAuth = true">Sign In</button>
    </div>
    <div class="settings-version">GolfWizard v3 · Supabase</div>
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import AuthModal from '../components/AuthModal.vue'
const authStore = useAuthStore()
const showAuth = ref(false)
const displayName = ref(authStore.profile?.display_name ?? '')
const shortName = ref(authStore.profile?.short_name ?? '')
const ghin = ref(authStore.profile?.ghin_index ?? '')
watch(() => authStore.profile, p => {
  if (p) { displayName.value = p.display_name; shortName.value = p.short_name; ghin.value = p.ghin_index }
})
async function save() {
  await authStore.updateProfile({ display_name: displayName.value, short_name: shortName.value, ghin_index: ghin.value || null })
}
</script>
