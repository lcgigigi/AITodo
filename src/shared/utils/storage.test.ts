import { afterEach, describe, expect, it, vi } from 'vitest'
import { storage } from './storage'

describe('storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the fallback when localStorage cannot be read', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new DOMException('Access denied', 'SecurityError')
      }),
    })

    expect(storage.get('key', 'fallback')).toBe('fallback')
  })

  it('reports failed writes and removals without throwing', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('Access denied', 'SecurityError')
      }),
    })

    expect(storage.set('key', { value: true })).toBe(false)
    expect(storage.remove('key')).toBe(false)
  })
})
