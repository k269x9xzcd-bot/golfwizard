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

      <!-- Email mismatch warning -->
      <div v-if="emailMismatch" class="invite-mismatch-banner">
        ⚠️ This invite was sent to <strong>{{ inviteEmail }}</strong> — you're signed in as <strong>{{ authStore.user?.email }}</strong>. Round history may not link correctly.
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
        <button v-else-if="!ghinDone" class="invite-btn-primary" @click="showGhinStep = true">
          Set Up Your Handicap →
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

    <AuthModal v-if="showAuth" :prefill-email="inviteEmail" @close="onAuthClose" />

    <!-- GHIN setup step -->
    <Teleport to="body">
      <div v-if="showGhinStep" class="ghin-step-backdrop">
        <div class="ghin-step-sheet">
          <div class="ghin-step-header">
            <div class="ghin-step-title">Connect Your Handicap</div>
            <div class="ghin-step-sub">Pull your official GHIN index automatically</div>
          </div>

          <div class="ghin-step-fields">
            <div class="ghin-field-group">
              <label class="ghin-field-label">GHIN Number</label>
              <input v-model="ghinNum" class="wiz-input" placeholder="e.g. 1321498" type="text" inputmode="numeric" autocomplete="off" />
            </div>
            <div class="ghin-field-group">
              <label class="ghin-field-label">GHIN Password</label>
              <div class="ghin-pw-row">
                <input v-model="ghinPw" class="wiz-input" placeholder="GHIN password" :type="showPw ? 'text' : 'password'" autocomplete="off" />
                <button class="eye-btn" @click="showPw = !showPw" type="button">{{ showPw ? '🙈' : '👁️' }}</button>
              </div>
            </div>
          </div>

          <div v-if="ghinMsg" class="ghin-success-msg">{{ ghinMsg }}</div>
          <div v-if="ghinErr" class="ghin-error-msg">{{ ghinErr }}</div>

          <div class="ghin-step-actions">
            <button class="invite-btn-primary" :disabled="ghinSyncing || !ghinNum.trim() || !ghinPw.trim()" @click="syncGhin">
              {{ ghinSyncing ? 'Syncing…' : '↻ Sync My Handicap' }}
            </button>
            <button class="invite-btn-ghost" @click="skipGhin">Skip for now</button>
          </div>

          <div class="ghin-step-note">Your credentials are stored privately and never shared.</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { applyPreset, PRESET_PLAYERS } from '../modules/preset'
import { supabase } from '../supabase'
import AuthModal from '../components/AuthModal.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const seeding = ref(true)
const showAuth = ref(false)
const fromName = ref('Jason Spieler')

// GHIN step
const showGhinStep = ref(false)
const ghinDone = ref(false)
const ghinNum = ref('')
const ghinPw = ref('')
const showPw = ref(false)
const ghinSyncing = ref(false)
const ghinMsg = ref('')
const ghinErr = ref('')

const inviteEmail = computed(() => {
  const e = route.query.email
  return typeof e === 'string' ? decodeURIComponent(e) : ''
})

const inviteName = computed(() => {
  const n = route.query.name
  return typeof n === 'string' ? decodeURIComponent(n) : ''
})

const inviteRid = computed(() => {
  const r = route.query.rid
  return typeof r === 'string' ? decodeURIComponent(r) : ''
})

const emailMismatch = computed(() => {
  if (!authStore.isAuthenticated || !inviteEmail.value) return false
  return authStore.user?.email?.toLowerCase() !== inviteEmail.value.toLowerCase()
})

const playerNames = computed(() =>
  PRESET_PLAYERS.map(p => p.nickname || p.name.split(' ')[0]).join(', ')
)

async function onAuthClose() {
  showAuth.value = false
  if (!authStore.isAuthenticated) return

  // Bind this profile_id directly to the roster row from the invite
  if (inviteRid.value) {
    await supabase.from('roster_players')
      .update({ profile_id: authStore.user.id })
      .eq('id', inviteRid.value)
      .is('profile_id', null)
  }

  // Pre-fill display_name from invite if profile has no full name yet
  if (inviteName.value && authStore.profile?.display_name && !authStore.profile.display_name.includes(' ')) {
    await authStore.updateProfile({ display_name: inviteName.value })
  }

  // Prompt GHIN setup if they don't have it yet
  if (!authStore.profile?.ghin_number) {
    showGhinStep.value = true
  }
}

