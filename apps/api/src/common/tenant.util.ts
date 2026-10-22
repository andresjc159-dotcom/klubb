export function tenantEfectivo(user: any): string | undefined {
  if (!user) return undefined;
  return user.tenantActivoId ?? user.tenantId ?? undefined;
}
