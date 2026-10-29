# KLUBB 🪩 
**Plataforma SaaS Multi-tenant para la Gestión Operativa de Bares y Discotecas**

KLUBB es una solución integral diseñada para modernizar y centralizar la operación de establecimientos de entretenimiento nocturno. Desarrollada bajo una arquitectura de **Monolito Modular** y lista para la nube (*Cloud-Native*), la plataforma permite gestionar pedidos en tiempo real, inventarios, facturación y la interacción directa con los clientes mediante una PWA (Progressive Web App).

---

## 🚀 Características Principales

- **Arquitectura Multi-tenant:** Aislamiento lógico de datos por local (`tenantId`), permitiendo alojar múltiples bares en una misma infraestructura de manera segura y eficiente.
- **Interacción en Tiempo Real:** Sincronización instantánea de estados de pedidos entre clientes, meseros, barra y cocina utilizando WebSockets y Redis (Pub/Sub).
- **Autogestión del Cliente (PWA):** Menú digital accesible mediante escaneo de código QR en la mesa. Permite realizar pedidos, pagar la cuenta y solicitar/votar canciones para el DJ, sin instalar aplicaciones adicionales.
- **Panel Operativo (Staff):** Interfaz dedicada con Control de Acceso Basado en Roles (RBAC) para la administración del local, apertura/cierre de caja, gestión de inventario y configuración de recetas.
- **Despliegue Contenerizado:** Infraestructura completamente orquestada con Docker y Nginx (API Gateway), desplegada en AWS EC2 con resolución DNS.

---

## 🛠️ Stack Tecnológico

**Backend & Lógica de Negocio:**
- NestJS 12 (TypeScript)
- Prisma ORM 6
- PostgreSQL 16
- Autenticación JWT y guards (RBAC)

**Tiempo Real & Caché:**
- Socket.IO
- Redis 7 (Adapter Pub/Sub)

**Frontend:**
- React + Vite (TypeScript)
- Diseño *Mobile-First* (Cliente) y *Responsive* (Staff)

**Infraestructura & DevOps:**
- Docker & Docker Compose
- Nginx (Reverse Proxy / API Gateway)
- AWS EC2
- DuckDNS (Resolución DNS)

---

## 🏗️ Arquitectura del Sistema

El proyecto sigue un estilo de **Monolito Modular**, dividiendo el código en contextos acotados pero manteniendo un despliegue unificado. 

La topología de infraestructura cuenta con un API Gateway (Nginx) que enruta el tráfico hacia archivos estáticos (Frontend) o balancea la carga hacia las réplicas del servicio API (Backend). La asincronía y escalabilidad del tiempo real se manejan a través de un bus de eventos con Redis, asegurando que todos los dispositivos conectados reciban las actualizaciones al instante.

---

## ⚙️ Estructura del Proyecto (Monorepo)

```text
klubb/
├── apps/
│   ├── api/                 # Backend NestJS (Lógica de negocio, Prisma y Sockets)
│   ├── web-staff/           # Frontend React (Panel administrativo/operativo)
│   └── cliente-pwa/         # Frontend React (App móvil PWA escaneo QR)
├── web/                     # Configuración Nginx y recursos de despliegue estático
├── docker-compose.yml       # Orquestador de servicios (API, Web, DB, Redis)
└── Dockerfile               # Imagen del contenedor de la API
