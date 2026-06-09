export type FilePreviewKind = 'text' | 'image' | 'pdf' | 'unsupported'

export type FilePreviewPayload =
  | {
      kind: 'text'
      fileName: string
      filePath: string
      text: string
    }
  | {
      kind: 'image'
      fileName: string
      filePath: string
      dataUrl: string
    }
  | {
      kind: 'pdf'
      fileName: string
      filePath: string
      dataBase64: string
    }
  | {
      kind: 'unsupported'
      fileName: string
      filePath: string
      reason?: string
    }

export const TEXT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024
export const IMAGE_PREVIEW_MAX_BYTES = 20 * 1024 * 1024
export const PDF_PREVIEW_MAX_BYTES = 25 * 1024 * 1024

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'log',
  'xml',
  'html',
  'htm',
  'yml',
  'yaml',
  'ini',
  'cfg',
  'env',
  'js',
  'ts',
  'tsx',
  'jsx',
  'css',
  'sql',
  'bat',
  'ps1',
  'sh',
  'toml',
  'properties',
  'rtf'
])

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'])

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

export function detectFilePreviewKind(fileName: string): FilePreviewKind {
  const ext = fileExtension(fileName)
  if (TEXT_EXTENSIONS.has(ext)) return 'text'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'unsupported'
}

export function imageMimeFromExtension(fileName: string): string {
  const ext = fileExtension(fileName)
  return IMAGE_MIME[ext] ?? 'application/octet-stream'
}

export function formatPreviewSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
