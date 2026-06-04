import { app } from 'electron'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { DocumentationBundle } from '../../shared/documentation'
import { parseDocumentationMarkdown } from '../../shared/helpMarkdown'

type DocFile = 'user' | 'technical'

const FILE_NAMES: Record<DocFile, string> = {
  user: 'USER_GUIDE.md',
  technical: 'TECHNICAL.md'
}

let cached: DocumentationBundle | null = null

function resolveDocPath(kind: DocFile): string {
  const fileName = FILE_NAMES[kind]

  if (app.isPackaged) {
    return join(process.resourcesPath, 'docs', fileName)
  }

  const candidates = [
    join(process.cwd(), 'docs', fileName),
    join(__dirname, '../../../docs', fileName),
    join(__dirname, '../../../../docs', fileName)
  ]

  for (const path of candidates) {
    if (existsSync(path)) return path
  }

  throw new Error(`${fileName} не найден. Проверьте: ${candidates.join('; ')}`)
}

export async function loadDocumentation(): Promise<DocumentationBundle> {
  if (cached) return cached

  const [userRaw, technicalRaw] = await Promise.all([
    readFile(resolveDocPath('user'), 'utf-8'),
    readFile(resolveDocPath('technical'), 'utf-8')
  ])

  cached = {
    user: parseDocumentationMarkdown(userRaw),
    technical: parseDocumentationMarkdown(technicalRaw)
  }
  return cached
}

export function clearDocumentationCache(): void {
  cached = null
}
