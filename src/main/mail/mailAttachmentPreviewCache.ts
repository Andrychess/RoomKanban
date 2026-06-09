import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { simpleParser } from 'mailparser'
import type { DepartmentMailConnectionInput, DepartmentMailMessage } from '../../shared/departmentMail'
import { downloadRawMailMessage, sanitizeMailFileName } from './mailRawMessage'
import { cleanupMailTaskDraftTemp } from './prepareMailTaskDraft'

interface CachedAttachmentFile {
  path: string
  displayName: string
}

interface CachedMailAttachments {
  tempDir: string
  files: CachedAttachmentFile[]
}

const cache = new Map<string, CachedMailAttachments>()

async function downloadAndCache(
  message: DepartmentMailMessage,
  connection: DepartmentMailConnectionInput
): Promise<CachedMailAttachments> {
  const raw = await downloadRawMailMessage(connection, message.uid)
  const parsed = await simpleParser(raw)
  const attachments = (parsed.attachments ?? []).filter((att) => att.content?.length)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roomkanban-mail-preview-'))
  const files: CachedAttachmentFile[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]!
    const displayName = att.filename?.trim() || `attachment-${i + 1}`
    let fileName = sanitizeMailFileName(displayName)
    if (usedNames.has(fileName)) {
      fileName = `${i + 1}-${fileName}`
    }
    usedNames.add(fileName)

    const filePath = path.join(tempDir, fileName)
    await fs.writeFile(filePath, att.content)
    files.push({ path: filePath, displayName })
  }

  return { tempDir, files }
}

export async function resolveMailAttachmentForPreview(options: {
  message: DepartmentMailMessage
  connection: DepartmentMailConnectionInput
  attachmentIndex: number
}): Promise<{ path: string; displayName: string }> {
  const { message, connection, attachmentIndex } = options
  if (attachmentIndex < 0) throw new Error('Вложение не найдено')

  let cached = cache.get(message.id)
  if (!cached) {
    cached = await downloadAndCache(message, connection)
    cache.set(message.id, cached)
  }

  const file = cached.files[attachmentIndex]
  if (!file) throw new Error('Вложение не найдено')
  return file
}

export async function clearMailAttachmentPreviewCache(messageId?: string): Promise<void> {
  if (messageId) {
    const cached = cache.get(messageId)
    if (cached) {
      await cleanupMailTaskDraftTemp(cached.tempDir)
      cache.delete(messageId)
    }
    return
  }

  await Promise.all(
    [...cache.values()].map(async (cached) => cleanupMailTaskDraftTemp(cached.tempDir))
  )
  cache.clear()
}
