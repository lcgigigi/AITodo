import { usePermissionStore } from '@/stores/permission.store'

export function usePermission() {
  const permissionStore = usePermissionStore()

  return {
    hasPermission: permissionStore.hasPermission,
  }
}
