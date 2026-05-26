/** Сетевой UNC-путь или похожий — ждём дольше стабилизации файла после записи. */
export function isLikelyNetworkPath(folderPath: string): boolean {
  const normalized = folderPath.replace(/\//g, '\\')
  if (normalized.startsWith('\\\\')) return true
  // OneDrive / SharePoint часто под буквой диска — эвристика по типичным корням
  if (/^[A-Za-z]:\\Users\\[^\\]+\\(OneDrive|YandexDisk|Dropbox|iCloudDrive)/i.test(normalized)) {
    return true
  }
  return false
}

export function chokidarWriteFinish(roomPath: string): {
  stabilityThreshold: number
  pollInterval: number
} {
  if (isLikelyNetworkPath(roomPath)) {
    return { stabilityThreshold: 900, pollInterval: 150 }
  }
  return { stabilityThreshold: 300, pollInterval: 100 }
}
