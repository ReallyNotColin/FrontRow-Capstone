// auth/mfaResolverStore.ts
import type { MultiFactorResolver } from "firebase/auth";

let _resolver: MultiFactorResolver | null = null;

export function setPendingMfaResolver(r: MultiFactorResolver | null) {
  _resolver = r;
}
export function getPendingMfaResolver(): MultiFactorResolver | null {
  return _resolver;
}
export function clearPendingMfaResolver() {
  _resolver = null;
}
