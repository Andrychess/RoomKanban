import { simpleParser } from 'mailparser'
import type { DepartmentMailConnectionInput } from '../../shared/departmentMail'
import { createImapClient, normalizeMailConnection, readFetchSource } from './imapClient'

export async function loadMailMessageBody(
  connection: DepartmentMailConnectionInput,
  uid: number
): Promise<string> {
  const client = createImapClient(normalizeMailConnection(connection))
  try {
    await client.connect()
    await client.mailboxOpen('INBOX', { readOnly: true })
    const item = await client.fetchOne(uid, { source: true }, { uid: true })
    const raw = readFetchSource(item)
    if (!raw) return ''
    const parsed = await simpleParser(raw)
    if (parsed.text?.trim()) return parsed.text.trim()
    if (parsed.html) {
      return parsed.html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    return ''
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
