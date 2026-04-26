<template>
  <Teleport to="body">
    <Transition name="help-slide">
      <div v-if="modelValue" class="help-backdrop" @click.self="$emit('update:modelValue', false)">
        <div class="help-sheet">

          <!-- Handle -->
          <div class="help-handle"></div>

          <!-- Header -->
          <div class="help-header">
            <div class="help-header-left">
              <span class="help-header-icon">📖</span>
              <div>
                <div class="help-title">Help & Support</div>
                <div class="help-subtitle">v{{ appVersion }}</div>
              </div>
            </div>
            <button class="help-close" @click="$emit('update:modelValue', false)">✕</button>
          </div>

          <!-- Tab bar -->
          <div class="help-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="help-tab"
              :class="{ 'help-tab--active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              <span class="help-tab-icon">{{ tab.icon }}</span>
              <span class="help-tab-label">{{ tab.label }}</span>
            </button>
          </div>

          <!-- Article list -->
          <div class="help-body" ref="bodyEl">
            <div v-if="loading" class="help-loading">
              <div class="help-spinner"></div>
              <span>Loading…</span>
            </div>

            <template v-else>
              <div
                v-for="article in visibleArticles"
                :key="article.id"
                class="help-article"
                :class="{ 'help-article--open': openIds.has(article.id) }"
              >
                <button class="help-article-header" @click="toggleArticle(article.id)">
                  <span class="help-article-emoji">{{ article.emoji || '📌' }}</span>
                  <span class="help-article-title">{{ article.title }}</span>
                  <span class="help-article-chevron">{{ openIds.has(article.id) ? '▲' : '▼' }}</span>
                </button>
                <div v-if="openIds.has(article.id)" class="help-article-body">
                  <p v-for="(para, i) in article.body.split('\n\n')" :key="i" class="help-para">{{ para }}</p>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="!visibleArticles.length" class="help-empty">
                No articles found. Check back after the next update.
              </div>
            </template>

            <!-- Divider before feedback -->
            <div class="help-divider"></div>

            <!-- Feedback section -->
            <div class="help-feedback-section">
              <div class="help-feedback-header">
                <span class="help-feedback-icon">💬</span>
                <div>
                  <div class="help-feedback-title">Got feedback?</div>
                  <div class="help-feedback-sub">Report a bug or suggest a feature</div>
                </div>
              </div>

              <div v-if="feedbackSent" class="help-feedback-sent">
                <span>✅</span>
                <span>Got it — thanks! We'll look into it.</span>
              </div>

              <template v-else>
                <div class="help-feedback-types">
                  <button
                    class="help-type-btn"
                    :class="{ 'help-type-btn--on': feedbackType === 'bug' }"
                    @click="feedbackType = 'bug'"
                  >🐛 Bug</button>
                  <button
                    class="help-type-btn"
                    :class="{ 'help-type-btn--on': feedbackType === 'suggestion' }"
                    @click="feedbackType = 'suggestion'"
                  >💡 Suggestion</button>
                  <button
                    class="help-type-btn"
                    :class="{ 'help-type-btn--on': feedbackType === 'other' }"
                    @click="feedbackType = 'other'"
                  >💬 Other</button>
                </div>

                <textarea
                  v-model="feedbackMessage"
                  class="help-textarea"
                  :placeholder="feedbackPlaceholder"
                  rows="4"
                ></textarea>

                <div v-if="feedbackError" class="help-feedback-error">{{ feedbackError }}</div>

                <button
                  class="help-submit-btn"
                  :disabled="submitting || !feedbackMessage.trim()"
                  @click="submitFeedback"
                >
                  {{ submitting ? 'Sending…' : 'Send Feedback' }}
                </button>

                <div class="help-feedback-note">
                  Includes your app version and current screen. No personal data beyond your account.
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  appVersion: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const route = useRoute()
const authStore = useAuthStore()

const tabs = [
  { key: 'getting_started', icon: '🚀', label: 'Start' },
  { key: 'scoring',         icon: '📝', label: 'Scoring' },
  { key: 'cross_match',     icon: '⚔️', label: '4v4' },
  { key: 'roster',          icon: '👥', label: 'Roster' },
  { key: 'games',           icon: '🎮', label: 'Games' },
]

const activeTab = ref('getting_started')
const openIds = ref(new Set())
const articles = ref([])
const loading = ref(false)
const bodyEl = ref(null)

// Feedback
const feedbackType = ref('bug')
const feedbackMessage = ref('')
const feedbackError = ref('')
const feedbackSent = ref(false)
const submitting = ref(false)

const feedbackPlaceholder = computed(() => {
  if (feedbackType.value === 'bug') return 'What happened? What did you expect? (e.g. "Tapped finish round and nothing happened")'
  if (feedbackType.value === 'suggestion') return 'What would make GolfWizard better for you?'
  return 'What\'s on your mind?'
})

const visibleArticles = computed(() =>
  articles.value.filter(a => a.section === activeTab.value)
)

