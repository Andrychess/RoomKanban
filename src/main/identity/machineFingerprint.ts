import { createHash } from 'crypto'
import os from 'os'

/** Стабильный идентификатор устройства (не сессия, не случайный id). */
export function computeMachineFingerprint(): string {
  const raw = [
    os.hostname(),
    os.platform(),
    os.release(),
    os.arch(),
    os.cpus()[0]?.model ?? 'cpu',
    os.userInfo().username,
    os.homedir()
  ].join('|')
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 20)
  return `fp_${hash}`
}
