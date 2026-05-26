import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const cachedTheme = localStorage.getItem('room-kanban-theme')
if (cachedTheme === 'light' || cachedTheme === 'dark') {
  document.documentElement.dataset.theme = cachedTheme
} else {
  document.documentElement.dataset.theme = 'dark'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
