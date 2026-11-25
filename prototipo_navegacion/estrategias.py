"""Estrategias de navegación/búsqueda intercambiables (patrón Strategy)."""

from abc import ABC, abstractmethod


class EstrategiaBusqueda(ABC):
    def __init__(self):
        self.comparaciones = 0
        self.nombre = "base"

    @abstractmethod
    def buscar(self, catalogo, nombre, **kwargs):
        ...

    def reset(self):
        self.comparaciones = 0


class BusquedaSecuencial(EstrategiaBusqueda):
    """Recorre linealmente todos los productos (línea base, O(n))."""

    def __init__(self):
        super().__init__()
        self.nombre = "Secuencial (línea base)"

    def buscar(self, catalogo, nombre, **kwargs):
        self.comparaciones = 0
        for p in catalogo.todos():
            self.comparaciones += 1
            if p.nombre == nombre:
                return p
        return None


class BusquedaIndexada(EstrategiaBusqueda):
    """Consulta directa en un índice por nombre (hash, O(1))."""

    def __init__(self):
        super().__init__()
        self.nombre = "Indexada (hash)"

    def buscar(self, catalogo, nombre, **kwargs):
        self.comparaciones = 1
        return catalogo.indice.get(nombre)


class NavegacionJerarquica(EstrategiaBusqueda):
    """Navega la jerarquía de categorías (Composite): el usuario se ubica en una
    categoría y solo recorre los productos de esa categoría (reduce el espacio)."""

    def __init__(self):
        super().__init__()
        self.nombre = "Jerárquica (Composite)"

    def buscar(self, catalogo, nombre, categoria=None, **kwargs):
        self.comparaciones = 0
        if categoria is not None:
            nodo = catalogo.encontrar_nodo(categoria)
        else:
            nodo = catalogo.categoria_de(nombre)
        if nodo is None:
            return None
        for p in nodo.productos_recursivos():
            self.comparaciones += 1
            if p.nombre == nombre:
                return p
        return None


class FiltroPorCategoria(EstrategiaBusqueda):
    """Filtra los productos por categoría y disponibilidad de stock."""

    def __init__(self):
        super().__init__()
        self.nombre = "Filtrado"

    def buscar(self, catalogo, nombre=None, categoria=None, solo_disponible=True, **kwargs):
        self.comparaciones = 0
        resultados = []
        for p in catalogo.todos():
            self.comparaciones += 1
            if categoria and catalogo.categoria_de(p.nombre) is not None and \
               catalogo.categoria_de(p.nombre).nombre != categoria:
                continue
            if solo_disponible and p.stock <= 0:
                continue
            resultados.append(p)
        return resultados
