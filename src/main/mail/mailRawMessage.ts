import path from 'path'
import type { DepartmentMailConnectionInput } from '../../shared/departmentMail'
import { createImapClient, normalizeMailConnection, readFetchSource } from './imapClient'

export function sanitizeMailFileName(name: string): string {
  const base = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
  return base || 'attachment'
}

export async function downloadRawMailMessage(
  connection: DepartmentMailConnectionInput,
  uid: number
): Promise<Buffer> {
  const client = createImapClient(normalizeMailConnection(connection))
  try {
    await client.connect()
    await client.mailboxOpen('INBOX', { readOnly: true })
    const item = await client.fetchOne(uid, { source: true }, { uid: true })
    const raw = readFetchSource(item)
    if (!raw) throw new Error('Не удалось скачать письмо с сервера')
    return raw
  } finally {
    try {
      await client.logout()
    } catch {
      /* ignore */
    }
    try {
      await client.close()
    } catch {
      /* ignore */
    }
  }
}
