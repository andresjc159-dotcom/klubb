import statistics
import threading
import time

from balanceador import Balanceador
from bus import Bus
from cliente import Cliente
from nodo import Nodo


def wait_until(pred, timeout=10.0, step=0.02):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pred():
            return True
        time.sleep(step)
    return False


class Suite:
    def __init__(self):
        self.bus = None
        self.nodos = []
        self.bal = None
        self.threads = []

    def levantar(self, n_nodos):
        self.bus = Bus(port=16379)
        self.nodos = [Nodo(f"nodo-{i}", bus_port=16379, port=13000 + i) for i in range(1, n_nodos + 1)]
        self.bal = Balanceador(port=18080, nodes=[(n.host, n.port) for n in self.nodos])
        self.threads = [threading.Thread(target=self.bus.start, daemon=True)]
        self.threads[0].start()
        time.sleep(0.2)
        for n in self.nodos:
            n.start()
        self.threads.append(threading.Thread(target=self.bal.start, daemon=True))
        self.threads[-1].start()
        time.sleep(0.4)

    def tumbar(self):
        for n in self.nodos:
            n.stop()
        if self.bal:
            self.bal.stop()
        if self.bus:
            self.bus.stop()
        time.sleep(0.2)


def escenario_correctitud_latencia(n_nodos=3, n_subs=6, m=300):
    s = Suite()
    s.levantar(n_nodos)
    ch = "tenant:la-noche"
    subs = [Cliente(f"sub-{i}") for i in range(n_subs)]
    for c in subs:
        c.join(ch)
    time.sleep(0.4)
    pub = Cliente("pub")
    for i in range(m):
        pub.publish(ch, "pedido:nuevo", {"seq": i, "ts": time.time()})
        time.sleep(0.0004)
    ok = wait_until(lambda: all(c.count() >= m for c in subs), timeout=15)
    time.sleep(0.3)

    latencias = []
    for msg, recv in subs[0].received:
        d = msg.get("d") or {}
        if "ts" in d:
            latencias.append((recv - d["ts"]) * 1000)

    entregas = [c.count() for c in subs]
    total_entregas = sum(entregas)
    duracion = (subs[0].received[-1][1] - subs[0].received[0][1]) if subs[0].received else 0

    for c in [pub] + subs:
        c.close()
    s.tumbar()

    latencias.sort()
    res = {
        "escenario": "correctitud + latencia",
        "nodos": n_nodos,
        "suscriptores": n_subs,
        "eventos": m,
        "correcto": ok and all(x == m for x in entregas),
        "entregas_por_sub": entregas,
        "total_entregas": total_entregas,
        "latencia_ms_media": statistics.mean(latencias) if latencias else None,
        "latencia_ms_p50": latencias[len(latencias) // 2] if latencias else None,
        "latencia_ms_p95": latencias[int(len(latencias) * 0.95)] if latencias else None,
        "latencia_ms_max": latencias[-1] if latencias else None,
    }
    return res


def escenario_throughput(n_nodos=3, n_subs=6, m=2000):
    s = Suite()
    s.levantar(n_nodos)
    ch = "tenant:la-noche"
    subs = [Cliente(f"sub-{i}") for i in range(n_subs)]
    for c in subs:
        c.join(ch)
    time.sleep(0.4)
    pub = Cliente("pub")
    t0 = time.time()
    for i in range(m):
        pub.publish(ch, "pedido:nuevo", {"seq": i})
    t_pub = time.time() - t0
    ok = wait_until(lambda: all(c.count() >= m for c in subs), timeout=30)
    t_total = time.time() - t0
    time.sleep(0.3)

    total_entregas = sum(c.count() for c in subs)
    throughput_entrega = total_entregas / t_total if t_total else 0
    throughput_publicacion = m / t_pub if t_pub else 0

    for c in [pub] + subs:
        c.close()
    s.tumbar()

    return {
        "escenario": "throughput",
        "nodos": n_nodos,
        "suscriptores": n_subs,
        "eventos": m,
        "correcto": ok and all(c.count() >= m for c in subs),
        "t_publicacion_s": round(t_pub, 3),
        "t_total_s": round(t_total, 3),
        "total_entregas": total_entregas,
        "throughput_publicacion_ev_s": round(throughput_publicacion, 1),
        "throughput_entrega_ev_s": round(throughput_entrega, 1),
    }


def escenario_escalabilidad():
    filas = []
    for n_nodos in (1, 2, 4):
        r = escenario_throughput(n_nodos=n_nodos, n_subs=6, m=1500)
        filas.append((n_nodos, r["throughput_entrega_ev_s"], r["throughput_publicacion_ev_s"], r["correcto"]))
    return filas


def escenario_robustez(n_eventos=400):
    s = Suite()
    s.levantar(3)
    ch = "tenant:la-noche"
    sub1 = Cliente("sub-nodo1", port=13001)
    sub2 = Cliente("sub-nodo2", port=13002)
    sub3 = Cliente("sub-nodo3", port=13003)
    for c in (sub1, sub2, sub3):
        c.join(ch)
    time.sleep(0.4)

    pub = Cliente("pub", port=13001)
    stop = threading.Event()

    def publicar():
        i = 0
        while not stop.is_set():
            pub.publish(ch, "pedido:nuevo", {"seq": i, "ts": time.time()})
            i += 1
            time.sleep(0.005)

    t = threading.Thread(target=publicar, daemon=True)
    t.start()
    time.sleep(1.5)

    s.nodos[1].stop()
    time.sleep(1.5)
    stop.set()

    time.sleep(0.3)
    c1, c2, c3 = sub1.count(), sub2.count(), sub3.count()
    pub.close()
    for c in (sub1, sub2, sub3):
        c.close()
    s.tumbar()

    return {
        "escenario": "robustez (caida de nodo-2)",
        "recibidos_nodo1": c1,
        "recibidos_nodo2": c2,
        "recibidos_nodo3": c3,
        "sistema_sigue_funcionando": c1 > 0 and c3 > 0,
    }


def imprimir(d):
    print("=" * 60)
    for k, v in d.items():
        print(f"  {k:28s}: {v}")
    print("=" * 60)


def main():
    import sys

    seleccion = sys.argv[1] if len(sys.argv) > 1 else "all"

    def esc1():
        print("\n### Escenario 1: correctitud y latencia")
        imprimir(escenario_correctitud_latencia())

    def esc2():
        print("\n### Escenario 2: throughput")
        imprimir(escenario_throughput())

    def esc3():
        print("\n### Escenario 3: escalabilidad (varia numero de nodos)")
        for n_nodos, th_ent, th_pub, ok in escenario_escalabilidad():
            print(f"  nodos={n_nodos}  entrega={th_ent} ev/s  publicacion={th_pub} ev/s  correcto={ok}")

    def esc4():
        print("\n### Escenario 4: robustez")
        imprimir(escenario_robustez())

    escenarios = {"1": esc1, "2": esc2, "3": esc3, "4": esc4, "all": None}

    if seleccion == "all":
        esc1()
        esc2()
        esc3()
        esc4()
    elif seleccion in escenarios:
        escenarios[seleccion]()
    else:
        print("Uso: python3 evaluacion.py [1|2|3|4|all]")


if __name__ == "__main__":
    main()
