import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Room, RoomEntryInfo } from '../../shared/types'

interface Props {
  initialFolder?: string | null
  onJoined: (room: Room) => void
}

export default function JoinRoomScreen({ initialFolder, onJoined }: Props) {
  const [folderPath, setFolderPath] = useState<string | null>(initialFolder ?? null)
  const [entry, setEntry] = useState<RoomEntryInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [roomUnlocked, setRoomUnlocked] = useState(false)
  const [roomPassword, setRoomPassword] = useState('')
  const [employeePassword, setEmployeePassword] = useState('')

  const loadEntry = useCallback(async (path: string) => {
    setLoading(true)
    setError('')
    setRoomUnlocked(false)
    setRoomPassword('')
    setEmployeePassword('')
    try {
      const info = await window.api.resolveRoomEntry(path)
      setEntry(info)
      setFolderPath(info.folderPath)
      setRoomUnlocked(!info.requiresRoomPassword)
      const defaultKey =
        info.lastUsedEmployeeKey ??
        (info.employees.length === 1 ? info.employees[0].key : null)
      setSelectedKey(defaultKey)
    } catch (err) {
      setEntry(null)
      setError(err instanceof Error ? err.message : 'Не удалось открыть папку')
    } finally {
      setLoading(false)
    }
  }, [])

  const selectedEmployee = useMemo(
    () => entry?.employees.find((e) => e.key === selectedKey) ?? null,
    [entry, selectedKey]
  )

  useEffect(() => {
    if (initialFolder) setFolderPath(initialFolder)
  }, [initialFolder])

  useEffect(() => {
    if (folderPath) void loadEntry(folderPath)
    else if (!initialFolder) {
      void window.api.selectFolder().then((p) => {
        if (p) void loadEntry(p)
      })
    }
  }, [folderPath, loadEntry, initialFolder])

  async function changeFolder() {
    const p = await window.api.selectFolder()
    if (p) await loadEntry(p)
  }

  async function unlockRoom() {
    if (!folderPath || !roomPassword) {
      setError('Введите пароль комнаты')
      return
    }
    setLoading(true)
    setError('')
    try {
      const ok = await window.api.verifyRoomPassword(folderPath, roomPassword)
      if (!ok) {
        setError('Неверный пароль комнаты')
        return
      }
      setRoomUnlocked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки пароля')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnter() {
    if (!folderPath || !selectedKey) {
      setError('Нажмите на своё имя в списке')
      return
    }
    if (entry?.requiresRoomPassword && !roomUnlocked) {
      setError('Сначала введите пароль комнаты')
      return
    }
    if (selectedEmployee?.hasPassword && !employeePassword) {
      setError('Введите пароль вашей учётной записи')
      return
    }

    setLoading(true)
    setError('')
    try {
      const room = await window.api.enterRoom(folderPath, selectedKey, {
        roomPassword: entry?.requiresRoomPassword ? roomPassword : undefined,
        employeePassword: selectedEmployee?.hasPassword ? employeePassword : undefined
      })
      onJoined(room)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  const showEmployees = entry && (!entry.requiresRoomPassword || roomUnlocked)

  return (
    <div className="card flow-card">
      <p className="step-label">Шаг 2 из 2</p>
      <h2>Кто вы?</h2>
      <p className="lead">Выберите своё имя. Список ведёт начальник отдела.</p>

      {error && <div className="error">{error}</div>}

      {entry && (
        <p className="room-pill">
          Комната: <strong>{entry.roomName}</strong>
          {entry.requiresRoomPassword && (
            <span className="room-lock-badge"> · с паролем</span>
          )}
        </p>
      )}

      <button type="button" className="btn-link folder-change" onClick={() => void changeFolder()}>
        Выбрать другую папку
      </button>

      {loading && !entry && <p className="sub">Загрузка…</p>}

      {entry?.requiresRoomPassword && !roomUnlocked && (
        <div className="password-step">
          <h3>Пароль комнаты</h3>
          <p className="sub">Эту комнату защитили паролем. Введите его, чтобы продолжить.</p>
          <div className="form-group">
            <label htmlFor="roomPassword">Пароль</label>
            <input
              id="roomPassword"
              type="password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={loading}
            onClick={() => void unlockRoom()}
          >
            Продолжить
          </button>
        </div>
      )}

      {showEmployees && entry.employees.length === 0 && (
        <div className="info-box">
          В комнате ещё нет имён. Попросите начальника добавить вас в разделе «Сотрудники».
        </div>
      )}

      {showEmployees && entry.employees.length > 0 && (
        <>
          <div className="choice-grid">
            {entry.employees.map((emp) => (
              <button
                key={emp.key}
                type="button"
                className={`choice-tile ${selectedKey === emp.key ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedKey(emp.key)
                  setEmployeePassword('')
                }}
              >
                <span className="choice-tile-name">{emp.name}</span>
                <span className="choice-tile-role">{emp.role}</span>
                {emp.isChief && <span className="choice-tile-badge">начальник</span>}
                {emp.hasPassword && <span className="choice-tile-badge">с паролем</span>}
              </button>
            ))}
          </div>

          {selectedEmployee?.hasPassword && (
            <div className="form-group">
              <label htmlFor="employeePassword">Пароль для «{selectedEmployee.name}»</label>
              <input
                id="employeePassword"
                type="password"
                value={employeePassword}
                onChange={(e) => setEmployeePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-xl btn-block"
            disabled={loading || !selectedKey}
            onClick={() => void handleEnter()}
          >
            {loading ? 'Вход…' : 'Начать работу'}
          </button>
        </>
      )}
    </div>
  )
}
