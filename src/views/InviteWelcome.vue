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

      <!-- Handoff code (shown after sign-in, while still in Safari) -->
      <div v-if="handoffCode" class="handoff-card">
        <div class="handoff-title">Open the GolfWizard app and enter this code</div>
        <div class="handoff-code">{{ handoffCode }}</div>
        <div class="handoff-timer" :class="{ 'handoff-timer--urgent': handoffSecsLeft < 60 }">
          Expires in {{ handoffSecsDisplay }}
        </div>
        <div class="handoff-hint">Tap the GolfWizard icon on your home screen, then tap "Have a code?" on the sign-in screen.</div>
      </div>

      <!-- Sign in / Continue -->
      <div class="invite-actions">
        <button v-if="!authStore.isAuthenticated" class="invite-btn-primary" @click="showAuth = true">
          {{ inviteEmail ? `Sign In as ${inviteEmail.split('@')[0]} →` : 'Sign In with Email →' }}
        </button>
        <button v-else-if="!ghinDone && !handoffCode" class="invite-btn-primary" @click="showGhinStep = true">
          Set Up Your Handicap →
        </button>
        <button v-else-if="!handoffCode" class="invite-btn-primary" @click="router.push('/')">
          Go to GolfWizard →
        </button>
        <button v-if="!authStore.isAuthenticated" class="invite-btn-ghost" @click="router.push('/')">
          Continue without signing in
        </button>
      </div>

      <div class="invite-footer">
        GolfWizard · golf scoring for people who play for money 🏌️
      </div>
    </div>

    <AuthModal v-if="showAuth" :prefill-email="inviteEmail" @close="onAuthClose" />

    <!-- Roster import offer -->
    <Teleport to="body">
      <div v-if="showRosterOffer" class="roster-offer-backdrop" @click.self="declineRosterImport">
        <div class="roster-offer-sheet">
          <div class="roster-offer-title">Import roster?</div>
          <div class="roster-offer-sub">{{ rosterOfferPlayers.length }} player{{ rosterOfferPlayers.length === 1 ? '' : 's' }} shared with you — add them to your roster?</div>
          <div class="roster-offer-list">
            <div v-for="p in rosterOfferPlayers" :key="p.name" class="roster-offer-player">
              <span class="rop-name">{{ p.name }}</span>
              <span v-if="p.ghin_index != null" class="rop-hi">{{ Number(p.ghin_index).toFixed(1) }}</span>
            </div>
          </div>
          <div class="roster-offer-actions">
            <button class="invite-btn-primary" :disabled="rosterOfferAccepting" @click="acceptRosterImport">
              {{ rosterOfferAccepting ? 'Importing…' : `Add ${rosterOfferPlayers.length} Player${rosterOfferPlayers.length === 1 ? '' : 's'}` }}
            </button>
            <button class="invite-btn-ghost" @click="declineRosterImport">No thanks</button>
          </div>
        </div>
      </div>
    </Teleport>

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

// Handoff code (Safari→PWA session transfer)
const handoffCode = ref(null)
const handoffSecsLeft = ref(300)
const handoffSecsDisplay = computed(() => {
  const m = Math.floor(handoffSecsLeft.value / 60)
  const s = handoffSecsLeft.value % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
})
let handoffInterval = null

async function generateHandoffCode() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data, error } = await supabase.rpc('create_handoff', {
      p_access_token: session.access_token,
      p_refresh_token: session.refresh_token,
    })
    if (error) { console.warn('[invite] create_handoff error:', error.message); return }
    handoffCode.value = data
    handoffSecsLeft.value = 300
    handoffInterval = setInterval(() => {
      handoffSecsLeft.value--
      if (handoffSecsLeft.value <= 0) {
        clearInterval(handoffInterval)
        handoffCode.value = null
      }
    }, 1000)
  } catch (e) {
    console.warn('[invite] generateHandoffCode failed:', e?.message)
  }
}

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

const inviteFirst = computed(() => {
  const n = route.query.first
  return typeof n === 'string' ? decodeURIComponent(n) : ''
})

const inviteLast = computed(() => {
  const n = route.query.last
  return typeof n === 'string' ? decodeURIComponent(n) : ''
})

const inviteRid = computed(() => {
  const r = route.query.rid
  return typeof r === 'string' ? decodeURIComponent(r) : ''
})

// Roster import offer (from shareRosterWith URL)
const showRosterOffer = ref(false)
const rosterOfferPlayers = ref([])
const rosterOfferAccepting = ref(false)

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

  // Pre-fill first_name/last_name from invite if profile has no full name yet
  if ((inviteFirst.value || inviteLast.value) && !authStore.profile?.first_name) {
    await authStore.updateProfile({
      first_name: inviteFirst.value || null,
      last_name:  inviteLast.value  || null,
      display_name: [inviteFirst.value, inviteLast.value].filter(Boolean).join(' ') || null,
    })
  }

  // Ensure the user has their own roster entry with correct name + GHIN so the
  // "YOU" pill appears immediately. This runs every time (upsert is safe).
  await upsertSelfRosterEntry()

  // Generate a handoff code so the user can sign into the PWA from Safari
  await generateHandoffCode()

  // Prompt GHIN setup if they don't have it yet (and no handoff to focus on)
  if (!authStore.profile?.ghin_number && !handoffCode.value) {
    showGhinStep.value = true
  }
}

