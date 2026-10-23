import { ForbiddenException } from '@nestjs/common';

export function tenantEfectivo(user: any): string | undefined {
  if (!user) return undefined;
  return user.tenantActivoId ?? user.tenantId ?? undefined;
}

export async function exigirPlanPro(prisma: any, tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (t && t.plan === 'BASICA') {
    throw new ForbiddenException('Esta función requiere el plan Pro');
  }
}
