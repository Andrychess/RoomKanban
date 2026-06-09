import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { simpleParser } from 'mailparser'
import type {
  DepartmentMailConnectionInput,
  DepartmentMailMessage,
  MailTaskDraftProgress,
  MailTaskDraftResult
} from '../../shared/departmentMail'
import { formatMailAddress } from './imapClient'
import { downloadRawMailMessage, sanitizeMailFileName } from './mailRawMessage'

function formatDateRu(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU')
}

export async function prepareMailTaskDraft(options: {
  message: DepartmentMailMessage
  connection: DepartmentMailConnectionInput
  assigneePc: string
  onProgress?: (progress: MailTaskDraftProgress) => void
}): Promise<MailTaskDraftResult> {
  const { message, connection, assigneePc, onProgress } = options

  onProgress?.({
    message_id: message.id,
    phase: 'message',
    current: 0,
    total: Math.max(1, message.attachment_count),
    file_name: 'Письмо…'
  })

  const raw = await downloadRawMailMessage(connection, message.uid)
  const parsed = await simpleParser(raw)

  const subject = parsed.subject?.trim() || message.subject || '(Без темы)'
  const from =
    parsed.from?.text?.trim() ||
    formatMailAddress(parsed.from?.value?.[0]) ||
    message.from ||
    '—'
  const dateIso = parsed.date?.toISOString() ?? message.date
  const htmlBody =
    typeof parsed.html === 'string'
      ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : ''
  const body = parsed.text?.trim() || htmlBody || message.body_preview || ''

  const description = [
    `Письмо от: ${from}`,
    `Дата: ${formatDateRu(dateIso)}`,
    message.message_id ? `Message-ID: ${message.message_id}` : '',
    '',
    body
  ]
    .filter(Boolean)
    .join('\n')

  const attachments = (parsed.attachments ?? []).filter((att) => att.content?.length)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roomkanban-mail-draft-'))
  const source_files: { name: string; path: string }[] = []
  const total = attachments.length

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]!
    const fileName = sanitizeMailFileName(att.filename || `attachment-${i + 1}`)
    onProgress?.({
      message_id: message.id,
      phase: 'attachment',
      current: i + 1,
      total: Math.max(1, total),
      file_name: fileName
    })
    const filePath = path.join(tempDir, fileName)
    await fs.writeFile(filePath, att.content)
    source_files.push({ name: fileName, path: filePath })
  }

  if (total === 0) {
    onProgress?.({
      message_id: message.id,
      phase: 'attachment',
      current: 1,
      total: 1,
      file_name: 'Без вложений'
    })
  }

  return {
    message_id: message.id,
    title: subject.slice(0, 500),
    description,
    assignee_pc: assigneePc,
    source_files,
    temp_dir: tempDir
  }
}

export async function cleanupMailTaskDraftTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
