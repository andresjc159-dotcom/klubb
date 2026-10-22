export const METODOS_PAGO_DEFAULT = [
  'EFECTIVO',
  'TARJETA',
  'NEQUI',
  'PSE',
  'WOMPI',
];

export function metodosDe(tenant: any): string[] {
  const m = tenant?.metodosPago;
  if (Array.isArray(m)) return m as string[];
  return METODOS_PAGO_DEFAULT;
}
