import { useEffect, useState } from 'react'
import type { Room } from '../../shared/types'

interface Props {
  initialFolder?: string | null
  onCreated: (room: Room) => void
}

export default function CreateRoomScreen({ initialFolder, onCreated }: Props) {
  const [folderPath, setFolderPath] = useState<string | null>(initialFolder ?? null)
  const [roomName, setRoomName] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('Начальник')
  const [roomPassword, setRoomPassword] = useState('')
  const [chiefPassword, setChiefPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!folderPath) {
      void window.api.selectFolder().then((p) => {
        if (p) setFolderPath(p)
      })
    }
  }, [folderPath])

  async function changeFolder() {
    const p = await window.api.selectFolder()
    if (p) {
      setFolderPath(p)
      setError('')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!folderPath) {
      setError('Укажите папку')
      return
    }
    if (!roomName.trim() || !userName.trim() || !userRole.trim()) {
      setError('Заполните все поля')
      return
    }

    setLoading(true)
    setError('')
    try {
      const room = await window.api.createRoom(
        folderPath,
        roomName,
        userName,
        userRole,
        roomPassword.trim() || undefined,
        chiefPassword.trim() || undefined
      )
      onCreated(room)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать комнату')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card flow-card">
      <h2>Новая комната</h2>
      <p className="lead">Вы будете начальником и сможете добавить сотрудников в разделе «Сотрудники».</p>

      {error && <div className="error">{error}</div>}

      <button type="button" className="btn-link folder-change" onClick={() => void changeFolder()}>
        Папка: {folderPath ? 'изменить' : 'выбрать'}
      </button>

      <form onSubmit={(e) => void handleCreate(e)}>
        <div className="form-group">
          <label htmlFor="roomName">Название отдела или комнаты</label>
          <input
            id="roomName"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Например: Бухгалтерия"
          />
        </div>
        <div className="form-group">
          <label htmlFor="userName">Ваше имя</label>
          <input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Как вас видят коллеги"
          />
        </div>
        <div className="form-group">
          <label htmlFor="userRole">Должность</label>
          <input
            id="userRole"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            placeholder="Начальник"
          />
        </div>

        <details className="task-editor-section">
          <summary>Пароли (необязательно)</summary>
          <div className="task-editor-section-body">
            <div className="form-group">
              <label htmlFor="roomPassword">Пароль на комнату</label>
              <input
                id="roomPassword"
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="Оставьте пустым, если не нужен"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="chiefPassword">Пароль вашей учётной записи</label>
              <input
                id="chiefPassword"
                type="password"
                value={chiefPassword}
                onChange={(e) => setChiefPassword(e.target.value)}
                placeholder="Чтобы другие не вошли под вашим именем"
                autoComplete="new-password"
              />
            </div>
          </div>
        </details>

        <button type="submit" className="btn btn-primary btn-xl btn-block" disabled={loading}>
          {loading ? 'Создание…' : 'Создать и начать работу'}
        </button>
      </form>
    </div>
  )
}
