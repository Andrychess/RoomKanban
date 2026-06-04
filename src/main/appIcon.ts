import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

/** Путь к PNG-иконке (1024×1024) для окна в dev и extraResources в сборке. */
export function resolveAppIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'icon.png'),
        join(process.resourcesPath, 'build', 'icon.png')
      ]
    : [
        join(process.cwd(), 'build', 'icon.png'),
        join(process.cwd(), 'resources', 'icon.png'),
        join(__dirname, '../../build/icon.png'),
        join(__dirname, '../../resources/icon.png')
      ]

  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return undefined
}
