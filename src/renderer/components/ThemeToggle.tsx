import type { AppTheme } from '../../shared/types'

interface Props {
  theme: AppTheme
  onToggle: () => void
}

export default function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm theme-toggle"
      onClick={onToggle}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
    >
      {theme === 'dark' ? '☀ Светлая' : '☾ Тёмная'}
    </button>
  )
}