function toggleArticle(id) {
  const next = new Set(openIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openIds.value = next
}

// Auto-open first article when tab changes
watch(activeTab, () => {
  openIds.value = new Set()
  const first = visibleArticles.value[0]
  if (first) openIds.value = new Set([first.id])
  bodyEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
})

// Load articles (with local fallback)
const LOCAL_FALLBACK = [
  { id: 'l1', section: 'getting_started', sort_order: 1, emoji: '⛳', title: 'Welcome to GolfWizard', body: 'GolfWizard tracks scores, runs side games, and syncs handicaps from GHIN.\n\nSign up, add yourself under Roster → + Add Player, connect your GHIN number, and start your first round from the Home screen.' },
  { id: 'l2', section: 'getting_started', sort_order: 2, emoji: '🏌️', title: 'Starting a Round', body: 'Tap + on the Home screen. The wizard will guide you: pick a course and tees, choose 9 or 18 holes, add playing partners from your roster, pick your games, and start scoring.' },
  { id: 'l3', section: 'scoring', sort_order: 1, emoji: '📝', title: 'Entering Scores', body: 'Tap any player row on a hole to enter their gross score. Net scores and game standings update automatically.' },
  { id: 'l4', section: 'cross_match', sort_order: 1, emoji: '⚔️', title: 'What is a 4v4 Cross Match?', body: 'Two foursomes compete using best-ball net scoring. Handicaps use the USGA stroke play four-ball method (90% of full course handicap). Share an invite link — the other foursome\'s round is pre-built.' },
  { id: 'l5', section: 'roster', sort_order: 1, emoji: '📋', title: 'Managing Players', body: 'Roster lives in Courses & Roster → Roster. Tap any player to view stats. Tap 🔍 GHIN to search and auto-fill handicap, GHIN number, and home club.' },
  { id: 'l6', section: 'games', sort_order: 1, emoji: '🎮', title: 'Available Games', body: 'GolfWizard supports: Skins, Best Ball, Wolf, Nassau, 5-3-1, Stableford, and more — all with configurable rules.' },
]

async function loadArticles() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('help_articles')
      .select('id, section, sort_order, title, body, emoji')
      .eq('is_published', true)
      .order('sort_order')
    if (error) throw error
    articles.value = data?.length ? data : LOCAL_FALLBACK
  } catch {
    articles.value = LOCAL_FALLBACK
  } finally {
    loading.value = false
    // Open first article in active tab
    const first = visibleArticles.value[0]
    if (first) openIds.value = new Set([first.id])
  }
}

// Load when first opened
watch(() => props.modelValue, (v) => {
  if (v && !articles.value.length) loadArticles()
  if (v) {
    feedbackSent.value = false
    feedbackMessage.value = ''
    feedbackError.value = ''
  }
})

