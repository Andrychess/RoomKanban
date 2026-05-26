import type { TaskTemplate } from '../../shared/types'
import { addDaysIso, todayIso } from '../../shared/dates'
import type { Task } from '../../shared/types'

export interface TemplateApplyValues {
  title: string
  description: string
  typeId: string
  priorityId: string
  status: Task['status']
  dueDate: string
  checklist: Task['checklist']
}

interface Props {
  templates: TaskTemplate[]
  onApply: (values: TemplateApplyValues) => void
}

export default function TaskTemplatePicker({ templates, onApply }: Props) {
  if (templates.length === 0) return null

  function apply(tpl: TaskTemplate) {
    onApply({
      title: tpl.title,
      description: tpl.description,
      typeId: tpl.type_id,
      priorityId: tpl.priority_id,
      status: tpl.status,
      dueDate: addDaysIso(todayIso(), tpl.due_days_offset),
      checklist: tpl.checklist.map((c) => ({ ...c, id: `chk_${Math.random().toString(36).slice(2, 9)}` }))
    })
  }

  return (
    <div className="task-template-picker">
      <span className="task-template-label">Шаблон:</span>
      {templates.map((tpl) => (
        <button key={tpl.id} type="button" className="btn btn-ghost btn-sm" onClick={() => apply(tpl)}>
          {tpl.name}
        </button>
      ))}
    </div>
  )
}
