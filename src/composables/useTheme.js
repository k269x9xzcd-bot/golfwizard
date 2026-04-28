import { ref, watch } from 'vue'

const STORAGE_KEY = 'gw-theme'
const DEFAULT = 'dark'

const theme = ref(
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) || DEFAULT)
    : DEFAULT
)

function apply(t) {
  document.documentElement.setAttribute('data-theme', t)
}

function toggle() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

function init() {
  apply(theme.value)
  watch(theme, (t) => {
    localStorage.setItem(STORAGE_KEY, t)
    apply(t)
  })
}

export function useTheme() {
  return { theme, toggle, init }
}
