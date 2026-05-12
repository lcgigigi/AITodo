import { defineStore } from 'pinia'

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    permissions: ['home:view'] as string[],
    roles: ['user'] as string[],
  }),
  actions: {
    setPermissions(permissions: string[]) {
      this.permissions = permissions
    },
    hasPermission(permission?: string) {
      return !permission || this.permissions.includes(permission)
    },
  },
})
