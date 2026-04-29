<template>
  <div class="settings-view">
    <header class="view-header">
      <h2>Profile</h2>
    </header>

    <!-- Authenticated view -->
    <template v-if="authStore.isAuthenticated">
      <!-- Avatar card -->
      <div class="profile-card">
        <div class="avatar-ring">
          <div class="avatar-initials">{{ avatarInitials }}</div>
        </div>
        <div class="profile-email">{{ authStore.user?.email }}</div>
      </div>

      <!-- Form -->
      <div class="settings-form">
        <div class="form-section-label">Your Info</div>

        <div class="field-group">
          <label class="field-label">Email</label>
          <input class="wiz-input field-readonly" :value="authStore.user?.email" readonly type="email" />
        </div>

        <div class="field-row-split">
          <div class="field-group">
            <label class="field-label">First Name <span class="req-star">*</span></label>
            <input v-model="firstName" class="wiz-input" placeholder="e.g. Jason" type="text" autocomplete="given-name" />
          </div>
          <div class="field-group">
            <label class="field-label">Last Name <span class="req-star">*</span></label>
            <input v-model="lastName" class="wiz-input" placeholder="e.g. Spieler" type="text" autocomplete="family-name" />
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">
            Nickname
            <span class="field-hint"> — shown on scorecards when toggled on</span>
          </label>
          <input v-model="nickname" class="wiz-input" placeholder="e.g. Spiels" type="text" autocomplete="off" />
        </div>

        <div class="nickname-toggle-row" v-if="nickname.trim()">
          <span class="toggle-label">Use nickname on scorecards</span>
          <button class="toggle-btn" :class="{ active: useNickname }" @click="useNickname = !useNickname" type="button">
            <span class="toggle-knob"></span>
          </button>
        </div>

        <div class="field-group">
          <label class="field-label">GHIN Index</label>
          <input v-model="ghinIndex" class="wiz-input" placeholder="e.g. 14.2" type="number" step="0.1" />
        </div>

        <div v-if="saveError" class="error-msg">{{ saveError }}</div>
        <div v-if="saveSuccess" class="success-msg">✓ Profile saved!</div>

        <button class="btn-primary save-btn" :disabled="saving || !firstName.trim() || !lastName.trim()" @click="save">
          <span v-if="saving" class="saving-spinner">⟳</span>
          {{ saving ? 'Saving…' : 'Save Profile' }}
        </button>
      </div>

      <!-- GHIN Account section -->
      <div class="settings-form">
        <div class="form-section-label">GHIN Account</div>
        <p class="ghin-section-desc">Used to sync your official handicap index from USGA GHIN. Your credentials are stored privately and never shared.</p>

        <div class="field-group">
          <label class="field-label">GHIN Number</label>
          <input v-model="ghinNumber" class="wiz-input" placeholder="e.g. 1234567" type="text" inputmode="numeric" autocomplete="off" />
        </div>

        <div class="field-group">
          <label class="field-label">GHIN Password</label>
          <div class="password-row">
            <input v-model="ghinPassword" class="wiz-input" placeholder="GHIN password" :type="showGhinPassword ? 'text' : 'password'" autocomplete="off" />
            <button class="eye-btn" @click="showGhinPassword = !showGhinPassword" type="button">{{ showGhinPassword ? '🙈' : '👁️' }}</button>
          </div>
        </div>

        <div v-if="ghinSyncMsg" class="success-msg">{{ ghinSyncMsg }}</div>
        <div v-if="ghinSyncErr" class="error-msg">{{ ghinSyncErr }}</div>

        <button
          v-if="ghinNumber.trim() || ghinPassword.trim()"
          class="btn-secondary save-creds-btn"
          :disabled="ghinCredentialsSaving"
          @click="saveGhinCredentials"
        >
          {{ ghinCredentialsSaving ? 'Saving…' : 'Save GHIN Credentials' }}
        </button>
      </div>

      <div class="settings-footer">
        <button class="signout-btn btn-ghost" @click="authStore.signOut()">Sign Out</button>
      </div>
    </template>

    <!-- Guest view -->
    <template v-else>
      <div class="guest-card">
        <div class="guest-icon">⛳</div>
        <div class="guest-title">Sign in to GolfWizard</div>
        <div class="guest-sub">Save your rounds, sync across devices, and join tournaments.</div>
        <button class="btn-primary" @click="showAuth = true">Sign In</button>
      </div>
    </template>

    <div class="settings-version">GolfWizard v{{ appVersion }} · {{ buildDate }} {{ buildTime }} · <span class="settings-commit">{{ commitSha }}</span></div>
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../supabase'
import AuthModal from '../components/AuthModal.vue'
import { supaCall } from '../modules/supabaseOps'
import { supaRawRequest, supaRawUpdate } from '../modules/supaRaw'

