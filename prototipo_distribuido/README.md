# Prototipo — Capa distribuida de KLUBB (simulación)

Simulación en **Python (sockets + threading)** de la capa de tiempo real distribuida de
KLUBB: un broker pub/sub central (que representa el adaptador **Redis** de Socket.IO),
varias **réplicas del API** (nodos NestJS), un **balanceador** (que representa Nginx) y
clientes (staff / PWA).

No requiere dependencias externas (solo la librería estándar).

## Componentes

| Archivo | Rol | Patrón que evidencia |
|---------|-----|----------------------|
| `common.py` | Codificación de mensajes JSON por línea | — |
| `bus.py` | Broker pub/sub central (simula Redis) | Observer distribuido / Mediator |
| `nodo.py` | Réplica del API con un hilo por conexión | Observer, Proxy (frente al cliente) |
| `balanceador.py` | Proxy round-robin (simula Nginx) | Proxy / Load balancer |
| `cliente.py` | Cliente staff o PWA | — |
| `demo.py` | Simulación guiada con logs | — |
| `evaluacion.py` | Pruebas de correctitud, latencia, throughput, escalabilidad y robustez | — |

## Ejecutar

```bash
# Demo guiada (muestra entrega entre nodos)
python3 demo.py

# Suite de evaluación (métricas)
python3 evaluacion.py
```

## Protocolo (mensajes JSON delimitados por salto de línea)

- Cliente → Nodo: `{"t":"join","ch":"tenant:la-noche"}` o
  `{"t":"publish","ch":"...","ev":"pedido:nuevo","d":{...}}`.
- Nodo → Bus: `{"t":"subscribe","ch":...}` o `{"t":"publish",...,"nid":"nodo-1"}`.
- Bus → Nodo: `{"t":"publish",...,"origin":"nodo-1"}` (excluye al nodo origen).
- Nodo → Cliente: `{"t":"event",...,"node":"nodo-2"}`.

## Resultados resumen (medidos en este entorno)

- Correctitud: 6 suscriptores en 3 nodos reciben los 300 eventos exactamente una vez.
- Latencia de extremo a extremo: media ≈ 0.19 ms, p95 ≈ 0.36 ms.
- Throughput: ≈ 16.6 k ev/s (publicación) y ≈ 35.4 k ev/s (entrega total).
- Escalabilidad: al pasar de 1 a 4 nodos el throughput de publicación por nodo **decrece**
  (27.6 k → 15.2 k ev/s) por el fan-out del broker central (cuello de botella).
- Robustez: al caer `nodo-2`, sus clientes pierden servicio (~la mitad de eventos) mientras
  el resto del sistema sigue operando con normalidad.