async function submitFeedback() {
  feedbackError.value = ''
  if (!feedbackMessage.value.trim()) return
  submitting.value = true
  try {
    const payload = {
      type: feedbackType.value,
      message: feedbackMessage.value.trim(),
      user_id: authStore.user?.id || null,
      app_version: props.appVersion || null,
      route: route?.fullPath || null,
      device_info: {
        ua: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        platform: navigator.platform,
      },
    }
    const { error } = await supabase.from('feedback').insert(payload)
    if (error) throw error
    feedbackSent.value = true
    feedbackMessage.value = ''
  } catch (e) {
    feedbackError.value = e?.message?.includes('auth') 
      ? 'Please sign in to submit feedback.' 
      : 'Could not send — try again in a moment.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* ── Transition ─────────────────────────────────────────────── */
.help-slide-enter-active, .help-slide-leave-active {
  transition: opacity .2s ease;
}
.help-slide-enter-active .help-sheet,
.help-slide-leave-active .help-sheet {
  transition: transform .3s cubic-bezier(.32,0,.67,0);
}
.help-slide-enter-from, .help-slide-leave-to { opacity: 0; }
.help-slide-enter-from .help-sheet,
.help-slide-leave-to .help-sheet { transform: translateY(100%); }

/* ── Backdrop + sheet ───────────────────────────────────────── */
.help-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: flex-end;
}
.help-sheet {
  width: 100%; max-height: 90dvh;
  background: var(--gw-neutral-950, #0c0f0d);
  border-top: 1px solid rgba(255,255,255,.1);
  border-radius: 20px 20px 0 0;
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* ── Handle ─────────────────────────────────────────────────── */
.help-handle {
  width: 40px; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.2);
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* ── Header ─────────────────────────────────────────────────── */
.help-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px 10px;
  flex-shrink: 0;
}
.help-header-left { display: flex; align-items: center; gap: 10px; }
.help-header-icon { font-size: 24px; }
.help-title { font-family: var(--gw-font-display); font-size: 18px; color: var(--gw-text, #f0ede0); font-weight: 800; }
.help-subtitle { font-size: 11px; color: rgba(240,237,224,.4); }
.help-close {
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
  color: var(--gw-text-muted, #888); font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
}

/* ── Tab bar ────────────────────────────────────────────────── */
.help-tabs {
  display: flex; gap: 4px; padding: 0 14px 10px;
  overflow-x: auto; flex-shrink: 0;
  scrollbar-width: none;
}
.help-tabs::-webkit-scrollbar { display: none; }
.help-tab {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 7px 12px; border-radius: 12px; flex-shrink: 0;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  color: var(--gw-text-muted, #888); cursor: pointer; font-family: inherit;
  transition: background .12s, border-color .12s;
  -webkit-tap-highlight-color: transparent;
}
.help-tab--active {
  background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.4); color: #d4af37;
}
.help-tab-icon { font-size: 16px; }
.help-tab-label { font-size: 10px; font-weight: 700; letter-spacing: .04em; white-space: nowrap; }

/* ── Scrollable body ────────────────────────────────────────── */
.help-body {
  flex: 1; overflow-y: auto; padding: 4px 14px 32px;
  overscroll-behavior: contain;
}

/* ── Loading ────────────────────────────────────────────────── */
.help-loading {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 32px; color: var(--gw-text-muted, #888); font-size: 14px;
}
.help-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.15); border-top-color: #d4af37;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg) } }

/* ── Articles ───────────────────────────────────────────────── */
.help-article {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03);
  margin-bottom: 8px;
  overflow: hidden;
  transition: border-color .15s;
}
.help-article--open { border-color: rgba(212,175,55,.3); }
.help-article-header {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 13px 14px; background: transparent;
  border: none; color: var(--gw-text, #f0ede0); cursor: pointer;
  font-family: inherit; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.help-article-emoji { font-size: 18px; flex-shrink: 0; }
.help-article-title { flex: 1; font-size: 14px; font-weight: 700; line-height: 1.3; }
.help-article-chevron { font-size: 10px; color: var(--gw-text-muted, #888); flex-shrink: 0; }
.help-article--open .help-article-chevron { color: #d4af37; }

.help-article-body { padding: 0 14px 14px; }
.help-para {
  font-size: 13px; color: rgba(240,237,224,.7); line-height: 1.6;
  margin: 0 0 10px;
  white-space: pre-wrap;
}
.help-para:last-child { margin-bottom: 0; }

.help-empty {
  text-align: center; padding: 32px 16px;
  color: var(--gw-text-muted, #888); font-size: 13px;
}

/* ── Divider ────────────────────────────────────────────────── */
.help-divider {
  height: 1px; background: rgba(255,255,255,.07);
  margin: 16px 0;
}

/* ── Feedback ───────────────────────────────────────────────── */
.help-feedback-section { display: flex; flex-direction: column; gap: 10px; }
.help-feedback-header { display: flex; align-items: center; gap: 10px; }
.help-feedback-icon { font-size: 22px; }
.help-feedback-title { font-size: 15px; font-weight: 800; color: var(--gw-text, #f0ede0); }
.help-feedback-sub { font-size: 11px; color: rgba(240,237,224,.45); }

.help-feedback-sent {
  display: flex; align-items: center; gap: 10px;
  padding: 14px; border-radius: 12px;
  background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.3);
  font-size: 14px; color: #4ade80;
}

.help-feedback-types { display: flex; gap: 8px; }
.help-type-btn {
  flex: 1; padding: 9px 8px; border-radius: 10px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text-muted, #888); font-family: inherit; font-size: 12px;
  font-weight: 700; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background .12s, border-color .12s, color .12s;
}
.help-type-btn--on {
  background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.4); color: #d4af37;
}

.help-textarea {
  width: 100%; background: rgba(0,0,0,.25);
  border: 1px solid rgba(255,255,255,.1); border-radius: 12px;
  padding: 12px 14px; color: var(--gw-text, #f0ede0);
  font-family: inherit; font-size: 14px; line-height: 1.5;
  resize: none; outline: none; box-sizing: border-box;
}
.help-textarea:focus { border-color: rgba(212,175,55,.4); }
.help-textarea::placeholder { color: rgba(240,237,224,.3); }

.help-feedback-error {
  font-size: 12px; color: #f87171; padding: 4px 2px;
}

.help-submit-btn {
  width: 100%; padding: 14px; border-radius: 14px;
  background: linear-gradient(145deg, #edd655, #d4af37, #b8961e);
  color: #0c0f0d; border: none; font-family: var(--gw-font-body);
  font-size: 15px; font-weight: 800; cursor: pointer;
  box-shadow: 0 4px 16px rgba(212,175,55,.2);
  -webkit-tap-highlight-color: transparent; transition: transform .1s;
}
.help-submit-btn:disabled { opacity: .4; }
.help-submit-btn:active:not(:disabled) { transform: scale(.98); }

.help-feedback-note {
  font-size: 10px; color: rgba(240,237,224,.3); text-align: center; line-height: 1.4;
}
</style>
