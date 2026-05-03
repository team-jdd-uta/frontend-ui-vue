import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { installAuthFetch } from './authFetch'

installAuthFetch()
createApp(App).mount('#app')
