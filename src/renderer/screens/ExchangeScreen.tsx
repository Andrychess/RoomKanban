import { useState } from 'react'
import type { Room } from '../../shared/types'
import { profilesFromRoom } from '../../shared/employees'
import ConfirmDialog from '../components/ConfirmDialog'
import TooltipWrap from '../components/TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'
import { useExchange } from '../hooks/useExchange'

interface Props {
  room: Room
}

export default function ExchangeScreen({ room }: Props) {
  const { filesByEmployee } = useExchange(room.path)
  const profiles = profilesFromRoom(room)
  const [clearKey, setClearKey] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  async function addFiles(employeeKey: string) {
    setBusyKey(employeeKey)
    try {
      const paths = await window.api.selectTaskFiles()
      if (paths.length > 0) {
        await window.api.addExchangeFiles(employeeKey, paths)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось добавить файл')
    } finally {
      setBusyKey(null)
    }
  }

  async function confirmClear() {
    if (!clearKey) return
    setClearing(true)
    try {
      await window.api.clearExchangeFiles(clearKey)
      setClearKey(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось очистить')
    } finally {
      setClearing(false)
    }
  }

  async function openFile(employeeKey: string, fileId: string) {
    try {
      await window.api.openExchangeFile(employeeKey, fileId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть файл')
    }
  }

  return (
    <div className="exchange-page">
      <div className="exchange-page-header">
        <h2>Обмен файлами</h2>
        <p className="lead">
          Положите файл в окно нужного сотрудника — он увидит его у себя. Очистка удаляет все файлы
          только из этого окна.
        </p>
      </div>

      <div className="exchange-grid">
        {profiles.map((profile) => {
          const files = filesByEmployee[profile.key] ?? []
          const isMe = profile.key === room.pcId
          return (
            <section
              key={profile.key}
              className={`exchange-panel card ${isMe ? 'exchange-panel--me' : ''}`}
            >
              <header className="exchange-panel-head">
                <div>
                  <h3>{profile.name}</h3>
                  <span className="exchange-panel-role">
                    {profile.role}
                    {profile.isChief ? ' · начальник' : ''}
                    {isMe ? ' · это вы' : ''}
                  </span>
                </div>
                <span className="exchange-panel-count">{files.length}</span>
              </header>

              <ul className="exchange-file-list">
                {files.length === 0 && <li className="exchange-empty">Пока пусто</li>}
                {files.map((file) => (
                  <li key={file.id}>
                    <TooltipWrap text={UI_HINTS.exchange.open}>
                      <button
                        type="button"
                        className="exchange-file-link"
                        onClick={() => void openFile(profile.key, file.id)}
                      >
                        {file.file_name}
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text={UI_HINTS.exchange.remove}>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() =>
                          void window.api.removeExchangeFile(profile.key, file.id).catch((err) => {
                            alert(err instanceof Error ? err.message : 'Ошибка')
                          })
                        }
                      >
                        ×
                      </button>
                    </TooltipWrap>
                  </li>
                ))}
              </ul>

              <div className="exchange-panel-actions">
                <TooltipWrap text={UI_HINTS.exchange.add}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyKey === profile.key}
                    onClick={() => void addFiles(profile.key)}
                  >
                    {busyKey === profile.key ? '…' : '+ Добавить файл'}
                  </button>
                </TooltipWrap>
                {files.length > 0 && (
                  <TooltipWrap text={UI_HINTS.exchange.clear}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={clearing}
                      onClick={() => setClearKey(profile.key)}
                    >
                      Очистить
                    </button>
                  </TooltipWrap>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {clearKey && (
        <ConfirmDialog
          title="Очистить окно?"
          message={`Удалить все файлы у «${room.state.employees[clearKey]?.name ?? 'сотрудника'}»?`}
          confirmLabel="Очистить"
          danger
          loading={clearing}
          onCancel={() => !clearing && setClearKey(null)}
          onConfirm={() => void confirmClear()}
        />
      )}
    </div>
  )
}