const authStore = useAuthStore()
const showAuth = ref(false)

const firstName = ref('')
const lastName = ref('')
const nickname = ref('')
const useNickname = ref(false)
const ghinIndex = ref('')
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

// GHIN credentials
const ghinNumber = ref('')
const ghinPassword = ref('')
const showGhinPassword = ref(false)
const ghinSyncing = ref(false)
const ghinCredentialsSaving = ref(false)
const ghinSyncMsg = ref('')
const ghinSyncErr = ref('')

const appVersion = __APP_VERSION__
const buildStamp = __BUILD_STAMP__
const commitSha = __COMMIT_SHA__
const buildDate = __BUILD_DATE__
const buildTime = __BUILD_TIME__

const avatarInitials = computed(() => {
  const f = firstName.value.trim()
  const l = lastName.value.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  const email = authStore.user?.email || '?'
  return email[0].toUpperCase()
})

function populateFromProfile(p) {
  if (!p) return
  // Prefer dedicated columns; fall back to splitting display_name for existing profiles
  if (p.first_name || p.last_name) {
    firstName.value = p.first_name || ''
    lastName.value  = p.last_name  || ''
  } else if (p.display_name) {
    const parts = p.display_name.trim().split(/\s+/)
    firstName.value = parts[0] || ''
    lastName.value  = parts.slice(1).join(' ') || ''
  }
  nickname.value = p.nickname || ''
  useNickname.value = p.use_nickname || false
  ghinIndex.value = p.ghin_index != null ? String(p.ghin_index) : ''
  ghinNumber.value = p.ghin_number || ''
  ghinPassword.value = p.ghin_password || ''
}

onMounted(() => populateFromProfile(authStore.profile))
watch(() => authStore.profile, populateFromProfile)

async function save() {
  const f = firstName.value.trim()
  const l = lastName.value.trim()
  if (saving.value || !f || !l) return
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const fullName = [f, l].join(' ')
    const trimmedNick = nickname.value.trim() || null
    const profileData = {
      first_name: f,
      last_name: l,
      display_name: fullName,
      short_name: trimmedNick || l.slice(0, 8),
      nickname: trimmedNick,
      use_nickname: useNickname.value,
      ghin_index: ghinIndex.value !== '' ? parseFloat(ghinIndex.value) : null,
    }
    try {
      await supaCall('profiles.upsert', authStore.updateProfile(profileData), 3000)
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      await supaRawRequest('PATCH', `profiles?id=eq.${authStore.user.id}`, profileData, 8000)
      authStore.fetchProfile().catch(() => {})
    }

    const rosterData = {
      firstName: f,
      lastName: l,
      name: fullName,
      nickname: trimmedNick,
      useNickname: useNickname.value,
    }
    try {
      await supaCall('roster.upsert', authStore.upsertRosterEntry(rosterData), 3000)
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      const email = authStore.user?.email?.toLowerCase().trim()
      if (email) {
        const parts = fullName.split(/\s+/)
        const short_name = parts.length >= 2 ? parts[parts.length - 1].slice(0, 8) : fullName.slice(0, 8)
        await supaRawRequest('POST', 'roster_players', {
          name: fullName, short_name, email,
          nickname: trimmedNick || null,
          use_nickname: useNickname.value || false,
        }, 8000, { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => {})
      }
    }

    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2500)
  } catch (err) {
    saveError.value = err?.message || 'Save failed — please try again.'
  } finally {
    saving.value = false
  }
}

