import { useEffect, useState } from 'react'
import type { EmployeeProfile, Room } from '../../shared/types'
import { profilesFromRoom } from '../../shared/employees'
import ConfirmDialog from '../components/ConfirmDialog'

interface Props {
  room: Room
  onRoomUpdated: (room: Room) => void
}

export default function TeamScreen({ room, onRoomUpdated }: Props) {
  const [employees, setEmployees] = useState(() => profilesFromRoom(room))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPassword, setEditPassword] = useState('')

  const [newRoomPassword, setNewRoomPassword] = useState('')

  const [deleteKey, setDeleteKey] = useState<string | null>(null)

  const isChief = room.isChief
  const roomHasPassword = Boolean(room.state.room_password?.salt && room.state.room_password?.hash)

  useEffect(() => {
    setEmployees(profilesFromRoom(room))
  }, [room])

  function syncRoom(updated: Room) {
    setEmployees(profilesFromRoom(updated))
    onRoomUpdated(updated)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newRole.trim()) {
      setError('Укажите имя и роль')
      return
    }
    setLoading(true)
    setError('')
    try {
      const updated = await window.api.addEmployee(newName, newRole)
      syncRoom(updated)
      setNewName('')
      setNewRole('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(emp: EmployeeProfile) {
    setEditingKey(emp.key)
    setEditName(emp.name)
    setEditRole(emp.role)
    setEditPassword('')
    setError('')
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditName('')
    setEditRole('')
    setEditPassword('')
  }

  async function saveEdit(employeeKey: string) {
    if (!editName.trim() || !editRole.trim()) {
      setError('Укажите имя и роль')
      return
    }
    setLoading(true)
    setError('')
    try {
      let updated = await window.api.updateEmployee(employeeKey, editName, editRole)
      if (editPassword.trim()) {
        updated = await window.api.setEmployeePassword(employeeKey, editPassword.trim())
      }
      syncRoom(updated)
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteKey) return
    setLoading(true)
    setError('')
    try {
      const updated = await window.api.removeEmployee(deleteKey)
      syncRoom(updated)
      setDeleteKey(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    } finally {
      setLoading(false)
    }
  }

  async function applyRoomPassword() {
    if (!newRoomPassword.trim()) {
      setError('Введите новый пароль или нажмите «Снять пароль»')
      return
    }
    setLoading(true)
    setError('')
    try {
      const updated = await window.api.setRoomPassword(newRoomPassword.trim())
      syncRoom(updated)
      setNewRoomPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить пароль')
    } finally {
      setLoading(false)
    }
  }

  async function clearRoomPassword() {
    setLoading(true)
    setError('')
    try {
      const updated = await window.api.setRoomPassword(null)
      syncRoom(updated)
      setNewRoomPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось снять пароль')
    } finally {
      setLoading(false)
    }
  }

  async function clearEmployeePassword(employeeKey: string) {
    setLoading(true)
    setError('')
    try {
      const updated = await window.api.setEmployeePassword(employeeKey, null)
      syncRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось снять пароль')
    } finally {
      setLoading(false)
    }
  }

  const deleteTarget = deleteKey ? employees.find((e) => e.key === deleteKey) : null

  return (
    <div className="team-page">
      <div className="team-page-header">
        <h2>Сотрудники</h2>
        <p className="lead">
          {isChief
            ? 'Добавьте коллег — при входе они выберут своё имя из этого списка.'
            : 'Это люди, под чьим именем можно войти в комнату. Меняет список только начальник.'}
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {isChief && (
        <section className="card team-security">
          <h3>Защита паролем</h3>
          <p className="sub">
            Пароль комнаты нужен всем при входе. Пароль учётной записи — только при выборе этого
            имени.
          </p>
          <div className="form-group">
            <label htmlFor="roomPwd">Пароль на комнату</label>
            <input
              id="roomPwd"
              type="password"
              value={newRoomPassword}
              onChange={(e) => setNewRoomPassword(e.target.value)}
              placeholder={roomHasPassword ? 'Новый пароль' : 'Задать пароль'}
              autoComplete="new-password"
            />
          </div>
          <div className="team-row-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void applyRoomPassword()}
            >
              {roomHasPassword ? 'Сменить пароль комнаты' : 'Установить пароль комнаты'}
            </button>
            {roomHasPassword && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={() => void clearRoomPassword()}
              >
                Снять пароль комнаты
              </button>
            )}
          </div>
        </section>
      )}

      <ul className="team-list">
        {employees.map((emp) => (
          <li key={emp.key} className="team-row">
            {editingKey === emp.key && isChief ? (
              <form
                className="team-row-edit"
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveEdit(emp.key)
                }}
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Имя"
                  aria-label="Имя"
                />
                <input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="Роль"
                  aria-label="Роль"
                />
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Новый пароль учётной записи (необязательно)"
                  autoComplete="new-password"
                />
                {employees.find((e) => e.key === emp.key)?.hasPassword && (
                  <button
                    type="button"
                    className="btn-link danger"
                    disabled={loading}
                    onClick={() => void clearEmployeePassword(emp.key)}
                  >
                    Снять пароль учётной записи
                  </button>
                )}
                <div className="team-row-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    Сохранить
                  </button>
                  <button type="button" className="btn" disabled={loading} onClick={cancelEdit}>
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="team-row-info">
                  <strong>{emp.name}</strong>
                  <span>{emp.role}</span>
                  {emp.isChief && <span className="employee-chief-badge">начальник</span>}
                  {emp.hasPassword && <span className="choice-tile-badge">с паролем</span>}
                  {emp.key === room.pcId && (
                    <span className="employee-you-badge">вы сейчас</span>
                  )}
                </div>
                {isChief && (
                  <div className="team-row-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => startEdit(emp)}>
                      Изменить
                    </button>
                    {!emp.isChief && (
                      <button
                        type="button"
                        className="btn btn-ghost team-btn-danger"
                        onClick={() => setDeleteKey(emp.key)}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {employees.length === 0 && (
        <p className="sub team-empty">Пока никого нет в списке.</p>
      )}

      {isChief && (
        <form className="team-add card" onSubmit={(e) => void handleAdd(e)}>
          <h3>Добавить сотрудника</h3>
          <div className="form-group">
            <label htmlFor="teamName">Имя</label>
            <input
              id="teamName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Иван Петров"
            />
          </div>
          <div className="form-group">
            <label htmlFor="teamRole">Роль</label>
            <input
              id="teamRole"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Бухгалтер"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Добавление…' : 'Добавить в состав'}
          </button>
        </form>
      )}

      {deleteKey && deleteTarget && (
        <ConfirmDialog
          title="Удалить из состава?"
          message={`Сотрудник «${deleteTarget.name}» будет удалён. Его задачи перейдут к начальнику.`}
          confirmLabel="Удалить"
          danger
          loading={loading}
          onCancel={() => !loading && setDeleteKey(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  )
}
