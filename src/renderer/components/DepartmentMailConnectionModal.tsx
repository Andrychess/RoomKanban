import { useEffect, useState } from 'react'
import type { DepartmentMailSettings, MailConnectionTestResult } from '../../shared/departmentMail'

const IMAP_PRESETS: { label: string; host: string; port: number; secure: boolean }[] = [
  { label: 'CommuniGate (Samoware)', host: 'mail.npi-tu.ru', port: 143, secure: false },
  { label: 'Yandex', host: 'imap.yandex.ru', port: 993, secure: true },
  { label: 'Mail.ru', host: 'imap.mail.ru', port: 993, secure: true },
  { label: 'Gmail', host: 'imap.gmail.com', port: 993, secure: true },
  { label: 'Outlook / M365', host: 'outlook.office365.com', port: 993, secure: true }
]

type MailEncryptionMode = 'starttls' | 'ssl'

function encryptionFromSettings(settings: DepartmentMailSettings): MailEncryptionMode {
  return settings.secure || settings.port === 993 ? 'ssl' : 'starttls'
}

function settingsFromEncryption(
  settings: DepartmentMailSettings,
  mode: MailEncryptionMode
): DepartmentMailSettings {
  if (mode === 'ssl') {
    return { ...settings, secure: true, port: 993 }
  }
  return { ...settings, secure: false, port: 143 }
}

interface Props {
  onClose: () => void
}

export default function DepartmentMailConnectionModal({ onClose }: Props) {
  const [settings, setSettings] = useState<DepartmentMailSettings | null>(null)
  const [password, setPassword] = useState('')
  const [hasSavedPassword, setHasSavedPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<MailConnectionTestResult | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [s, hasPwd] = await Promise.all([
          window.api.getDepartmentMailSettings(),
          window.api.getDepartmentMailHasPassword()
        ])
        setSettings(s)
        setHasSavedPassword(hasPwd)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function applyPreset(preset: (typeof IMAP_PRESETS)[number]) {
    if (!settings) return
    setSettings({
      ...settings,
      host: preset.host,
      port: preset.port,
      secure: preset.secure
    })
    setTestResult(null)
    setSaved(false)
  }

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    setTestResult(null)
    try {
      const next = await window.api.saveDepartmentMailSettings(settings)
      setSettings(next)
      if (password.trim()) {
        await window.api.setDepartmentMailPassword(password.trim())
        setHasSavedPassword(true)
        setPassword('')
      }
      setSaved(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    if (!settings) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.testDepartmentMailConnection({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        user: settings.user,
        password
      })
      setTestResult(result)
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Ошибка проверки подключения'
      })
    } finally {
      setTesting(false)
    }
  }

  async function clearPassword() {
    if (!window.confirm('Удалить сохранённый пароль на этом компьютере?')) return
    await window.api.setDepartmentMailPassword(null)
    setHasSavedPassword(false)
    setPassword('')
    setSaved(false)
  }

  return (
    <div className="modal-overlay department-mail-modal-overlay" onClick={onClose}>
      <div
        className="modal card department-mail-connection-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="department-mail-connection-title"
      >
        <header className="department-mail-modal-head">
          <div>
            <h2 id="department-mail-connection-title">Настройка подключения почты</h2>
            <p className="sub">
              Пароль хранится только на этом ПК. Сервер и логин — в общей папке комнаты.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Закрыть
          </button>
        </header>

        {loading || !settings ? (
          <p className="sub">Загрузка…</p>
        ) : (
          <>
            <div className="department-mail-presets">
              <span className="sub">Быстрый выбор сервера:</span>
              <div className="department-mail-preset-row">
                {IMAP_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="form-group">
              <span>IMAP-сервер</span>
              <input
                value={settings.host}
                onChange={(e) => {
                  setSettings({ ...settings, host: e.target.value })
                  setSaved(false)
                  setTestResult(null)
                }}
                placeholder="imap.example.com"
              />
            </label>

            <label className="form-group">
              <span>Шифрование</span>
              <select
                value={encryptionFromSettings(settings)}
                onChange={(e) => {
                  const mode = e.target.value === 'ssl' ? 'ssl' : 'starttls'
                  setSettings(settingsFromEncryption(settings, mode))
                  setSaved(false)
                  setTestResult(null)
                }}
              >
                <option value="starttls">STARTTLS (порт 143) — CommuniGate / Samoware</option>
                <option value="ssl">SSL/TLS сразу (порт 993)</option>
              </select>
            </label>

            <label className="form-group">
              <span>Порт</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={settings.port}
                onChange={(e) => {
                  const port = parseInt(e.target.value, 10)
                  const nextPort = Number.isNaN(port) ? settings.port : port
                  setSettings({
                    ...settings,
                    port: nextPort,
                    secure: nextPort === 993
                  })
                  setSaved(false)
                  setTestResult(null)
                }}
              />
            </label>

            <label className="form-group">
              <span>Логин (адрес ящика)</span>
              <input
                value={settings.user}
                onChange={(e) => {
                  setSettings({ ...settings, user: e.target.value })
                  setSaved(false)
                  setTestResult(null)
                }}
                placeholder="otdel@company.ru"
                autoComplete="username"
              />
            </label>

            <label className="form-group">
              <span>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setSaved(false)
                  setTestResult(null)
                }}
                placeholder={hasSavedPassword ? '•••••••• (сохранён на этом ПК)' : 'Пароль ящика'}
                autoComplete="current-password"
              />
              {hasSavedPassword && (
                <button
                  type="button"
                  className="btn-link department-mail-clear-pwd"
                  onClick={() => void clearPassword()}
                >
                  Удалить сохранённый пароль
                </button>
              )}
            </label>

            <div className="department-mail-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={testing}
                onClick={() => void testConnection()}
              >
                {testing ? 'Проверка…' : 'Проверить подключение'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={() => void saveSettings()}
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>

            {testResult && (
              <p
                className={`department-mail-test-result ${testResult.ok ? 'success-text' : 'error-text'}`}
                role="status"
              >
                {testResult.message}
              </p>
            )}
            {saved && <p className="sub success-text">Настройки сохранены</p>}
          </>
        )}
      </div>
    </div>
  )
}