async function saveGhinCredentials() {
  if (ghinCredentialsSaving.value) return
  ghinCredentialsSaving.value = true
  ghinSyncErr.value = ''
  const num = ghinNumber.value.trim()
  const pwd = ghinPassword.value.trim()
  try {
    // Save GHIN credentials — 3s timeout, fall back to raw fetch on iOS stuck-socket
    try {
      await supaCall('profiles.upsert-ghin-creds', authStore.updateProfile({
        ghin_number: num || null,
        ghin_password: pwd || null,
      }), 3000)
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      await supaRawRequest('PATCH', `profiles?id=eq.${authStore.user.id}`, {
        ghin_number: num || null,
        ghin_password: pwd || null,
      }, 8000)
      authStore.fetchProfile().catch(() => {})
    }

    // Auto-sync handicap if both credentials present
    if (num && pwd) {
      ghinSyncMsg.value = 'Syncing handicap…'
      const { data: syncData, error: syncErr } = await supabase.functions.invoke('ghin-sync', {
        body: { ghin_number: num, password: pwd }
      })
      if (syncErr) throw syncErr
      if (syncData?.error) throw new Error(syncData.error)

      // Update ghin_index in profile — same timeout + raw fallback
      try {
        await supaCall('profiles.upsert-ghin-index', authStore.updateProfile({ ghin_index: syncData.handicap_index }), 3000)
      } catch (e) {
        if (!e.message?.includes('timed out')) throw e
        await supaRawRequest('PATCH', `profiles?id=eq.${authStore.user.id}`, { ghin_index: syncData.handicap_index }, 8000)
        authStore.fetchProfile().catch(() => {})
      }
      ghinIndex.value = String(syncData.handicap_index)

      // Update user's own roster_players row — match by email (profile_id may not be linked yet)
      const userEmail = authStore.user?.email?.toLowerCase().trim()
      if (userEmail) {
        const rosterPatch = {
          ghin_index: syncData.handicap_index,
          ghin_number: num,
          ghin_synced_at: new Date().toISOString(),
        }
        try {
          await supaCall('roster.update-ghin', supabase
            .from('roster_players')
            .update(rosterPatch)
            .eq('owner_id', authStore.user.id)
            .eq('email', userEmail), 3000)
        } catch (e) {
          if (!e.message?.includes('timed out')) throw e
          await supaRawUpdate('roster_players',
            `owner_id=eq.${authStore.user.id}&email=eq.${userEmail}`,
            rosterPatch, 8000).catch(() => {})
        }
      }

      ghinSyncMsg.value = `✓ Saved & synced: ${syncData.hi_display} (${syncData.full_name})`
    } else {
      ghinSyncMsg.value = '✓ GHIN credentials saved'
    }
    setTimeout(() => { ghinSyncMsg.value = '' }, 4000)
  } catch (err) {
    ghinSyncErr.value = err?.message || 'Save failed'
  } finally {
    ghinCredentialsSaving.value = false
  }
}

async function syncGhin() {
  if (ghinSyncing.value) return
  ghinSyncing.value = true
  ghinSyncMsg.value = ''
  ghinSyncErr.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('ghin-sync', {
      body: { ghin_number: ghinNumber.value.trim(), password: ghinPassword.value.trim() }
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    // Update ghin_index in profile
    await authStore.updateProfile({ ghin_index: data.handicap_index })
    ghinIndex.value = String(data.handicap_index)

    // Update matching roster_players row
    await supabase
      .from('roster_players')
      .update({
        ghin_index: data.handicap_index,
        ghin_number: ghinNumber.value.trim(),
        ghin_synced_at: new Date().toISOString(),
      })
      .eq('profile_id', authStore.user.id)

    ghinSyncMsg.value = `✓ Handicap synced: ${data.hi_display} (${data.full_name})`
    setTimeout(() => { ghinSyncMsg.value = '' }, 4000)
  } catch (err) {
    ghinSyncErr.value = err?.message || 'Sync failed — check your GHIN credentials'
  } finally {
    ghinSyncing.value = false
  }
}
</script>

<style scoped>
.settings-view {
  padding: 16px;
  padding-bottom: 100px;
  max-width: 480px;
  margin: 0 auto;
}

.settings-header { margin-bottom: 20px; }
.settings-title {
  font-family: var(--gw-font-display);
  font-size: 26px;
  font-weight: 700;
  color: var(--gw-text);
  margin: 0;
}

/* Profile avatar card */
.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px 20px;
  background: var(--gw-card-bg);
  border: 1px solid var(--gw-card-border);
  border-radius: var(--gw-radius-lg);
  margin-bottom: 20px;
}
.avatar-ring {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--gw-green-700, #166534), var(--gw-green-900, #052e16));
  border: 3px solid rgba(212,175,55,.4);
  display: flex; align-items: center; justify-content: center;
}
.avatar-initials {
  font-family: var(--gw-font-display);
  font-size: 26px; font-weight: 700;
  color: var(--gw-gold);
  letter-spacing: .02em;
}
.profile-email {
  font-size: 13px;
  color: rgba(240,237,224,.5);
}

