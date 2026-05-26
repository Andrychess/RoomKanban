import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import type { PasswordSecret } from '../../shared/types'

const scryptAsync = promisify(scrypt)

const KEY_LEN = 64

export async function hashPassword(password: string): Promise<PasswordSecret> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer
  return {
    salt,
    hash: derived.toString('hex')
  }
}

export async function verifyPassword(password: string, secret: PasswordSecret): Promise<boolean> {
  if (!password || !secret.salt || !secret.hash) return false
  try {
    const derived = (await scryptAsync(password, secret.salt, KEY_LEN)) as Buffer
    const expected = Buffer.from(secret.hash, 'hex')
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export function hasPasswordSecret(secret: PasswordSecret | undefined | null): boolean {
  return Boolean(secret?.salt && secret?.hash)
}
