import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './style.css'
import { useTheme } from './composables/useTheme.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
const { init } = useTheme()
init()
app.mount('#app')
