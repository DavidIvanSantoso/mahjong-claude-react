import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
// Setelah index.css: palet UNO harus menimpa tema dan palet mahjong.
import './uno/uno.css'
import './capsa/capsa.css'
import './bomkata/bomkata.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
