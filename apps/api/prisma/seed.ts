import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'la-noche' },
    update: { abierto: true },
    create: {
      nombre: 'La Noche Bar',
      slug: 'la-noche',
      mensajeBienvenida: '¡Bienvenido! Pide tus tragos sin filas',
      direccion: 'Medellín',
      abierto: true,
    },
  });

  const passwordHash = await bcrypt.hash('klubb123', 10);

  const users: Array<{
    nombre: string;
    email: string;
    role: Role;
    tenantId: string | null;
  }> = [
    { nombre: 'Master', email: 'master@klubb.app', role: Role.MASTER, tenantId: null },
    { nombre: 'Admin', email: 'admin@klubb.app', role: Role.ADMIN, tenantId: tenant.id },
    { nombre: 'Laura', email: 'laura@klubb.app', role: Role.MESERO, tenantId: tenant.id },
    { nombre: 'Juan', email: 'juan@klubb.app', role: Role.BARMAN, tenantId: tenant.id },
    { nombre: 'DJ Pipe', email: 'dj@klubb.app', role: Role.DJ, tenantId: tenant.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  const zonas = ['Barra Principal', 'VIP', 'Terraza', 'Pista', 'Palcos'];
  for (const nombre of zonas) {
    await prisma.zona.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre } },
      update: {},
      create: { tenantId: tenant.id, nombre },
    });
  }

  const zonaBarra = await prisma.zona.findUnique({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: 'Barra Principal' } },
  });

  if (zonaBarra) {
    for (let i = 1; i <= 8; i++) {
      await prisma.mesa.upsert({
        where: { qrToken: `la-noche-m${i}` },
        update: {},
        create: {
          tenantId: tenant.id,
          zonaId: zonaBarra.id,
          nombre: `Mesa ${i}`,
          qrToken: `la-noche-m${i}`,
        },
      });
    }
  }

  const categorias = [
    { nombre: 'Cocteles', icono: '🍹' },
    { nombre: 'Cervezas', icono: '🍺' },
    { nombre: 'Licores', icono: '🥃' },
    { nombre: 'Comidas', icono: '🍕' },
    { nombre: 'Sin alcohol', icono: '🥤' },
  ];

  const productos: Array<{
    cat: string;
    nombre: string;
    precio: number;
    costo: number;
    stock: number;
    emoji: string;
  }> = [
    { cat: 'Cocteles', nombre: 'Mojito', precio: 22000, costo: 6000, stock: 30, emoji: '🍹' },
    { cat: 'Cocteles', nombre: 'Piña Colada', precio: 24000, costo: 7000, stock: 12, emoji: '🍍' },
    { cat: 'Cervezas', nombre: 'Corona', precio: 9000, costo: 4000, stock: 0, emoji: '🍺' },
    { cat: 'Cervezas', nombre: 'Club Colombia', precio: 8000, costo: 3500, stock: 48, emoji: '🍺' },
    { cat: 'Licores', nombre: 'Ron Medellín x copa', precio: 12000, costo: 4000, stock: 20, emoji: '🥃' },
    { cat: 'Licores', nombre: 'Botella Ron Viejo 750ml', precio: 180000, costo: 90000, stock: 8, emoji: '🍾' },
    { cat: 'Comidas', nombre: 'Nachos', precio: 18000, costo: 6000, stock: 15, emoji: '🧀' },
    { cat: 'Sin alcohol', nombre: 'Soda', precio: 5000, costo: 1500, stock: 30, emoji: '🥤' },
  ];

  for (const c of categorias) {
    await prisma.categoria.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: c.nombre } },
      update: { icono: c.icono },
      create: { tenantId: tenant.id, nombre: c.nombre, icono: c.icono },
    });
  }

  for (const p of productos) {
    const cat = await prisma.categoria.findUnique({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: p.cat } },
    });
    if (!cat) continue;
    await prisma.producto.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: p.nombre } },
      update: {},
      create: {
        tenantId: tenant.id,
        categoriaId: cat.id,
        nombre: p.nombre,
        precio: p.precio,
        costo: p.costo,
        stock: p.stock,
        stockMinimo: 5,
        emoji: p.emoji,
      },
    });
  }

  console.log('Seed completado.');
  console.log('Usuarios:');
  for (const u of users) {
    console.log(`  ${u.email} / klubb123  (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
