import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

const MUTACIONES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const OMITIR = ['/api/auth', '/api/public', '/api/auditoria'];
const MASK = ['password', 'passwordHash', 'token', 'clave'];

function sanitizar(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitizar(v));
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = MASK.includes(k) ? '***' : sanitizar(v);
  }
  return out;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method?.toUpperCase();
    if (!MUTACIONES.has(method)) return next.handle();

    const path = req.originalUrl?.split('?')[0] || req.path || '';
    if (OMITIR.some((p) => path.startsWith(p))) return next.handle();

    const user = req.user;
    const entidad = path.split('/').filter(Boolean)[0] || 'otros';

    return next.handle().pipe(
      tap(() => {
        this.prisma.auditLog
          .create({
            data: {
              tenantId: user?.tenantActivoId ?? user?.tenantId ?? null,
              userId: user?.userId ?? user?.sub ?? null,
              userName: user?.nombre ?? null,
              accion: method,
              entidad,
              detalle: sanitizar(req.body),
            },
          })
          .catch(() => {});
      }),
    );
  }
}
