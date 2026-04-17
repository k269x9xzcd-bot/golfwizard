<template>
  <div class="view invite-view">
    <!-- Seeding animation while we apply the preset -->
    <div v-if="seeding" class="invite-seeding">
      <div class="invite-spinner">⛳</div>
      <div class="invite-seeding-text">Setting up your group…</div>
    </div>

    <!-- Welcome card after seeding -->
    <div v-else class="invite-content">
      <div class="invite-hero">
        <div class="invite-logo">⛳ GolfWizard</div>
        <div class="invite-headline">
          <span class="invite-from">{{ fromName }}</span> invited you!
        </div>
        <div class="invite-sub">Your group's players and courses are ready to go.</div>
      </div>

      <!-- What was loaded -->
      <div class="invite-seeded-card">
        <div class="invite-seeded-title">✓ Pre-loaded for you</div>
        <div class="invite-seeded-item">
          <span class="isi-icon">⛳</span>
          <div class="isi-body">
            <div class="isi-label">Course</div>
            <div class="isi-val">Bonnie Briar Country Club · all tees</div>
          </div>
        </div>
        <div class="invite-seeded-item">
          <span class="isi-icon">👥</span>
          <div class="isi-body">
            <div class="isi-label">Players</div>
            <div class="isi-val">{{ playerNames }}</div>
          </div>
        </div>
      </div>

      <!-- Install instructions for PWA -->
      <div class="invite-install-card">
        <div class="invite-install-title">📱 Add to your Home Screen</div>
        <div class="invite-install-steps">
          <div class="iis-step">
            <span class="iis-num">1</span>
            <span>Tap the <strong>Share</strong> button (rectangle with arrow) at the bottom of Safari</span>
          </div>
          <div class="iis-step">
            <span class="iis-num">2</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
          </div>
          <div class="iis-step">
            <span class="iis-num">3</span>
            <span>Tap <strong>Add</strong> — GolfWizard appears on your home screen like a real app</span>
          </div>
        </div>
      </div>

      <!-- Sign in / Continue -->
      <div class="invite-actions">
        <button v-if="!authStore.isAuthenticated" class="invite-btn-primary" @click="showAuth = true">
          {{ inviteEmail ? `Sign In as ${inviteEmail.split('@')[0]} →` : 'Sign In with Email →' }}
        </button>
        <button v-else class="invite-btn-primary" @click="router.push('/')">
          Go to GolfWizard →
        </button>
        <button class="invite-btn-ghost" @click="router.push('/')">
          Continue without signing in
        </button>
      </div>

      <div class="invite-footer">
        GolfWizard · golf scoring for people who play for money 🏌️
      </div>
    </div>

    <AuthModal v-if="showAuth" :prefill-email="inviteEmail" @close="showAuth = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { applyPreset, PRESET_PLAYERS } from '../modules/preset'
import AuthModal from '../components/AuthModal.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const seeding = ref(true)
const showAuth = ref(false)
const fromName = ref('Jason Spieler')

// Email pre-filled from the invite link (?email=...)
const inviteEmail = computed(() => {
  const e = route.query.email
  return typeof e === 'string' ? decodeURIComponent(e) : ''
})

const playerNames = computed(() =>
  PRESET_PLAYERS.map(p => p.nickname || p.name.split(' ')[0]).join(', ')
)

onMounted(async () => {
  // Brief animation delay so the seeding feels intentional
  await new Promise(r => setTimeout(r, 800))
  // Never force-apply when authenticated — that overwrites real Supabase data.
  // For new (unauthenticated) users, apply once to seed the local roster + course.
  applyPreset(false)
  seeding.value = false

  // Auto-open auth modal when invite link contains an email and user isn't signed in.
  // This sends them straight to the OTP code entry screen without any extra taps.
  if (inviteEmail.value && !authStore.isAuthenticated) {
    showAuth.value = true
  }
})
</script>

<style scoped>
.invite-view {
  min-height: 100%;
  background: var(--gw-neutral-950);
  display: flex;
  flex-direction: column;
  padding-bottom: 40px;
}

/* Seeding state */
.invite-seeding {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
}
.invite-spinner {
  font-size: 48px;
  animation: invite-spin 1s ease-in-out infinite;
}
@keyframes invite-spin {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}
.invite-seeding-text {
  font-size: 16px;
  color: var(--gw-text-muted);
  font-weight: 600;
}

/* Welcome card */
.invite-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px 20px 24px;
}

.invite-hero {
  text-align: center;
  padding: 8px 0 4px;
}
.invite-logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--gw-text-muted);
  margin-bottom: 12px;
  letter-spacing: .02em;
}
.invite-headline {
  font-family: var(--gw-font-display);
  font-size: 28px;
  color: var(--gw-text);
  line-height: 1.2;
  margin-bottom: 8px;
}
.invite-from { color: var(--gw-gold); }
.invite-sub {
  font-size: 14px;
  color: rgba(240,237,224,.65);
  line-height: 1.45;
}

/* Seeded content card */
.invite-seeded-card {
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(34,197,94,.12) 0%, rgba(34,197,94,.03) 100%);
  border: 1px solid rgba(34,197,94,.4);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.invite-seeded-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #4ade80;
  margin-bottom: 2px;
}
.invite-seeded-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.isi-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
.isi-body { flex: 1; min-width: 0; }
.isi-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: rgba(240,237,224,.5);
  margin-bottom: 2px;
}
.isi-val {
  font-size: 13px;
  color: var(--gw-text);
  line-height: 1.45;
}

/* Install instructions */
.invite-install-card {
  padding: 16px;
  border-radius: 16px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.invite-install-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--gw-text);
}
.invite-install-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.iis-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: rgba(240,237,224,.75);
  line-height: 1.45;
}
.iis-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(212,175,55,.2);
  border: 1px solid rgba(212,175,55,.4);
  color: #d4af37;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.iis-step strong { color: var(--gw-text); font-weight: 700; }

/* Actions */
.invite-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.invite-btn-primary {
  padding: 15px;
  border-radius: 14px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d;
  border: none;
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: .3px;
  box-shadow: 0 2px 12px rgba(212,175,55,.3);
  -webkit-tap-highlight-color: transparent;
}
.invite-btn-primary:active { transform: scale(.98); }
.invite-btn-ghost {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.65);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.invite-footer {
  text-align: center;
  font-size: 11px;
  color: rgba(240,237,224,.3);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
