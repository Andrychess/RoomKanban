/// <reference types="vite/client" />
import type { FilePreviewApi } from '../../preload/preview'

declare global {
  interface Window {
    previewApi: FilePreviewApi
  }
}

export {}
