import { useState } from 'react'

interface Props {
  onContinue: (mode: 'create' | 'join', folderPath: string) => void
}

export default function OnboardingScreen({ onContinue }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('join')
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function pickFolder() {
    setError('')
    const path = await window.api.selectFolder()
    if (path) setFolderPath(path)
  }

  function handleContinue() {
    if (!folderPath) {
      setError('Сначала укажите папку на диске')
      return
    }
    onContinue(mode, folderPath)
  }

  return (
    <div className="card flow-card">
      <p className="step-label">Шаг 1 из 2</p>
      <h2>С чего начнём?</h2>
      <p className="lead">Все данные хранятся в обычной папке — на компьютере, флешке или в общей сети.</p>

      {error && <div className="error">{error}</div>}

      <div className="choice-grid choice-grid-2">
        <button
          type="button"
          className={`choice-tile ${mode === 'join' ? 'selected' : ''}`}
          onClick={() => setMode('join')}
        >
          <span className="choice-tile-name">Войти в комнату</span>
          <span className="choice-tile-role">Папка отдела уже есть</span>
        </button>
        <button
          type="button"
          className={`choice-tile ${mode === 'create' ? 'selected' : ''}`}
          onClick={() => setMode('create')}
        >
          <span className="choice-tile-name">Создать комнату</span>
          <span className="choice-tile-role">Новый отдел, пустая папка</span>
        </button>
      </div>

      <div className="form-group">
        <label>Папка на диске</label>
        {folderPath ? (
          <div className="folder-path folder-path-short" title={folderPath}>
            {folderPath}
          </div>
        ) : (
          <p className="sub">Папка ещё не выбрана</p>
        )}
        <button type="button" className="btn btn-block" onClick={() => void pickFolder()}>
          Указать папку…
        </button>
      </div>

      <button type="button" className="btn btn-primary btn-xl btn-block" onClick={handleContinue}>
        Далее
      </button>
    </div>
  )
}
