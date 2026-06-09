import type { DepartmentMailConnectionInput } from '../../shared/departmentMail'
import type { DepartmentMailMessage } from '../../shared/departmentMail'
import {
  createImapClient,
  formatMailAddress,
  messageStableId,
  normalizeMailConnection,
  validateMailEncryption
} from './imapClient'

const MAX_MESSAGES_PER_FETCH = 300

function readHeaderValue(headers: unknown, key: string): string {
  if (!headers || typeof headers !== 'object') return ''
  const mapLike = headers as { get?: (name: string) => unknown }
  if (typeof mapLike.get !== 'function') return ''
  const raw = mapLike.get(key) ?? mapLike.get(key.toLowerCase())
  if (Array.isArray(raw)) return String(raw[0] ?? '')
  return typeof raw === 'string' ? raw : raw ? String(raw) : ''
}

export interface FetchMailPeriodInput {
  connection: DepartmentMailConnectionInput
  date_from: string
  date_to: string
  known_ids: string[]
}

export interface FetchMailPeriodResult {
  messages: DepartmentMailMessage[]
  skipped_known: number
  total_matched: number
  truncated: boolean
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const d = new Date(`${ymd}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function nextDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

function countAttachments(node: unknown): { count: number; names: string[] } {
  if (!node || typeof node !== 'object') return { count: 0, names: [] }
  const n = node as {
    disposition?: string
    dispositionParameters?: { filename?: string }
    parameters?: { name?: string }
    childNodes?: unknown[]
  }
  const names: string[] = []
  if (n.disposition?.toLowerCase() === 'attachment') {
    const name = n.dispositionParameters?.filename ?? n.parameters?.name
    if (name) names.push(name)
  }
  let count = names.length
  if (Array.isArray(n.childNodes)) {
    for (const child of n.childNodes) {
      const nested = countAttachments(child)
      count += nested.count
      names.push(...nested.names)
    }
  }
  return { count, names }
}

export async function fetchMailMessagesForPeriod(
  raw: FetchMailPeriodInput
): Promise<FetchMailPeriodResult> {
  const connection = normalizeMailConnection(raw.connection)
  if (!connection.host) throw new Error('Укажите IMAP-сервер в настройках подключения')
  if (!connection.user) throw new Error('Укажите логин в настройках подключения')
  if (!connection.password) throw new Error('Укажите или сохраните пароль ящика')

  const encryptionError = validateMailEncryption(connection)
  if (encryptionError) throw new Error(encryptionError)

  const since = parseYmd(raw.date_from)
  const toEnd = parseYmd(raw.date_to)
  if (!since || !toEnd) throw new Error('Некорректный период дат')
  if (since > toEnd) throw new Error('Дата «с» не может быть позже даты «по»')

  const before = nextDay(toEnd)
  const known = new Set(raw.known_ids)

  const client = createImapClient(connection)
  const now = Math.floor(Date.now() / 1000)
  const messages: DepartmentMailMessage[] = []
  let skippedKnown = 0
  let totalMatched = 0
  let truncated = false

  try {
    await client.connect()
    await client.mailboxOpen('INBOX', { readOnly: true })

    const searchResult = await client.search({ since, before }, { uid: true })
    const uids = Array.isArray(searchResult) ? searchResult : []
    totalMatched = uids.length
    if (uids.length === 0) {
      return { messages: [], skipped_known: 0, total_matched: 0, truncated: false }
    }

    const fetchUids =
      uids.length > MAX_MESSAGES_PER_FETCH ? uids.slice(-MAX_MESSAGES_PER_FETCH) : uids
    truncated = fetchUids.length < uids.length

    for await (const item of client.fetch(
      fetchUids,
      {
        envelope: true,
        bodyStructure: true,
        headers: ['message-id']
      },
      { uid: true }
    )) {
      const uid = item.uid ?? 0
      if (!uid) continue
      const headerMid = readHeaderValue(item.headers, 'message-id')
      const messageId = headerMid
      const id = messageStableId(uid, messageId)
      if (known.has(id)) {
        skippedKnown += 1
        continue
      }

      const envelope = item.envelope
      const subject = envelope?.subject?.trim() || '(Без темы)'
      const from = formatMailAddress(envelope?.from?.[0])
      const dateObj = envelope?.date ?? new Date()
      const { count, names } = countAttachments(item.bodyStructure)

      messages.push({
        id,
        uid,
        message_id: messageId,
        subject,
        from,
        date: dateObj.toISOString(),
        body_preview: '',
        attachment_count: count,
        attachment_names: names.slice(0, 20),
        status: 'pending',
        task_id: null,
        fetched_at: now
      })
    }

    messages.sort((a, b) => b.date.localeCompare(a.date))
    return {
      messages,
      skipped_known: skippedKnown,
      total_matched: totalMatched,
      truncated
    }
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
