import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import {
  detectFilePreviewKind,
  formatPreviewSize,
  imageMimeFromExtension,
  IMAGE_PREVIEW_MAX_BYTES,
  PDF_PREVIEW_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  type FilePreviewPayload
} from '../../shared/filePreview'

export async function loadFilePreviewPayload(
  absPath: string,
  fileName?: string
): Promise<FilePreviewPayload> {
  const name = fileName ?? basename(absPath)
  const kind = detectFilePreviewKind(name)
  const base = { fileName: name, filePath: absPath }

  if (kind === 'unsupported') {
    return { kind: 'unsupported', ...base }
  }

  const st = await stat(absPath)
  if (!st.isFile()) throw new Error('Не файл')

  switch (kind) {
    case 'text': {
      if (st.size > TEXT_PREVIEW_MAX_BYTES) {
        return {
          kind: 'unsupported',
          ...base,
          reason: `Файл слишком большой для просмотра (${formatPreviewSize(st.size)}).`
        }
      }
      const buf = await readFile(absPath)
      if (buf.includes(0)) {
        return {
          kind: 'unsupported',
          ...base,
          reason: 'Двоичный файл не поддерживается для текстового просмотра.'
        }
      }
      return { kind: 'text', ...base, text: buf.toString('utf8') }
    }
    case 'image': {
      if (st.size > IMAGE_PREVIEW_MAX_BYTES) {
        return {
          kind: 'unsupported',
          ...base,
          reason: `Изображение слишком большое (${formatPreviewSize(st.size)}).`
        }
      }
      const buf = await readFile(absPath)
      const mime = imageMimeFromExtension(name)
      return {
        kind: 'image',
        ...base,
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`
      }
    }
    case 'pdf': {
      if (st.size > PDF_PREVIEW_MAX_BYTES) {
        return {
          kind: 'unsupported',
          ...base,
          reason: `PDF слишком большой (${formatPreviewSize(st.size)}).`
        }
      }
      const buf = await readFile(absPath)
      return { kind: 'pdf', ...base, dataBase64: buf.toString('base64') }
    }
  }
}
