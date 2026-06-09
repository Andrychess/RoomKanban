import { shell } from 'electron'
import { basename } from 'path'
import { detectFilePreviewKind } from '../../shared/filePreview'
import { openFilePreviewWindow } from './FilePreviewWindowManager'
import { loadFilePreviewPayload } from './loadFilePreviewPayload'

export async function openLocalFilePreview(absPath: string, fileName?: string): Promise<void> {
  const name = fileName ?? basename(absPath)
  const extKind = detectFilePreviewKind(name)

  if (extKind === 'unsupported') {
    await shell.openPath(absPath)
    return
  }

  const payload = await loadFilePreviewPayload(absPath, name)
  openFilePreviewWindow(payload)
}
