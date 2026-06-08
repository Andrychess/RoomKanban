/**
 * Очищает release/ перед electron-builder.
 * На Windows часто падает, если RoomKanban.exe из прошлой сборки ещё запущен.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const releaseDir = path.join(__dirname, '..', 'release')

function tryCloseRoomKanban() {
  if (process.platform !== 'win32') return
  try {
    execSync('taskkill /IM RoomKanban.exe /F', { stdio: 'ignore' })
    console.log('[clean] Закрыт запущенный RoomKanban.exe')
  } catch {
    /* not running */
  }
}

function cleanRelease() {
  if (!fs.existsSync(releaseDir)) {
    console.log('[clean] Папка release/ отсутствует — пропуск')
    return
  }

  try {
    fs.rmSync(releaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 })
    console.log('[clean] Папка release/ очищена')
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
    console.error('\n[clean] Не удалось удалить release/')
    console.error('Причина: файл занят другим процессом (часто — запущенный RoomKanban).')
    console.error('\nЧто сделать:')
    console.error('  1. Закройте RoomKanban (и win-unpacked/RoomKanban.exe, если запускали вручную)')
    console.error('  2. Закройте проводник Windows в папке release/')
    console.error('  3. Повторите: npm run dist\n')
    if (code) console.error(`Код ошибки: ${code}`)
    process.exit(1)
  }
}

tryCloseRoomKanban()
cleanRelease()
