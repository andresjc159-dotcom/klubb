import threading
import time

from balanceador import Balanceador
from bus import Bus
from cliente import Cliente
from nodo import Nodo


def log(msg):
    print(f"[demo] {msg}", flush=True)


def main():
    bus = Bus(port=16379)
    nodos = [Nodo(f"nodo-{i}", bus_port=16379, port=13000 + i) for i in range(1, 4)]
    bal = Balanceador(port=18080, nodes=[(n.host, n.port) for n in nodos])

    threading.Thread(target=bus.start, daemon=True).start()
    time.sleep(0.2)
    for n in nodos:
        n.start()
    threading.Thread(target=bal.start, daemon=True).start()
    time.sleep(0.3)

    CH = "tenant:la-noche"

    subs = [Cliente(f"cliente-{i}") for i in range(1, 4)]
    for s in subs:
        s.join(CH)
    time.sleep(0.3)

    pub = Cliente("staff-mesero")
    pub.join(CH)
    time.sleep(0.2)

    log("publicando eventos de negocio...")
    eventos = [
        ("pedido:nuevo", {"codigo": "#B-104", "mesa": "Mesa 3"}),
        ("pedido:estado", {"codigo": "#B-104", "estado": "EN_PREPARACION"}),
        ("cancion:nueva", {"tema": "Ojos Color Sol"}),
    ]
    for ev, data in eventos:
        pub.publish(CH, ev, data)
        time.sleep(0.3)

    time.sleep(1.0)

    log("entregas por suscriptor (debe ser 3 cada uno):")
    for s in subs:
        log(f"  {s.nombre}: {s.count()} eventos -> {[m[0]['ev'] for m in s.received]}")

    log("estadisticas:")
    log(f"  bus: {bus.stats()}")
    for n in nodos:
        log(f"  {n.stats()}")

    for c in [pub] + subs:
        c.close()
    for n in nodos:
        n.stop()
    bal.stop()
    bus.stop()


if __name__ == "__main__":
    main()
