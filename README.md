# Melamina IA CAD/CAM

Prototipo web para diseñar muebles de melamina en milímetros, ensamblar piezas en 3D, obtener el despiece y optimizar el corte 2D.

## Flujo principal

1. Crear o editar piezas en el espacio 3D.
2. Agrupar, posicionar, girar o aplicar estirado inteligente.
3. Revisar material, espesor, veta, cantos y autorización de giro.
4. Abrir el plano 2D para calcular tableros, merma y tapacantos.
5. Exportar el despiece o el PDF de taller.

## Almacén

El catálogo empieza vacío y se organiza en Estantes, Escritorios, Roperos, Cómodas, Cocina alta y Cocina baja. Los muebles guardados permanecen localmente en el navegador y pueden exportarse o importarse como JSON.

## Desarrollo

```bash
npm ci
npm run lint
npm test
npm run build
```

La aplicación funciona sin servicios externos. El reconocimiento opcional por imagen permanece desactivado hasta disponer de un backend seguro; nunca se deben compilar claves privadas dentro del navegador.
