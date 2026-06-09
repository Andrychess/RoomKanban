import type { DepartmentMailMessage } from '../../shared/departmentMail'

interface Props {
  message: DepartmentMailMessage
  selected: boolean
  onSelect: () => void
  formatDate: (iso: string) => string
}

function attachmentLabel(count: number): string {
  if (count === 0) return '0 файлов'
  if (count === 1) return '1 файл'
  if (count >= 2 && count <= 4) return `${count} файла`
  return `${count} файлов`
}

export default function DepartmentMailMessageTile({
  message,
  selected,
  onSelect,
  formatDate
}: Props) {
  return (
    <button
      type="button"
      className={`department-mail-tile ${selected ? 'active' : ''}`}
      onClick={onSelect}
    >
      <span className="department-mail-tile-subject">{message.subject}</span>
      <span className="department-mail-tile-from">{message.from}</span>
      <span className="department-mail-tile-meta">
        <span className="department-mail-tile-date">{formatDate(message.date)}</span>
        <span className="department-mail-tile-attachments" title="Прикреплённые файлы">
          📎 {attachmentLabel(message.attachment_count)}
        </span>
      </span>
    </button>
  )
}
