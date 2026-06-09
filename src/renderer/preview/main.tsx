import './pdfPolyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FilePreviewApp } from './FilePreviewApp'
import './preview.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FilePreviewApp />
  </StrictMode>
)