/* Form */
.settings-form {
  background: var(--gw-card-bg);
  border: 1px solid var(--gw-card-border);
  border-radius: var(--gw-radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}
.form-section-label {
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(240,237,224,.5);
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.field-group { display: flex; flex-direction: column; gap: 5px; }
.field-label {
  font-size: 12px; font-weight: 600; color: rgba(240,237,224,.65);
}
.field-hint { font-weight: 400; color: rgba(240,237,224,.3); }
.field-readonly { opacity: 0.55; cursor: default; }

.ghin-section-desc {
  font-size: 12px; color: rgba(240,237,224,.4); line-height: 1.5; margin: 0;
}

.password-row {
  display: flex; gap: 8px; align-items: center;
}
.password-row .wiz-input { flex: 1; }
.eye-btn {
  background: none; border: none; cursor: pointer;
  font-size: 18px; padding: 0 4px; line-height: 1;
  -webkit-tap-highlight-color: transparent;
}

.sync-btn { background: var(--gw-green-500, #1a7a55); }
.btn-secondary {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  color: rgba(240,237,224,.7);
  border-radius: var(--gw-radius-full, 9999px);
  padding: 12px 20px;
  font-size: 15px; font-weight: 600;
  cursor: pointer; width: 100%;
  -webkit-tap-highlight-color: transparent;
}

/* Toggle */
.nickname-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 0;
}
.toggle-label { font-size: 13px; color: rgba(240,237,224,.7); font-weight: 500; }
.toggle-btn {
  width: 44px; height: 26px; border-radius: 13px;
  background: rgba(255,255,255,.12); border: none; cursor: pointer;
  position: relative; transition: background .2s; padding: 0; flex-shrink: 0;
}
.toggle-btn.active { background: #1a7a55; }
.toggle-knob {
  position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 50%; background: white;
  transition: transform .2s;
}
.toggle-btn.active .toggle-knob { transform: translateX(18px); }

/* Messages */
.error-msg {
  font-size: 13px; color: #f87171;
  background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2);
  border-radius: 8px; padding: 10px 12px;
}
.success-msg {
  font-size: 13px; color: #34d399; font-weight: 600;
  background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.2);
  border-radius: 8px; padding: 10px 12px;
}
.save-btn { opacity: 1; transition: opacity .15s; }
.save-btn:disabled { opacity: 0.5; }
.saving-spinner { display: inline-block; animation: spin .8s linear infinite; margin-right: 4px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Footer */
.settings-footer { display: flex; justify-content: center; margin-top: 4px; }
.signout-btn { color: rgba(240,237,224,.4); font-size: 14px; padding: 10px 24px; }

/* Guest card */
.guest-card {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 40px 20px; text-align: center;
  background: var(--gw-card-bg); border: 1px solid var(--gw-card-border);
  border-radius: var(--gw-radius-lg);
}
.guest-icon { font-size: 40px; }
.guest-title { font-size: 20px; font-weight: 700; color: var(--gw-text); }
.guest-sub { font-size: 14px; color: rgba(240,237,224,.55); line-height: 1.5; max-width: 280px; }

.settings-version {
  text-align: center; margin-top: 24px;
  font-size: 11px; color: rgba(240,237,224,.25); letter-spacing: .04em; line-height: 1.6;
}
.settings-commit {
  font-family: monospace; font-size: 10px; color: rgba(240,237,224,.15);
}
.field-row-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.req-star { color: #e53e3e; }
</style>