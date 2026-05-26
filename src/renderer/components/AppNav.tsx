interface Props {
  canBack: boolean
  onBack: () => void
}

/** Минимальная навигация: только «Назад» */
export default function AppNav({ canBack, onBack }: Props) {
  if (!canBack) return null

  return (
    <nav className="app-nav" aria-label="Навигация">
      <button type="button" className="btn btn-nav-back" onClick={onBack}>
        ← Назад
      </button>
    </nav>
  )
}
