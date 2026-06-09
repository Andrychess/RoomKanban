import { ImapFlow } from 'imapflow'
import type { DepartmentMailConnectionInput } from '../../shared/departmentMail'

export function normalizeMailConnection(
  input: DepartmentMailConnectionInput
): DepartmentMailConnectionInput {
  const port = input.port > 0 ? input.port : input.secure ? 993 : 143
  return {
    host: input.host.trim(),
    port,
    secure: input.secure,
    user: input.user.trim(),
    password: input.password
  }
}

export function validateMailEncryption(input: DepartmentMailConnectionInput): string | null {
  if (input.secure && input.port === 143) {
    return 'На порту 143 используйте STARTTLS (без SSL/TLS сразу).'
  }
  if (!input.secure && input.port === 993) {
    return 'На порту 993 включите SSL/TLS сразу.'
  }
  return null
}

export function createImapClient(input: DepartmentMailConnectionInput): ImapFlow {
  return new ImapFlow({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: {
      user: input.user,
      pass: input.password
    },
    logger: false,
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 60_000
  })
}

export function formatMailAddress(
  addr: { name?: string; address?: string } | undefined
): string {
  if (!addr) return ''
  if (addr.name && addr.address) return `${addr.name} <${addr.address}>`
  return addr.address ?? addr.name ?? ''
}

export function messageStableId(uid: number, messageId: string): string {
  const mid = messageId.trim().replace(/^<|>$/g, '')
  if (mid) return `mid:${mid}`
  return `uid:${uid}`
}

export function formatMailError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('ECONNREFUSED')) {
    return (
      'Не удалось подключиться к почтовому серверу (соединение отклонено). ' +
      'Проверьте интернет, VPN университета и что в настройках указаны mail.npi-tu.ru, порт 143, STARTTLS.'
    )
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('connection in required time')) {
    return 'Таймаут при подключении к почте. Проверьте интернет или подключитесь к VPN университета.'
  }
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return 'Не удалось найти почтовый сервер. Проверьте адрес IMAP в настройках.'
  }
  return msg
}

export function readFetchSource(item: unknown): Buffer | null {
  if (!item || item === false || typeof item !== 'object') return null
  const source = (item as { source?: unknown }).source
  if (!source) return null
  if (Buffer.isBuffer(source)) return source
  if (source instanceof Uint8Array) return Buffer.from(source)
  if (typeof source === 'string') return Buffer.from(source)
  return null
}
