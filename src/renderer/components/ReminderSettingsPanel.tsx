import { useEffect, useState } from 'react'
import type { ReminderSettings } from '../../shared/types'
import { HintLabel } from './HintIcon'

export default function ReminderSettingsPanel() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null)
  const [daysInput, setDaysInput] = useState('1, 3')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.api.getReminderSettings().then((s) => {
      setSettings(s)
      setDaysInput(s.days_before.join(', '))
    })
  }, [])

  async function save() {
    if (!settings) return
    const days_before = daysInput
      .split(/[,;\s]+/)
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0)
    if (days_before.length === 0) {
      alert('Укажите дни через запятую, например: 1, 3')
      return
    }
    setLoading(true)
    setSaved(false)
    try {
      const next = await window.api.saveReminderSettings({
        ...settings,
        days_before
      })
      setSettings(next)
      setSaved(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setLoading(false)
    }
  }

  if (!settings) return null

  return (
    <section className="dashboard-section reminder-settings">
      <h3>Напоминания о сроках</h3>
      <p className="sub">
        Уведомления Windows на этом компьютере. Ответственный видит свои задачи, начальник — все.
      </p>
      <label className="form-group">
        <HintLabel topic="reminders.days">
          Напомнить за (дней до срока, через запятую)
        </HintLabel>
        <input value={daysInput} onChange={(e) => setDaysInput(e.target.value)} />
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.notify_assignee}
          onChange={(e) => setSettings({ ...settings, notify_assignee: e.target.checked })}
        />
        <HintLabel topic="reminders.assignee">Уведомлять ответственного</HintLabel>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.notify_chief}
          onChange={(e) => setSettings({ ...settings, notify_chief: e.target.checked })}
        />
        <HintLabel topic="reminders.chief">Уведомлять начальника</HintLabel>
      </label>
      <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void save()}>
        {loading ? 'Сохранение…' : 'Сохранить напоминания'}
      </button>
      {saved && <p className="sub success-text">Сохранено</p>}
    </section>
  )
}
