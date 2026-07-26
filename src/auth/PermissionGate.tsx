import { ReactNode } from "react";

import { useCan } from "./useCan";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback = null
}: PermissionGateProps) {
  return useCan(permission) ? children : fallback;
}
