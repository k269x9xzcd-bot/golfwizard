<template>
  <div class="view home-view">
    <header class="view-header">
      <div class="header-logo-group">
        <div class="header-logo">⛳ GolfWizard</div>
        <div class="header-version">v{{ appVersion }}</div>
      </div>
      <div class="header-actions">
        <button class="help-btn" @click="showHelp = true" title="Help & Support">?</button>
        <button v-if="!authStore.isAuthenticated" class="btn-signin" @click="showAuth = true">
          Sign In
        </button>
        <RouterLink v-else to="/settings" class="avatar-btn">
          {{ authStore.profile?.short_name?.[0] ?? authStore.profile?.display_name?.[0] ?? '👤' }}
        </RouterLink>
      </div>
    </header>


    <!-- Active round card — ONLY for non-tournament rounds -->
    <div
      v-if="roundsStore.activeRound && !roundsStore.activeRound.is_complete && !isTournamentRound"
      class="active-round-card card"
      @click="$router.push('/scoring')"
    >
      <div class="card-label">In Progress</div>
      <div class="card-title">{{ roundsStore.activeRound.course_name }}</div>
      <div class="card-sub">{{ roundsStore.activeRound.date }} · {{ roundsStore.activeMembers.length }} players</div>
      <div class="card-cta">Continue →</div>
    </div>

    <!-- Active cross-match banner (host/round owner) -->
    <CrossMatchBanner />

    <!-- Pending 4v4 match invites banner -->
    <div
      v-for="invite in linkedStore.pendingInvites"
      :key="invite.id"
      class="match-invite-banner"
      @click="$router.push(`/accept/${invite.invite_code}`)"
    >
      <div class="mib-icon">⚔️</div>
      <div class="mib-body">
        <div class="mib-title">You're invited to a 4v4</div>
        <div class="mib-sub">{{ invite.name }} · tap to accept and start scoring</div>
      </div>
      <div class="mib-arrow">›</div>
    </div>

    <button class="new-round-pill" @click="openWizard()">+ New Round</button>

    <!-- 4v4 Cross Match entry card -->
    <RouterLink to="/cross-match/new" class="cm-home-card" v-if="authStore.isAuthenticated">
      <div class="cm-home-icon">⚔️</div>
      <div class="cm-home-body">
        <div class="cm-home-title">4v4 Cross Match</div>
        <div class="cm-home-sub">Challenge another foursome · best ball · side bets</div>
      </div>
      <div class="cm-home-arrow">›</div>
    </RouterLink>

    <!-- Tournament / Cup entry card (only for authorized users) -->
    <template v-if="showTournament">
      <!-- Cup with in-progress tournament round nested -->
      <div v-if="isTournamentRound" class="cup-home-card cup-home-card--active">
        <RouterLink to="/tournament" class="cup-home-header">
          <div class="cup-home-icon">🏆</div>
          <div class="cup-home-body">
            <div class="cup-home-title">The Cup</div>
            <div class="cup-home-sub">Tournament in progress</div>
          </div>
          <div class="cup-home-arrow">›</div>
        </RouterLink>
        <div class="cup-active-round" @click="$router.push('/scoring')">
          <div class="car-badge">LIVE</div>
          <div class="car-body">
            <div class="car-title">{{ roundsStore.activeRound.name || roundsStore.activeRound.course_name }}</div>
            <div class="car-sub">{{ roundsStore.activeRound.course_name }} · {{ roundsStore.activeMembers.length }} players</div>
          </div>
          <div class="car-cta">Continue →</div>
        </div>
      </div>
      <!-- Cup without active tournament round -->
      <RouterLink v-else to="/tournament" class="cup-home-card">
        <div class="cup-home-icon">🏆</div>
        <div class="cup-home-body">
          <div class="cup-home-title">The Cup</div>
          <div class="cup-home-sub">Tournament standings & matches</div>
        </div>
        <div class="cup-home-arrow">›</div>
      </RouterLink>
    </template>


    <!-- Recent rounds -->
    <section v-if="roundsStore.rounds.length" class="section">
      <h2 class="section-title">Recent Rounds</h2>
      <div class="rounds-list">
        <div
          v-for="round in roundsStore.rounds.slice(0, 5)"
          :key="round.id"
          class="round-card card"
          role="button"
          tabindex="0"
          @click="openRound(round.id)"
          @keydown.enter="openRound(round.id)"
        >
          <div class="round-course">
            {{ round.course_name }}
            <span v-if="round.is_complete" class="round-badge round-badge--done">Final</span>
            <span v-else class="round-badge round-badge--live">In Progress</span>
          </div>
          <div class="round-players">{{ roundPlayerNames(round) }}</div>
          <div class="round-date">{{ round.date }}</div>
        </div>
      </div>
    </section>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-icon">⛳</div>
      <div class="empty-title">No rounds yet</div>
      <div class="empty-sub">Start tracking your round</div>
      <button class="new-round-pill" @click="openWizard()">+ New Round</button>
    </div>

    <!-- Auth modal -->
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>

    <!-- Help sheet -->
    <HelpView v-model="showHelp" :app-version="appVersion" />
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useTournamentStore } from '../stores/tournament.js'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import AuthModal from '../components/AuthModal.vue'
import HelpView from './HelpView.vue'
import CrossMatchBanner from '../components/CrossMatchBanner.vue'

