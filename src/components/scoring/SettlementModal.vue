<template>
  <div v-if="show" class="settle-modal-backdrop" @click.self="emit('close')">
    <div class="settle-modal-panel">
      <div class="settle-modal-header">
        <span class="settle-modal-title">💵 Settle Up</span>
      </div>

      <!-- Player net totals -->
      <div v-if="settlements?.playerTotals" class="settle-modal-totals">
        <div
          v-for="(pt, id) in settlements.playerTotals"
          :key="'smt-' + id"
          class="settle-modal-player"
          :class="pt.total > 0 ? 'smp-up' : pt.total < 0 ? 'smp-down' : 'smp-even'"
        >
          <span class="smp-name">{{ pt.name }}</span>
          <span class="smp-amount">{{ pt.total > 0 ? '+' : '' }}${{ Math.abs(pt.total).toFixed(0) }}</span>
        </div>
      </div>

      <!-- Transfer ledger -->
      <div v-if="settlements?.ledger?.length > 0" class="settle-modal-ledger">
        <div class="settle-modal-section-label">Transfers</div>
        <div
          v-for="(entry, i) in settlements.ledger"
          :key="'sml-' + i"
          class="settle-modal-entry"
        >
          <span class="sme-from">{{ entry.from_name }}</span>
          <span class="sme-arrow">→</span>
          <span class="sme-to">{{ entry.to_name }}</span>
          <span class="sme-amount">${{ entry.amount.toFixed(0) }}</span>
        </div>
      </div>
      <div v-else-if="settlements" class="settle-modal-even">
        All square 🤝
      </div>
      <div v-else class="settle-modal-even">
        No games with money this round.
      </div>

      <!-- 14-Holes discard warning -->
      <div v-if="warning" class="settle-modal-warning">
        ⚠️ {{ warning }}
      </div>

      <!-- Pending warning -->
      <div v-if="pendingScores > 0" class="settle-modal-warning">
        ⏳ {{ pendingScores }} score{{ pendingScores > 1 ? 's' : '' }} still syncing — they'll be saved when you finish.
      </div>

      <div v-if="error" class="settle-modal-error">{{ error }}</div>

      <div class="settle-modal-actions">
        <button class="settle-modal-btn settle-modal-btn-share" :disabled="sharing" @click="emit('share')">
          {{ sharing ? '⏳ Sharing…' : '📸 Share' }}
        </button>
        <button class="settle-modal-btn settle-modal-btn-done" :disabled="finishing" @click="emit('finish')">
          {{ finishing ? '⏳ Finishing…' : 'Done ✓' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show:         { type: Boolean,  required: true },
  settlements:  { type: Object,   default: null },
  finishing:    { type: Boolean,  default: false },
  sharing:      { type: Boolean,  default: false },
  error:        { type: String,   default: null },
  pendingScores:{ type: Number,   default: 0 },
  warning:      { type: String,   default: null },
})
const emit = defineEmits(['close', 'finish', 'share'])
</script>

<style scoped>
.settle-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  z-index: 9000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.settle-modal-panel {
  background: var(--gw-neutral-900, #111);
  border-radius: 20px 20px 0 0;
  padding: 24px 20px 40px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.6);
}
.settle-modal-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
.settle-modal-title {
  font-family: 'DM Serif Display', serif;
  font-size: 22px;
  color: var(--gw-neutral-50, #fafafa);
  flex: 1;
}
.settle-modal-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
.settle-modal-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 72px;
  padding: 12px 8px;
  border-radius: 12px;
  background: var(--gw-neutral-800, #1e1e1e);
}
.smp-up    { background: rgba(34, 197, 94, 0.15); }
.smp-down  { background: rgba(239, 68, 68, 0.15); }
.smp-even  { background: var(--gw-neutral-800, #1e1e1e); }

.smp-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: var(--gw-neutral-400, #888);
  margin-bottom: 4px;
  text-align: center;
}
.smp-amount {
  font-family: 'DM Sans', sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.smp-up   .smp-amount { color: var(--gw-green-400, #4ade80); }
.smp-down .smp-amount { color: var(--gw-red-400, #f87171); }
.smp-even .smp-amount { color: var(--gw-neutral-400, #888); }

.settle-modal-section-label {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gw-neutral-500, #666);
  margin-bottom: 8px;
}
.settle-modal-ledger {
  margin-bottom: 20px;
}
.settle-modal-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 0;
  border-bottom: 1px solid var(--gw-neutral-800, #222);
  font-family: 'DM Sans', sans-serif;
}
.settle-modal-entry:last-child { border-bottom: none; }
.sme-from  { flex: 1; font-size: 15px; font-weight: 600; color: var(--gw-neutral-200, #e5e7eb); }
.sme-arrow { font-size: 14px; color: var(--gw-neutral-500, #666); }
.sme-to    { flex: 1; font-size: 15px; color: var(--gw-neutral-200, #e5e7eb); }
.sme-amount {
  font-size: 17px;
  font-weight: 700;
  color: var(--gw-green-400, #4ade80);
}

.settle-modal-even {
  text-align: center;
  padding: 20px 0;
  color: var(--gw-neutral-400, #888);
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  margin-bottom: 12px;
}
.settle-modal-warning {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: var(--gw-amber-400, #fbbf24);
  background: rgba(251, 191, 36, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
}
.settle-modal-error {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: var(--gw-red-400, #f87171);
  margin-bottom: 12px;
}
.settle-modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.settle-modal-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.settle-modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.settle-modal-btn-share {
  background: var(--gw-neutral-700, #333);
  color: var(--gw-neutral-100, #f3f4f6);
}
.settle-modal-btn-done {
  background: var(--gw-green-500, #22c55e);
  color: #fff;
}
</style>
