import fs from 'fs/promises'
import path from 'path'

export async function readJsonFile<T>(
  filePath: string,
  fallback: T
): Promise<{ data: T; ok: boolean }> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return { data: JSON.parse(raw) as T, ok: true }
  } catch {
    return { data: fallback, ok: false }
  }
}

/** Запись через временный файл — меньше шансов прочитать обрезанный JSON при sync. */
export async function writeJsonFileAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`)
  const body = JSON.stringify(data, null, 2)
  await fs.writeFile(tmp, body, 'utf-8')
  try {
    await fs.rename(tmp, filePath)
  } catch {
    await fs.unlink(filePath).catch(() => {})
    await fs.rename(tmp, filePath)
  }
}
