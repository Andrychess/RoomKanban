import { DEFAULT_TASK_TYPES } from './defaultTaskTypes'
import type { TaskStatus } from './taskStatus'

export interface SeedTestTaskDraft {
  title: string
  description: string
  status: TaskStatus
  type_id: string
  due_date?: string | null
}

function dueOffset(days: number, time?: string): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const date = `${y}-${m}-${day}`
  return time ? `${date}T${time}` : date
}

const [general, urgent, docs, approval] = DEFAULT_TASK_TYPES.map((t) => t.id)

/** 15 задач для ручного тестирования: 4 + 4 + 4 + 3 по колонкам канбана. */
export const SEED_TEST_TASK_DRAFTS: SeedTestTaskDraft[] = [
  {
    title: 'Входящее: запрос от клиента',
    description: 'Клиент просит уточнить сроки по договору. Нужно ответить в течение двух рабочих дней.',
    status: 'review',
    type_id: general,
    due_date: dueOffset(5, '17:00')
  },
  {
    title: 'Новая заявка на закупку',
    description: 'Поступила заявка на канцтовары. Проверить лимит и согласовать с бухгалтерией.',
    status: 'review',
    type_id: docs,
    due_date: null
  },
  {
    title: 'Письмо из головного офиса',
    description: 'Требуется ознакомление с регламентом отчётности за квартал.',
    status: 'review',
    type_id: approval,
    due_date: dueOffset(10)
  },
  {
    title: 'Обратная связь по проекту',
    description: 'Коллеги прислали комментарии к презентации. Разобрать и распределить правки.',
    status: 'review',
    type_id: general,
    due_date: dueOffset(-2)
  },
  {
    title: 'Подготовить отчёт за неделю',
    description: 'Собрать статистику по выполненным задачам и отправить руководителю.',
    status: 'todo',
    type_id: docs,
    due_date: dueOffset(3, '12:00')
  },
  {
    title: 'Согласовать договор аренды',
    description: 'Сверить условия с юристом и внести правки в финальную версию.',
    status: 'todo',
    type_id: approval,
    due_date: dueOffset(7)
  },
  {
    title: 'Обновить таблицу контактов',
    description: 'Актуализировать телефоны и e-mail партнёров в общей таблице.',
    status: 'todo',
    type_id: general,
    due_date: null
  },
  {
    title: 'Срочно: исправить ошибку в счёте',
    description: 'В счёте №184 указана неверная сумма НДС. Перевыставить документ.',
    status: 'todo',
    type_id: urgent,
    due_date: dueOffset(1, '18:00')
  },
  {
    title: 'Верстка презентации для совещания',
    description: 'Оформить слайды по шаблону компании, добавить графики из Excel.',
    status: 'in_progress',
    type_id: docs,
    due_date: dueOffset(2, '15:30')
  },
  {
    title: 'Согласование отпуска сотрудника',
    description: 'Проверить график и подписать заявление в кадровой системе.',
    status: 'in_progress',
    type_id: approval,
    due_date: dueOffset(4)
  },
  {
    title: 'Настройка общего принтера',
    description: 'Установить драйвер и проверить печать с двух рабочих мест.',
    status: 'in_progress',
    type_id: general,
    due_date: null
  },
  {
    title: 'Подготовка к аудиту',
    description: 'Собрать первичные документы за последний месяц в отдельную папку.',
    status: 'in_progress',
    type_id: urgent,
    due_date: dueOffset(-1)
  },
  {
    title: 'Отправлено: акт выполненных работ',
    description: 'Акт подписан и передан заказчику. Копия сохранена в архиве.',
    status: 'done',
    type_id: docs,
    due_date: dueOffset(-5)
  },
  {
    title: 'Закрыта: заявка в IT-поддержку',
    description: 'Восстановлен доступ к сетевой папке. Пользователь подтвердил решение.',
    status: 'done',
    type_id: general,
    due_date: null
  },
  {
    title: 'Завершено: инструктаж по охране труда',
    description: 'Все сотрудники отдела прошли инструктаж, журнал подписан.',
    status: 'done',
    type_id: approval,
    due_date: dueOffset(-3)
  }
]

export const SEED_TEST_TASK_COUNT = SEED_TEST_TASK_DRAFTS.length
