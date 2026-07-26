import { useAuth } from "./useAuth";

export function useCan(permission: string) {
  return useAuth().canUsePermission(permission);
}
