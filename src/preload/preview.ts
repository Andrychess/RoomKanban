import { contextBridge, ipcRenderer } from 'electron'
import type { FilePreviewPayload } from '../shared/filePreview'

export interface FilePreviewApi {
  onInit: (callback: (payload: FilePreviewPayload) => void) => () => void
  openExternal: (filePath: string) => Promise<void>
}

const previewApi: FilePreviewApi = {
  onInit: (callback) => {
    const handler = (_: unknown, payload: FilePreviewPayload) => callback(payload)
    ipcRenderer.on('file-preview-init', handler)
    return () => ipcRenderer.removeListener('file-preview-init', handler)
  },
  openExternal: (filePath) => ipcRenderer.invoke('open-file-external', filePath)
}

contextBridge.exposeInMainWorld('previewApi', previewApi)
