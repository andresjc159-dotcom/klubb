"""Modelo del catálogo de Klubb con estructura jerárquica (patrón Composite)
y recorrido eficiente (patrón Iterator)."""


class Producto:
    def __init__(self, pid, nombre, precio, stock):
        self.pid = pid
        self.nombre = nombre
        self.precio = precio
        self.stock = stock

    def __repr__(self):
        return f"Producto({self.nombre}, ${self.precio})"


class Categoria:
    """Nodo Composite: una categoría puede contener subcategorías y productos."""

    def __init__(self, nombre):
        self.nombre = nombre
        self.subcategorias = []
        self.productos = []

    def agregar_subcategoria(self, cat):
        self.subcategorias.append(cat)
        return cat

    def agregar_producto(self, prod):
        self.productos.append(prod)
        return prod

    def contar_productos(self):
        total = len(self.productos)
        for sub in self.subcategorias:
            total += sub.contar_productos()
        return total

    def productos_recursivos(self):
        for p in self.productos:
            yield p
        for sub in self.subcategorias:
            yield from sub.productos_recursivos()


class Catalogo:
    """Agrega categorías, mantiene la lista plana y un índice por nombre."""

    def __init__(self):
        self.categorias = []
        self._productos = []
        self.indice = {}

    def agregar_categoria(self, cat):
        self.categorias.append(cat)
        for p in cat.productos_recursivos():
            self._registrar(p)
        return cat

    def _registrar(self, prod):
        self._productos.append(prod)
        self.indice[prod.nombre] = prod

    def todos(self):
        return self._productos

    def __iter__(self):
        return IteradorProductos(self._productos)

    def encontrar_nodo(self, nombre_categoria):
        """Devuelve el nodo (categoría o subcategoría) por su nombre."""
        def _buscar(cat):
            if cat.nombre == nombre_categoria:
                return cat
            for sub in cat.subcategorias:
                r = _buscar(sub)
                if r:
                    return r
            return None
        for cat in self.categorias:
            r = _buscar(cat)
            if r:
                return r
        return None

    def categoria_de(self, nombre_producto):
        """Devuelve la categoría (o subcategoría) que contiene al producto."""
        def _buscar(cat):
            if any(p.nombre == nombre_producto for p in cat.productos):
                return cat
            for sub in cat.subcategorias:
                r = _buscar(sub)
                if r:
                    return r
            return None
        for cat in self.categorias:
            r = _buscar(cat)
            if r:
                return r
        return None


class IteradorProductos:
    """Iterator sobre la lista plana de productos del catálogo."""

    def __init__(self, productos):
        self._items = list(productos)
        self._i = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._i >= len(self._items):
            raise StopIteration
        p = self._items[self._i]
        self._i += 1
        return p
