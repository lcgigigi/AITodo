import { defineStore } from 'pinia'

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    permissions: ['workbench:view', 'agenda:view', 'ai-agent:view'] as string[],
    roles: ['workspace-user'] as string[],
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
