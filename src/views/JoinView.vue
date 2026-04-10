<template>
  <div class="view join-view">
    <JoinOverlay @close="$router.push('/')" />
  </div>
</template>
<script setup>
import JoinOverlay from '../components/JoinOverlay.vue'
</script>
