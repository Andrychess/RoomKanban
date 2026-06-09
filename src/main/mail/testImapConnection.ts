import type {
  DepartmentMailConnectionInput,
  MailConnectionTestResult
} from '../../shared/departmentMail'
import {
  createImapClient,
  normalizeMailConnection,
  validateMailEncryption
} from './imapClient'

function formatConnectionError(err: unknown, input: DepartmentMailConnectionInput): string {
  const detail = err instanceof Error ? err.message : 'Неизвестная ошибка'
  const response =
    err && typeof err === 'object' && 'response' in err && typeof err.response === 'string'
      ? err.response
      : ''

  if (
    detail.includes('WRONG_VERSION_NUMBER') ||
    detail.includes('packet length too long') ||
    detail.includes('tls_get_more_records')
  ) {
    return input.secure
      ? 'Сервер не принимает SSL сразу на этом порту. Для mail.npi-tu.ru выберите STARTTLS (порт 143).'
      : 'Ошибка шифрования при подключении. Проверьте режим: для CommuniGate — STARTTLS (порт 143).'
  }

  if (response.includes('incorrect password') || response.includes('authenticationFailed')) {
    return 'Неверный логин или пароль. Проверьте адрес ящика и пароль от веб-почты; при 2FA спросите пароль приложения у IT.'
  }
  if (response.includes('NO ')) {
    return `Сервер отклонил вход: ${response.replace(/^\d+\s+\w+\s+/i, '')}`
  }

  return detail
}

export async function testImapConnection(
  raw: DepartmentMailConnectionInput
): Promise<MailConnectionTestResult> {
  const input = normalizeMailConnection(raw)

  if (!input.host) {
    return { ok: false, message: 'Укажите IMAP-сервер' }
  }
  if (!input.user) {
    return { ok: false, message: 'Укажите логин (адрес ящика)' }
  }
  if (!input.password) {
    return { ok: false, message: 'Укажите пароль' }
  }

  const encryptionError = validateMailEncryption(input)
  if (encryptionError) {
    return { ok: false, message: encryptionError }
  }

  const client = createImapClient(input)

  try {
    await client.connect()
    const mailbox = await client.mailboxOpen('INBOX', { readOnly: true })
    const messageCount = mailbox.exists ?? 0
    await client.logout()

    return {
      ok: true,
      message: `Подключение успешно. Во «Входящих» ${messageCount} писем.`,
      mailbox: mailbox.path,
      message_count: messageCount
    }
  } catch (err) {
    const authFailed =
      err &&
      typeof err === 'object' &&
      'authenticationFailed' in err &&
      Boolean(err.authenticationFailed)
    const message = authFailed
      ? formatConnectionError(err, input)
      : `Не удалось подключиться: ${formatConnectionError(err, input)}`
    return { ok: false, message }
  } finally {
    try {
      await client.close()
    } catch {
      /* already closed */
    }
  }
}