function skipGhin() {
  if (confirm('Skip GHIN setup? Your handicap won\'t sync automatically until you add it in Settings → Profile.')) {
    showGhinStep.value = false
    ghinDone.value = true
  }
}

async function syncGhin() {
  if (ghinSyncing.value) return
  ghinSyncing.value = true
  ghinMsg.value = ''
  ghinErr.value = ''
  try {
    // Save credentials first
    await supabase.from('profiles').update({
      ghin_number: ghinNum.value.trim(),
      ghin_password: ghinPw.value.trim(),
    }).eq('id', authStore.user.id)

    // Sync handicap
    const { data, error } = await supabase.functions.invoke('ghin-sync', {
      body: { ghin_number: ghinNum.value.trim(), password: ghinPw.value.trim() }
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)

    // Update profile with HCP and update their roster entry
    await authStore.updateProfile({ ghin_index: data.handicap_index })
    await authStore.upsertRosterEntry({
      name: authStore.profile?.display_name || '',
      nickname: authStore.profile?.nickname || null,
      useNickname: authStore.profile?.use_nickname || false,
    })

    // Also update ghin_number + ghin_index on their own roster entry
    if (authStore.user?.email) {
      await supabase.from('roster_players')
        .update({ ghin_number: ghinNum.value.trim(), ghin_index: data.handicap_index, ghin_synced_at: new Date().toISOString() })
        .eq('email', authStore.user.email)
    }

    ghinMsg.value = `✓ Handicap synced: ${data.hi_display} (${data.full_name})`
    setTimeout(() => {
      showGhinStep.value = false
      ghinDone.value = true
    }, 1800)
  } catch (e) {
    ghinErr.value = e?.message || 'Sync failed — check your GHIN credentials'
  } finally {
    ghinSyncing.value = false
  }
}

onMounted(async () => {
  // Pre-fill GHIN # and name from invite URL if provided
  const g = route.query.ghin
  if (g && typeof g === 'string') ghinNum.value = decodeURIComponent(g)

  await new Promise(r => setTimeout(r, 800))
  applyPreset(false)
  seeding.value = false

  if (inviteEmail.value && !authStore.isAuthenticated) {
    showAuth.value = true
  } else if (authStore.isAuthenticated) {
    await onAuthClose()
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

/* GHIN setup step */
.ghin-step-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.7);
  display: flex; align-items: flex-end;
}
.ghin-step-sheet {
  width: 100%;
  background: var(--gw-neutral-900, #141a16);
  border-radius: 24px 24px 0 0;
  padding: 28px 20px calc(env(safe-area-inset-bottom) + 28px);
  display: flex; flex-direction: column; gap: 20px;
}
.ghin-step-header { text-align: center; }
.ghin-step-title {
  font-family: var(--gw-font-display);
  font-size: 22px; font-weight: 700; color: var(--gw-text);
  margin-bottom: 6px;
}
.ghin-step-sub { font-size: 14px; color: rgba(240,237,224,.55); }
.ghin-step-fields { display: flex; flex-direction: column; gap: 14px; }
.ghin-field-group { display: flex; flex-direction: column; gap: 6px; }
.ghin-field-label { font-size: 12px; font-weight: 600; color: rgba(240,237,224,.6); }
.ghin-pw-row { display: flex; gap: 8px; align-items: center; }
.ghin-pw-row .wiz-input { flex: 1; }
.eye-btn { background: none; border: none; cursor: pointer; font-size: 18px; padding: 0 4px; }
.ghin-step-actions { display: flex; flex-direction: column; gap: 10px; }
.ghin-success-msg { font-size: 13px; color: #34d399; font-weight: 600; background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.2); border-radius: 8px; padding: 10px 12px; }
.ghin-error-msg { font-size: 13px; color: #f87171; background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); border-radius: 8px; padding: 10px 12px; }
.ghin-step-note { font-size: 11px; color: rgba(240,237,224,.3); text-align: center; }

.invite-mismatch-banner {
  background: rgba(251,191,36,.1);
  border: 1px solid rgba(251,191,36,.35);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 13px;
  color: rgba(240,237,224,.85);
  line-height: 1.5;
}
.invite-mismatch-banner strong { color: #fbbf24; }
</style>
