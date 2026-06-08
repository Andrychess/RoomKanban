import type { HintTopicKey } from '../../shared/helpAnchors'

/** Краткие тексты всплывающих подсказок (иконка «?» и title). */
export const HINT_SHORT: Record<HintTopicKey, string> = {
  'tabs.kanban': 'Доска с колонками: перетаскивайте карточки или меняйте этап внизу.',
  'tabs.calendar': 'Календарь по срокам выполнения. Клик по дню — новая задача.',
  'tabs.team': 'Состав отдела: имена, роли и пароли для входа в комнату.',
  'tabs.exchange': 'Быстрая передача файлов между сотрудниками без привязки к задаче.',
  'tabs.archive': 'Выполненные задачи с доски. Можно вернуть или удалить навсегда.',
  'tabs.dashboard': 'Сводка для начальника: просрочка, нагрузка, «зависшие» задачи.',
  'tabs.overdue': 'Список просроченных активных задач (не в колонке «Готово»).',
  'roomBar.sync':
    'Перечитать JSON-файлы в общей папке комнаты, если правки делали вручную или с другого ПК.',
  'roomBar.leave': 'Закрыть комнату и вернуться к выбору или созданию другой папки.',
  'kanban.newTask': 'Создать задачу во «Входящих».',
  'kanban.overdue': 'Открыть отчёт по просроченным задачам отдела.',
  'kanban.templates': 'Готовые шаблоны для частых поручений (только начальник).',
  'kanban.labels': 'Виды задач и приоритеты — цвета и подписи на карточках.',
  'kanban.filterToggle': 'Поиск и фильтры по срочности, виду и ответственному.',
  'kanban.columnAdd': 'Новая задача сразу в этой колонке.',
  'kanban.columnArchive': 'Убрать все карточки из «Готово» в архив (файлы сохранятся).',
  'kanban.columnCount': 'Слева — по фильтру, справа — всего в колонке.',
  'kanban.columnSort': 'Порядок карточек только в этой колонке.',
  'kanban.columnCollapse': 'Свернуть колонку — останется только заголовок.',
  'kanban.columnExpand': 'Развернуть колонку и показать карточки.',
  'kanban.dragHint': 'Перетащите карточку в другую колонку или выберите этап внизу.',
  'filters.search': 'Ищет в названии, описании, имени и роли ответственного.',
  'filters.priority': 'Фильтр по метке срочности.',
  'filters.type': 'Фильтр по виду задачи (письмо, звонок и т.д.).',
  'filters.ownership':
    '«Мои» и «Чужие» — относительно вас; в списке сотрудников — задачи конкретного человека.',
  'filters.reset': 'Сбросить все фильтры.',
  'taskCard.details': 'Просмотр без блокировки: комментарии и новые файлы.',
  'taskCard.edit': 'Полное редактирование. Если занято — откроется только просмотр.',
  'taskCard.status': 'Смена этапа без открытия карточки.',
  'taskCard.collapse': 'Свернуть карточку — останется название и этап.',
  'taskCard.expand': 'Развернуть карточку с описанием и файлами.',
  'taskEditor.delete': 'Удалить задачу безвозвратно вместе с файлами и историей.',
  'calendar.addDay': 'Создать задачу с выбранным сроком.',
  'calendar.noDue': 'Задачи без даты срока не показываются в сетке месяца.',
  'calendar.overdueLegend': 'Красным — просроченные незавершённые задачи.',
  'archive.restore': 'Вернуть на доску в колонку «Готово».',
  'archive.delete': 'Удалить задачу, файлы и историю без восстановления.',
  'archive.open': 'Просмотр и комментарии без редактирования полей.',
  'exchange.add': 'Выбрать файлы с диска и положить в окно сотрудника.',
  'exchange.clear': 'Удалить все файлы только из этого окна обмена.',
  'exchange.open': 'Открыть файл в программе по умолчанию.',
  'exchange.remove': 'Убрать один файл из окна обмена.',
  'dashboard.overdueCard': 'Перейти к списку просроченных задач.',
  'dashboard.noDue': 'Активные задачи без указанного срока.',
  'dashboard.stuck': 'В «В работе» без движения дольше недели.',
  'dashboard.workload': 'Нагрузка по сотрудникам: всего, в работе, просрочено.',
  'reminders.days': 'Например: 1, 3 — напоминания за 1 и за 3 дня до срока.',
  'reminders.assignee': 'Всплывающее уведомление на ПК ответственного.',
  'reminders.chief': 'Всплывающее уведомление на ПК начальника комнаты.'
}

