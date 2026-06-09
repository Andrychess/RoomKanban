export interface DepartmentMailSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  updated_at: number
}

export interface DepartmentMailConnectionInput {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}

export interface MailConnectionTestResult {
  ok: boolean
  message: string
  mailbox?: string
  message_count?: number
}

export const DEFAULT_DEPARTMENT_MAIL_SETTINGS: DepartmentMailSettings = {
  enabled: false,
  host: '',
  port: 993,
  secure: true,
  user: '',
  updated_at: 0
}

export type DepartmentMailMessageStatus = 'pending' | 'discarded' | 'task_created'

export interface DepartmentMailMessage {
  id: string
  uid: number
  message_id: string
  subject: string
  from: string
  /** ISO 8601 */
  date: string
  body_preview: string
  attachment_count: number
  attachment_names: string[]
  status: DepartmentMailMessageStatus
  task_id: string | null
  fetched_at: number
}

export interface DepartmentMailInboxData {
  messages: DepartmentMailMessage[]
  updated_at: number
}

export interface FetchDepartmentMailPeriodInput {
  date_from: string
  date_to: string
}

export interface FetchDepartmentMailPeriodResult {
  added_count: number
  skipped_known: number
  total_matched: number
  truncated: boolean
  inbox: DepartmentMailInboxData
}

export interface DepartmentMailMessageBody {
  body: string
}

export interface MailTaskDraftProgress {
  message_id: string
  phase: 'message' | 'attachment'
  current: number
  total: number
  file_name: string
}

export interface MailTaskDraftResult {
  message_id: string
  title: string
  description: string
  assignee_pc: string
  source_files: { name: string; path: string }[]
  temp_dir: string
}
