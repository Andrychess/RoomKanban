export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateStatus {
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion?: string
  progress?: number
  message?: string
  enabled: boolean
}

export function createInitialAppUpdateStatus(
  currentVersion: string,
  enabled: boolean
): AppUpdateStatus {
  return {
    phase: 'idle',
    currentVersion,
    enabled
  }
}
