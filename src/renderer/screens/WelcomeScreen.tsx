import { useCallback, useEffect, useState } from 'react'
import type { RoomListItem, RoomsSyncSummary } from '../../shared/types'

interface Props {
  onCreate: () => void
  onOpen: () => void
  onFirstLaunch: () => void
  onOpenRecent: (path: string) => void
}

function roomStatusText(status: RoomListItem['status']): string {
  switch (status) {
    case 'synced':
      return 'Доступна'
    case 'unavailable':
      return 'Папка недоступна'
    case 'not_found':
      return 'Не найдена'
    case 'invalid':
      return 'Ошибка данных'
  }
}

export default function WelcomeScreen({ onCreate, onOpen, onFirstLaunch, onOpenRecent }: Props) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<RoomsSyncSummary | null>(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.listRooms()
      setSummary(data)
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRooms().then((data) => {
      if (
        data &&
        data.rooms.length === 0 &&
        !sessionStorage.getItem('rk_onboarded')
      ) {
        sessionStorage.setItem('rk_onboarded', '1')
        onFirstLaunch()
      }
    })
  }, [loadRooms, onFirstLaunch])

  const rooms = summary?.rooms ?? []
  const availableRooms = rooms.filter((r) => r.status === 'synced')

  return (
    <div className="welcome-simple">
      <section className="welcome-hero card">
        <h2>Добро пожаловать</h2>
        <p className="lead">
          Здесь ведут задачи отдела: письма, поручения и сроки — в одном окне на общей папке.
        </p>

        <div className="welcome-hero-actions">
          <button type="button" className="btn btn-primary btn-xl" onClick={onOpen}>
            Открыть комнату
          </button>
          <button type="button" className="btn btn-xl" onClick={onCreate}>
            Создать новую комнату
          </button>
        </div>
      </section>

      <section className="card rooms-simple-card">
        <div className="rooms-simple-head">
          <h3>Недавние комнаты</h3>
          {!loading && (
            <button type="button" className="btn-link" onClick={() => void loadRooms()}>
              Обновить
            </button>
          )}
        </div>

        {loading && <p className="sub">Загрузка…</p>}

        {!loading && availableRooms.length === 0 && (
          <p className="rooms-empty-simple">
            Пока нет сохранённых комнат. Нажмите «Открыть комнату» и укажите папку, которой пользуется
            ваш отдел.
          </p>
        )}

        {!loading && availableRooms.length > 0 && (
          <ul className="room-simple-list">
            {availableRooms.map((room) => (
              <li key={room.path}>
                <button
                  type="button"
                  className="room-simple-item"
                  onClick={() => onOpenRecent(room.path)}
                >
                  <span className="room-simple-name">{room.room_name ?? 'Комната'}</span>
                  <span className="room-simple-meta">
                    {room.task_count} задач · {room.employee_count} человек
                  </span>
                  <span className="room-simple-action">Открыть →</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && rooms.some((r) => r.status !== 'synced') && (
          <details className="rooms-issues">
            <summary>Есть недоступные комнаты</summary>
            <ul>
              {rooms
                .filter((r) => r.status !== 'synced')
                .map((r) => (
                  <li key={r.path}>
                    {r.room_name ?? 'Комната'} — {roomStatusText(r.status)}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}