async function upsertSelfRosterEntry() {
  if (!authStore.user?.id || !authStore.user?.email) return

  const firstName = inviteFirst.value || authStore.profile?.first_name || ''
  const lastName  = inviteLast.value  || authStore.profile?.last_name  || ''
  const selfName  = [firstName, lastName].filter(Boolean).join(' ')
                    || authStore.profile?.display_name
                    || authStore.user.email.split('@')[0]

  // Fetch GHIN data from the inviter's roster row for this player
  let ghinIndex  = authStore.profile?.ghin_index  ?? null
  let ghinNumber = authStore.profile?.ghin_number ?? null
  const rawGhin  = route.query.ghin
  if (!ghinNumber && rawGhin && typeof rawGhin === 'string') {
    ghinNumber = decodeURIComponent(rawGhin)
  }
  if (inviteRid.value && (ghinIndex == null || !ghinNumber)) {
    try {
      const { data: rRow } = await supabase
        .from('roster_players')
        .select('ghin_index, ghin_number')
        .eq('id', inviteRid.value)
        .maybeSingle()
      if (rRow) {
        if (ghinIndex  == null) ghinIndex  = rRow.ghin_index
        if (!ghinNumber)        ghinNumber = rRow.ghin_number
      }
    } catch {}
  }

  const nameParts = selfName.trim().split(/\s+/)
  const shortName = nameParts.length >= 2
    ? nameParts[nameParts.length - 1].slice(0, 8)
    : selfName.slice(0, 8)

  const selfRow = {
    owner_id:     authStore.user.id,
    user_id:      authStore.user.id,
    email:        authStore.user.email.toLowerCase(),
    name:         selfName,
    first_name:   nameParts[0] || null,
    last_name:    nameParts.slice(1).join(' ') || null,
    short_name:   shortName,
    nickname:     authStore.profile?.nickname      ?? null,
    use_nickname: authStore.profile?.use_nickname  ?? false,
    ghin_index:   ghinIndex,
    ghin_number:  ghinNumber ?? null,
    is_favorite:  false,
  }

  try {
    // Check if the user already owns a row with this email
    const { data: existing } = await supabase
      .from('roster_players')
      .select('id')
      .eq('owner_id', authStore.user.id)
      .eq('email', authStore.user.email.toLowerCase())
      .maybeSingle()

    if (existing) {
      await supabase.from('roster_players').update(selfRow).eq('id', existing.id)
    } else {
      await supabase.from('roster_players').insert(selfRow)
    }
  } catch (e) {
    console.warn('[invite] upsertSelfRosterEntry failed:', e?.message)
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
    const { supaCall: _sc } = await import('../modules/supabaseOps')
    const { supaRawUpdate: _ru, supaRawEdgeFunction: _ref } = await import('../modules/supaRaw')

    // Save credentials first
    try {
      const res = await _sc('profiles.ghin-creds', supabase.from('profiles').update({ ghin_number: ghinNum.value.trim(), ghin_password: ghinPw.value.trim() }).eq('id', authStore.user.id), 5000)
      if (res.error) throw res.error
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      await _ru('profiles', `id=eq.${authStore.user.id}`, { ghin_number: ghinNum.value.trim(), ghin_password: ghinPw.value.trim() }, 8000)
    }

    // Sync handicap
    const _ghinBody = { ghin_number: ghinNum.value.trim(), password: ghinPw.value.trim() }
    let data
    try {
      const r = await _sc('ghin-sync', supabase.functions.invoke('ghin-sync', { body: _ghinBody }), 8000)
      if (r.error) throw r.error
      if (r.data?.error) throw new Error(r.data.error)
      data = r.data
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      data = await _ref('ghin-sync', _ghinBody, 12000)
      if (data?.error) throw new Error(data.error)
    }

    // Update profile with HCP and update their roster entry
    await authStore.updateProfile({ ghin_index: data.handicap_index })
    await authStore.upsertRosterEntry({
      name: authStore.profile?.display_name || '',
      nickname: authStore.profile?.nickname || null,
      useNickname: authStore.profile?.use_nickname || false,
    })

    // Also update ghin_number + ghin_index on their own roster entry
    if (authStore.user?.email) {
      const rosterPatch = { ghin_number: ghinNum.value.trim(), ghin_index: data.handicap_index, ghin_synced_at: new Date().toISOString() }
      try {
        await _sc('roster.ghin-patch', supabase.from('roster_players').update(rosterPatch).eq('email', authStore.user.email), 5000)
      } catch (e) {
        if (!e.message?.includes('timed out')) throw e
        await _ru('roster_players', `email=eq.${authStore.user.email}`, rosterPatch, 8000).catch(() => {})
      }
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

async function acceptRosterImport() {
  rosterOfferAccepting.value = true
  try {
    const { useRosterStore } = await import('../stores/roster')
    const rStore = useRosterStore()
    for (const p of rosterOfferPlayers.value) {
      await rStore.addPlayer({
        name: p.name,
        email: p.email || null,
        ghin_index: p.ghin_index ?? null,
        ghin_number: p.ghin_number || null,
        short_name: p.short_name || null,
        nickname: p.nickname || null,
        use_nickname: p.use_nickname || false,
        is_favorite: true,
      })
    }
  } catch (e) {
    console.warn('[invite] roster import failed:', e)
  } finally {
    showRosterOffer.value = false
    rosterOfferAccepting.value = false
  }
}

function declineRosterImport() {
  showRosterOffer.value = false
}

onMounted(async () => {
  // Pre-fill GHIN # and name from invite URL if provided
  const g = route.query.ghin
  if (g && typeof g === 'string') ghinNum.value = decodeURIComponent(g)

  await new Promise(r => setTimeout(r, 800))
  await applyPreset(false)
  seeding.value = false

  // Check for roster snapshot in URL
  const rosterParam = route.query.roster
  if (rosterParam) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(rosterParam)))))
      if (Array.isArray(decoded) && decoded.length > 0) {
        // Sanitize: only accept known fields with expected types and lengths
        const ALLOWED_FIELDS = ['name', 'short_name', 'ghin_index', 'ghin_number', 'nickname', 'use_nickname']
        const sanitizePlayer = (p) => {
          if (!p || typeof p !== 'object') return null
          if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100) return null
          if (p.email !== undefined && p.email !== null) return null  // strip emails from URL roster
          if (p.ghin_index != null && typeof p.ghin_index !== 'number') return null
          if (p.ghin_number != null && typeof p.ghin_number !== 'string') return null
          if (p.nickname != null && typeof p.nickname !== 'string') return null
          const clean = {}
          for (const k of ALLOWED_FIELDS) if (p[k] !== undefined) clean[k] = p[k]
          clean.name = clean.name.trim()
          return clean
        }
        const sanitized = decoded.map(sanitizePlayer).filter(Boolean)
        if (sanitized.length > 0) {
          const { useRosterStore } = await import('../stores/roster')
          const rStore = useRosterStore()
          await rStore.fetchPlayers()
          const myNames = new Set(rStore.players.map(p => p.name?.toLowerCase()).filter(Boolean))
          const newOnes = sanitized.filter(p => !myNames.has(p.name.toLowerCase()))
          if (newOnes.length > 0) {
            rosterOfferPlayers.value = newOnes
            showRosterOffer.value = true
          }
        }
      }
    } catch (e) {
      console.warn('[invite] roster decode failed:', e)
    }
  }

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

