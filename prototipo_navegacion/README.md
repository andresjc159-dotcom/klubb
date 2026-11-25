# Prototipo — Navegación eficiente en el catálogo de KLUBB

Simulación en Python de la capa de **navegación** del catálogo de productos de KLUBB
(menú de bares/discotecas). Modela la jerarquía de categorías y compara distintas
**estrategias de búsqueda/navegación** para evidenciar la mejora de rendimiento al
crecer el catálogo.

No requiere dependencias externas.

## Componentes

| Archivo | Rol | Patrón |
|---------|-----|--------|
| `catalogo.py` | `Producto`, `Categoria` (jerarquía) y `Catalogo` con índice + iterador | Composite, Iterator |
| `estrategias.py` | Estrategias intercambiables de búsqueda/navegación | Strategy |
| `demo.py` | Demostración guiada | — |
| `evaluacion.py` | Métricas de tiempo y comparaciones por tamaño y estrategia | — |

## Ejecutar

```bash
python3 demo.py          # demostración
python3 evaluacion.py    # métricas
```

## Resultados resumen (medidos)

Búsqueda del último producto (peor caso):

| Catálogo | Secuencial | Indexada | Jerárquica |
|----------|------------|----------|------------|
| 10 000 productos | 0.539 ms · 10 000 comparaciones | 0.00014 ms · 1 comparación | 0.066 ms · 1 000 comparaciones |

La estrategia **indexada** es ~3 800× más rápida que la secuencial, y la **jerárquica**
reduce el espacio de búsqueda 10× (una categoría de 10) frente a la secuencial.
