/**
 * Управление версией в package.json перед сборкой.
 *
 * Локально (npm run dist): patch +1 (0.1.0 → 0.1.1).
 * CI / git tag (v0.2.0): версия берётся из тега без увеличения.
 *
 * Флаги:
 *   --from-tag   синхронизировать с GITHUB_REF_NAME или VERSION
 *   --no-bump    не менять версию (только вывести текущую)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgPath = path.join(__dirname, '..', 'package.json')

function readPkg() {
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
}

function writePkg(pkg) {
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

function parseSemver(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Некорректная версия в package.json: "${version}" (ожидается X.Y.Z)`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function bumpPatch(version) {
  const [major, minor, patch] = parseSemver(version)
  return `${major}.${minor}.${patch + 1}`
}

function versionFromTag() {
  const raw = process.env.GITHUB_REF_NAME || process.env.VERSION || ''
  const match = raw.match(/^v?(\d+\.\d+\.\d+)$/i)
  return match ? match[1] : null
}

const args = new Set(process.argv.slice(2))
const pkg = readPkg()
const tagVersion = versionFromTag()

if (args.has('--no-bump')) {
  console.log(`[version] ${pkg.version}`)
  process.exit(0)
}

if (args.has('--from-tag') || (process.env.GITHUB_ACTIONS === 'true' && tagVersion)) {
  if (!tagVersion) {
    console.error('[version] Тег не найден. Ожидается vX.Y.Z (GITHUB_REF_NAME или VERSION).')
    process.exit(1)
  }
  if (pkg.version !== tagVersion) {
    pkg.version = tagVersion
    writePkg(pkg)
    console.log(`[version] Синхронизировано с тегом: ${tagVersion}`)
  } else {
    console.log(`[version] Уже ${tagVersion}`)
  }
  process.exit(0)
}

const next = bumpPatch(pkg.version)
const previous = pkg.version
pkg.version = next
writePkg(pkg)
console.log(`[version] ${previous} → ${next} (patch +1)`)
console.log('[version] Не забудьте закоммитить package.json после сборки.')