/* Handoff code card */
.handoff-card {
  padding: 20px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(212,175,55,.15) 0%, rgba(212,175,55,.05) 100%);
  border: 1.5px solid rgba(212,175,55,.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.handoff-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(240,237,224,.75);
  letter-spacing: .02em;
}
.handoff-code {
  font-family: var(--gw-font-mono, monospace);
  font-size: 42px;
  font-weight: 800;
  letter-spacing: .25em;
  color: var(--gw-gold, #d4af37);
  line-height: 1;
  padding: 4px 0;
}
.handoff-timer {
  font-size: 12px;
  color: rgba(240,237,224,.5);
  font-weight: 600;
}
.handoff-timer--urgent { color: #f87171; }
.handoff-hint {
  font-size: 12px;
  color: rgba(240,237,224,.45);
  line-height: 1.5;
  max-width: 280px;
}

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

/* Roster import offer */
.roster-offer-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.7);
  display: flex; align-items: flex-end;
}
.roster-offer-sheet {
  width: 100%;
  background: var(--gw-neutral-900, #141a16);
  border-radius: 24px 24px 0 0;
  padding: 28px 20px calc(env(safe-area-inset-bottom) + 24px);
  display: flex; flex-direction: column; gap: 16px;
}
.roster-offer-title {
  font-family: var(--gw-font-display);
  font-size: 20px; font-weight: 700; color: var(--gw-text);
}
.roster-offer-sub {
  font-size: 14px; color: rgba(240,237,224,.6); line-height: 1.45; margin-top: -8px;
}
.roster-offer-list {
  display: flex; flex-direction: column; gap: 8px;
  max-height: 200px; overflow-y: auto;
}
.roster-offer-player {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255,255,255,.04);
  border-radius: 10px;
}
.rop-name { font-size: 14px; color: var(--gw-text); font-weight: 600; }
.rop-hi {
  font-size: 12px; color: rgba(240,237,224,.5);
  background: rgba(255,255,255,.06); border-radius: 6px; padding: 2px 8px;
}
.roster-offer-actions { display: flex; flex-direction: column; gap: 10px; }
</style>
