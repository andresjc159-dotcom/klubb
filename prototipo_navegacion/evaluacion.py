import random
import time

from catalogo import Categoria, Catalogo, Producto
from estrategias import BusquedaIndexada, BusquedaSecuencial, NavegacionJerarquica


def generar_catalogo(n):
    """Genera un catálogo con 5 categorías top, 2 subcategorías cada una y
    productos distribuidos de forma uniforme (estructura Composite)."""
    cat = Catalogo()
    nombres_top = ["Bebidas", "Comidas", "Cocteles", "Licores", "Sin alcohol"]
    sub_por_cat = ["A", "B"]
    por_sub = max(1, n // (len(nombres_top) * len(sub_por_cat)))

    idx = 0
    for top in nombres_top:
        c = Categoria(top)
        for s in sub_por_cat:
            sub = Categoria(f"{top}-{s}")
            for _ in range(por_sub):
                p = Producto(f"p{idx}", f"Producto {idx}", random.randint(5000, 50000), random.randint(0, 50))
                sub.agregar_producto(p)
                idx += 1
            c.agregar_subcategoria(sub)
        cat.agregar_categoria(c)
    return cat


def medir(estrategia, catalogo, objetivo, categoria=None, repeticiones=200):
    estrategia.buscar(catalogo, objetivo, categoria=categoria)  # warm-up
    t0 = time.perf_counter()
    for _ in range(repeticiones):
        estrategia.buscar(catalogo, objetivo, categoria=categoria)
    t1 = time.perf_counter()
    return (t1 - t0) / repeticiones * 1000, estrategia.comparaciones


def main():
    tamanos = [100, 1000, 5000, 10000]
    print(f"{'Catálogo':>9} | {'Estrategia':24} | {'Tiempo (ms)':>11} | {'Comparaciones':>13}")
    print("-" * 70)

    for n in tamanos:
        cat = generar_catalogo(n)
        objetivo = f"Producto {n - 1}"  # último producto: peor caso para la búsqueda secuencial
        categoria = cat.categoria_de(objetivo).nombre if cat.categoria_de(objetivo) else None

        sec = BusquedaSecuencial()
        t_sec, c_sec = medir(sec, cat, objetivo)

        idx = BusquedaIndexada()
        t_idx, c_idx = medir(idx, cat, objetivo)

        jer = NavegacionJerarquica()
        t_jer, c_jer = medir(jer, cat, objetivo, categoria=categoria)

        print(f"{n:>9} | {'Secuencial':24} | {t_sec:>10.4f} | {c_sec:>13}")
        print(f"{'':>9} | {'Indexada':24} | {t_idx:>10.5f} | {c_idx:>13}")
        print(f"{'':>9} | {'Jerárquica':24} | {t_jer:>10.4f} | {c_jer:>13}")
        print("-" * 70)


if __name__ == "__main__":
    main()