const appVersion = __APP_VERSION__

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const tournamentStore = useTournamentStore()
const linkedStore = useLinkedMatchesStore()
const router = useRouter()
const showAuth = ref(false)
const showHelp = ref(false)
const openWizard = inject('openWizard', () => {})
const showTournament = computed(() => {
  const email = authStore.user?.email
  if (!email) return false
  const norm = email.toLowerCase().trim()
  if (tournamentStore.members.length > 0) {
    return tournamentStore.members.some(m => m.email?.toLowerCase().trim() === norm)
  }
  const AUTHORIZED = [
    'jayspieler@aol.com',
    'alexcarroll333@gmail.com','bcimons19@yahoo.com',
    'jcourt93@gmail.com','craggo@recordandreturn.com',
    'matt@derosasports.com','bonga13@gmail.com',
    'martydurkin17@verizon.net',
  ]
  return AUTHORIZED.includes(norm)
})
const isTournamentRound = computed(() => {
  const r = roundsStore.activeRound
  return !!(r && r.format === 'tournament')
})

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await roundsStore.fetchRounds()
    tournamentStore.init()
    linkedStore.fetchUserLinkedMatches()
    linkedStore.fetchPendingInvites()
  }
})

watch(() => authStore.isAuthenticated, async (authed) => {
  if (authed) {
    if (roundsStore.rounds.length === 0) await roundsStore.fetchRounds()
    tournamentStore.init()
    linkedStore.fetchUserLinkedMatches()
    linkedStore.fetchPendingInvites()
  }
})

function roundPlayerNames(round) {
  const members = round.round_members || []
  if (!members.length) return '—'
  return members.map(m => {
    const full = m.guest_name || ''
    const parts = full.trim().split(/\s+/)
    return parts.length >= 2 ? parts[parts.length - 1] : (m.short_name || full || '?')
  }).join(' · ')
}

async function openRound(id) {
  const r = roundsStore.rounds.find(x => x.id === id)
  if (r?.is_complete) {
    router.push({ path: '/history', query: { expand: id } })
    return
  }
  try {
    await roundsStore.loadRound(id)
    router.push('/scoring')
  } catch (e) {
    console.error('[Home] openRound failed:', e)
    alert('Could not open round: ' + (e?.message || 'unknown error'))
  }
}
</script>

<style scoped>
.match-invite-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 16px 0;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(212,175,55,.15) 0%, rgba(212,175,55,.05) 100%);
  border: 1px solid rgba(212,175,55,.45);
  border-radius: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: pulse-gold 2.5s ease-in-out infinite;
}
.match-invite-banner:active { transform: scale(.98); }
@keyframes pulse-gold {
  0%, 100% { border-color: rgba(212,175,55,.45); }
  50% { border-color: rgba(212,175,55,.8); }
}
.mib-icon { font-size: 26px; flex-shrink: 0; }
.mib-body { flex: 1; min-width: 0; }
.mib-title { font-family: var(--gw-font-display); font-size: 15px; font-weight: 700; color: var(--gw-gold); }
.mib-sub { font-size: 12px; color: rgba(240,237,224,.6); margin-top: 2px; }
.mib-arrow { font-size: 22px; color: var(--gw-gold); opacity: .7; }

