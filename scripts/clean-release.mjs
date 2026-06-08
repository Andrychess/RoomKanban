/**
 * Очищает папку сборки текущей версии перед electron-builder.
 * Старый release/win-unpacked (до v0.1.3) не блокирует сборку — выход теперь release/X.Y.Z/.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
const versionDir = path.join(rootDir, 'release', pkg.version)
const legacyDir = path.join(rootDir, 'release', 'win-unpacked')

function sleep(ms) {
  try {
    execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: 'ignore' })
  } catch {
    /* ignore */
  }
}

function tryCloseAppProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['RoomKanban.exe', 'electron.exe']) {
    try {
      execSync(`taskkill /IM ${image} /F`, { stdio: 'ignore' })
      console.log(`[clean] Закрыт процесс ${image}`)
    } catch {
      /* not running */
    }
  }
  sleep(800)
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) return true
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 })
    return true
  } catch {
    try {
      execSync(`cmd /c "rmdir /s /q "${dir.replace(/"/g, '""')}""`, {
        cwd: rootDir,
        stdio: 'ignore'
      })
      return !fs.existsSync(dir)
    } catch {
      return false
    }
  }
}

function cleanVersionOutput() {
  if (!fs.existsSync(versionDir)) {
    console.log(`[clean] release/${pkg.version}/ — пусто, пропуск`)
    return
  }
  if (removeDir(versionDir)) {
    console.log(`[clean] release/${pkg.version}/ очищена`)
    return
  }
  console.error(`\n[clean] Не удалось очистить release/${pkg.version}/`)
  printLockHelp()
  process.exit(1)
}

function warnLegacyOutput() {
  if (!fs.existsSync(legacyDir)) return
  if (removeDir(path.join(rootDir, 'release', 'win-unpacked'))) {
    console.log('[clean] Удалена устаревшая release/win-unpacked/')
    return
  }
  console.warn(
    '[clean] Предупреждение: release/win-unpacked/ занята другим процессом (Cursor, антивирус).'
  )
  console.warn('[clean] Сборка пойдёт в release/' + pkg.version + '/ — это не мешает.')
}

function printLockHelp() {
  console.error('Файл занят другим процессом.')
  console.error('\nЧто сделать:')
  console.error('  1. Закройте RoomKanban и npm run dev')
  console.error('  2. Закройте проводник в папке release/')
  console.error('  3. При необходимости перезапустите Cursor')
  console.error('  4. Повторите: npm run dist\n')
}

tryCloseAppProcesses()
warnLegacyOutput()
cleanVersionOutput()
