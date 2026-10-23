import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { verify } from 'jsonwebtoken';

let redisAdapter: any = null;
if (process.env.REDIS_URL) {
  const pubClient = new Redis(process.env.REDIS_URL);
  const subClient = pubClient.duplicate();
  redisAdapter = createAdapter(pubClient, subClient);
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
  ...(redisAdapter ? { adapter: redisAdapter } : {}),
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');

  constructor(private config: ConfigService) {}

  private verificar(token?: string): any | null {
    if (!token) return null;
    const clientSecret =
      this.config.get<string>('CLIENT_JWT_SECRET') || 'klubb-cliente-dev-secret';
    const staffSecret =
      this.config.get<string>('JWT_SECRET') || 'klubb-dev-secret';
    try {
      return verify(token, clientSecret);
    } catch {}
    try {
      return verify(token, staffSecret);
    } catch {}
    return null;
  }

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    const payload = this.verificar(token);
    if (!payload) {
      client.emit('error', 'No autorizado');
      client.disconnect();
      return;
    }
    client.data.auth = payload;
    this.logger.log(`Conectado: ${client.id} (${payload.tipo || payload.role})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Desconectado: ${client.id}`);
  }

  @SubscribeMessage('join-tenant')
  handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    const auth = client.data.auth;
    if (!auth || !auth.role || auth.tenantId !== data.tenantId) {
      return { ok: false };
    }
    client.join(`tenant:${data.tenantId}`);
    return { ok: true, room: `tenant:${data.tenantId}` };
  }

  @SubscribeMessage('join-mesa')
  handleJoinMesa(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mesaId: string },
  ) {
    const auth = client.data.auth;
    if (!auth) return { ok: false };
    if (auth.tipo === 'miembro' && auth.mesaId === data.mesaId) {
      client.join(`mesa:${data.mesaId}`);
      return { ok: true, room: `mesa:${data.mesaId}` };
    }
    return { ok: false };
  }

  @SubscribeMessage('join-user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const auth = client.data.auth;
    if (!auth || !auth.role) return { ok: false };
    if (auth.sub !== data.userId) return { ok: false };
    client.join(`user:${data.userId}`);
    return { ok: true, room: `user:${data.userId}` };
  }

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  emitToMesa(mesaId: string, event: string, payload: unknown) {
    this.server.to(`mesa:${mesaId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
