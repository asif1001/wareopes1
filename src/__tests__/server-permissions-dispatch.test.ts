import { describe, it, expect } from 'vitest'
import { hasPermission } from '@/lib/server-permissions'
import type { UserPermissions } from '@/lib/types'

describe('server-permissions dispatches checks', () => {
  it('returns true when dispatches view permission is present', () => {
    const permissions: UserPermissions = {
      dispatches: ['view'],
    }
    expect(hasPermission(permissions, 'dispatches', 'view')).toBe(true)
  })

  it('returns false when dispatches permissions are missing', () => {
    const permissions: UserPermissions = {
      shipments: ['view'],
    }
    expect(hasPermission(permissions, 'dispatches', 'view')).toBe(false)
  })

  it('returns false when permissions object is undefined', () => {
    expect(hasPermission(undefined as unknown as UserPermissions, 'dispatches', 'view')).toBe(false)
  })
})
