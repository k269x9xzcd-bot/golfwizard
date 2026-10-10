// Display-only viewer orientation — see src/modules/viewerPerspective.js.
import { computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { useAuthStore } from '../stores/auth'
import { viewerMemberId, orderMembersForViewer, orientGameForViewer } from '../modules/viewerPerspective'

export function useViewerPerspective() {
  const roundsStore = useRoundsStore()
  const authStore = useAuthStore()

  const viewerId = computed(() => viewerMemberId(roundsStore.activeMembers || [], {
    userId: authStore.user?.id,
    email: authStore.user?.email,
  }))

  const viewerOrderedMembers = computed(() =>
    orderMembersForViewer(roundsStore.activeMembers || [], viewerId.value))

  const orient = (game) => orientGameForViewer(game, viewerId.value)

  return { viewerId, viewerOrderedMembers, orient }
}