/** @deprecated Используйте HINT_SHORT и topic в HintIcon */
export const UI_HINTS = {
  tabs: {
    kanban: HINT_SHORT['tabs.kanban'],
    calendar: HINT_SHORT['tabs.calendar'],
    team: HINT_SHORT['tabs.team'],
    exchange: HINT_SHORT['tabs.exchange'],
    archive: HINT_SHORT['tabs.archive'],
    dashboard: HINT_SHORT['tabs.dashboard'],
    overdue: HINT_SHORT['tabs.overdue']
  },
  roomBar: {
    sync: HINT_SHORT['roomBar.sync'],
    leave: HINT_SHORT['roomBar.leave']
  },
  kanban: {
    newTask: HINT_SHORT['kanban.newTask'],
    overdue: HINT_SHORT['kanban.overdue'],
    templates: HINT_SHORT['kanban.templates'],
    labels: HINT_SHORT['kanban.labels'],
    filterToggle: HINT_SHORT['kanban.filterToggle'],
    columnAdd: HINT_SHORT['kanban.columnAdd'],
    columnArchive: HINT_SHORT['kanban.columnArchive'],
    columnCount: HINT_SHORT['kanban.columnCount'],
    columnSort: HINT_SHORT['kanban.columnSort'],
    columnCollapse: HINT_SHORT['kanban.columnCollapse'],
    columnExpand: HINT_SHORT['kanban.columnExpand'],
    dragHint: HINT_SHORT['kanban.dragHint']
  },
  filters: {
    search: HINT_SHORT['filters.search'],
    priority: HINT_SHORT['filters.priority'],
    type: HINT_SHORT['filters.type'],
    ownership: HINT_SHORT['filters.ownership'],
    reset: HINT_SHORT['filters.reset']
  },
  taskCard: {
    details: HINT_SHORT['taskCard.details'],
    edit: HINT_SHORT['taskCard.edit'],
    status: HINT_SHORT['taskCard.status'],
    collapse: HINT_SHORT['taskCard.collapse'],
    expand: HINT_SHORT['taskCard.expand']
  },
  taskEditor: {
    delete: HINT_SHORT['taskEditor.delete']
  },
  calendar: {
    addDay: HINT_SHORT['calendar.addDay'],
    noDue: HINT_SHORT['calendar.noDue'],
    overdueLegend: HINT_SHORT['calendar.overdueLegend']
  },
  archive: {
    restore: HINT_SHORT['archive.restore'],
    delete: HINT_SHORT['archive.delete'],
    open: HINT_SHORT['archive.open']
  },
  exchange: {
    add: HINT_SHORT['exchange.add'],
    clear: HINT_SHORT['exchange.clear'],
    open: HINT_SHORT['exchange.open'],
    remove: HINT_SHORT['exchange.remove']
  },
  dashboard: {
    overdueCard: HINT_SHORT['dashboard.overdueCard'],
    noDue: HINT_SHORT['dashboard.noDue'],
    stuck: HINT_SHORT['dashboard.stuck'],
    workload: HINT_SHORT['dashboard.workload']
  },
  reminders: {
    days: HINT_SHORT['reminders.days'],
    assignee: HINT_SHORT['reminders.assignee'],
    chief: HINT_SHORT['reminders.chief']
  }
} as const
