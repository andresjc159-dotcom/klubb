from catalogo import Categoria, Catalogo, Producto
from estrategias import (
    BusquedaIndexada,
    BusquedaSecuencial,
    FiltroPorCategoria,
    NavegacionJerarquica,
)


def construir_catalogo():
    cat = Catalogo()
    bebidas = Categoria("Bebidas")
    cocteles = bebidas.agregar_subcategoria(Categoria("Cocteles"))
    cervezas = bebidas.agregar_subcategoria(Categoria("Cervezas"))
    comidas = Categoria("Comidas")

    cocteles.agregar_producto(Producto("p1", "Mojito", 22000, 15))
    cocteles.agregar_producto(Producto("p2", "Piña Colada", 24000, 12))
    cervezas.agregar_producto(Producto("p3", "Club Colombia", 8000, 48))
    cervezas.agregar_producto(Producto("p4", "Corona", 9000, 0))
    comidas.agregar_producto(Producto("p5", "Nachos", 18000, 20))

    cat.agregar_categoria(bebidas)
    cat.agregar_categoria(comidas)
    return cat


def main():
    cat = construir_catalogo()
    print(f"Catálogo: {len(cat.todos())} productos en {len(cat.categorias)} categorías")
    print()

    sec = BusquedaSecuencial()
    idx = BusquedaIndexada()
    jer = NavegacionJerarquica()
    fil = FiltroPorCategoria()

    objetivo = "Nachos"

    r1 = sec.buscar(cat, objetivo)
    print(f"1. Secuencial  -> {r1}  (comparaciones: {sec.comparaciones})")

    r2 = idx.buscar(cat, objetivo)
    print(f"2. Indexada    -> {r2}  (comparaciones: {idx.comparaciones})")

    r3 = jer.buscar(cat, objetivo, categoria="Comidas")
    print(f"3. Jerárquica  -> {r3}  (comparaciones dentro de la categoría: {jer.comparaciones})")

    disponibles = fil.buscar(cat, solo_disponible=True)
    print(f"4. Filtrado    -> {len(disponibles)} productos con stock disponible "
          f"(comparaciones: {fil.comparaciones})")

    print()
    print("Recorrido del catálogo con Iterator:")
    for i, p in enumerate(cat, start=1):
        print(f"   {i}. {p.nombre} — ${p.precio}")


if __name__ == "__main__":
    main()