.new-round-pill {
  display: block;
  width: calc(100% - 32px);
  margin: 16px 16px 0;
  padding: 14px 20px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d;
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-radius: 28px;
  cursor: pointer;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 12px rgba(212,175,55,.3);
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s, box-shadow .12s;
}
.new-round-pill:active {
  transform: scale(0.95);
  box-shadow: 0 1px 6px rgba(212,175,55,.2);
}

.cup-home-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 10px 16px 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(212,175,55,.12) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.3);
  text-decoration: none;
  color: var(--gw-text);
  cursor: pointer;
  transition: transform .12s, border-color .12s;
  -webkit-tap-highlight-color: transparent;
}
.cup-home-card:active {
  transform: scale(0.98);
  border-color: rgba(212,175,55,.6);
}
.cup-home-icon { font-size: 28px; flex-shrink: 0; }
.cup-home-body { flex: 1; min-width: 0; }
.cup-home-title {
  font-family: var(--gw-font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--gw-gold, #d4af37);
  line-height: 1.2;
}
.cup-home-sub { font-size: 12px; color: rgba(240,237,224,.55); margin-top: 2px; }
.cup-home-arrow { font-size: 28px; color: rgba(212,175,55,.6); font-weight: 300; flex-shrink: 0; }

.cup-home-card--active {
  display: block;
  padding: 0;
  background: linear-gradient(135deg, rgba(212,175,55,.14) 0%, rgba(212,175,55,.06) 100%);
  border-color: rgba(212,175,55,.5);
}
.cup-home-card--active .cup-home-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  text-decoration: none;
  color: var(--gw-text);
  border-bottom: 1px solid rgba(212,175,55,.2);
}
.cup-active-round {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background .12s;
}
.cup-active-round:active { background: rgba(212,175,55,.08); }
.car-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .6px;
  background: #22c55e;
  color: #052e16;
  flex-shrink: 0;
  animation: pulse-live 2s infinite;
}
@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50% { opacity: .65; }
}
.car-body { flex: 1; min-width: 0; }
.car-title {
  font-size: 14px; font-weight: 700; color: var(--gw-text, #f0ede0);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.car-sub {
  font-size: 11px; color: rgba(240,237,224,.5); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.car-cta { font-size: 13px; font-weight: 700; color: var(--gw-gold, #d4af37); flex-shrink: 0; }

.round-card {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s, border-color .12s, background .12s;
}
.round-card:active { transform: scale(.985); background: rgba(255,255,255,.03); }
.round-players {
  font-size: 13px;
  color: rgba(240,237,224,.75);
  font-weight: 500;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.round-date {
  font-size: 11px;
  color: rgba(240,237,224,.4);
  margin-top: 2px;
}
.round-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .5px;
  vertical-align: middle;
  font-family: var(--gw-font-body);
  text-transform: uppercase;
}
.round-badge--done { background: rgba(74,222,128,.14); color: #4ade80; border: 1px solid rgba(74,222,128,.3); }
.round-badge--live { background: rgba(212,175,55,.14); color: #d4af37; border: 1px solid rgba(212,175,55,.35); }

.cm-home-card {
  display: flex; align-items: center; gap: 14px;
  margin: 10px 16px 0; padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(17,74,53,.5) 0%, rgba(17,74,53,.2) 100%);
  border: 1px solid rgba(34,160,107,.3);
  text-decoration: none; color: var(--gw-text);
  transition: transform .12s, border-color .12s;
  -webkit-tap-highlight-color: transparent;
}
.cm-home-card:active { transform: scale(.98); border-color: rgba(34,160,107,.6); }
.cm-home-icon { font-size: 28px; flex-shrink: 0; }
.cm-home-body { flex: 1; min-width: 0; }
.cm-home-title { font-family: var(--gw-font-display); font-size: 17px; font-weight: 700; color: #6edba0; line-height: 1.2; }
.cm-home-sub { font-size: 12px; color: rgba(240,237,224,.55); margin-top: 2px; }
.cm-home-arrow { font-size: 28px; color: rgba(110,219,160,.6); font-weight: 300; flex-shrink: 0; }
.help-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(212,175,55,.15); border: 1.5px solid rgba(212,175,55,.4);
  color: #d4af37; font-size: 16px; font-weight: 700; line-height: 1;
  cursor: pointer; transition: background .15s, border-color .15s, transform .1s;
  flex-shrink: 0; -webkit-tap-highlight-color: transparent;
}
.help-btn:active { background: rgba(212,175,55,.28); border-color: #d4af37; transform: scale(.92); }
</style>
