# Modalidad de Armado Inteligente con Cotas 3D, Herramientas y Checklist

Módulo interactivo de guía técnica de armado para muebles de melamina que proporciona un visor 3D paso a paso con acotaciones dinámicas, despiece animado, cálculo automatizado de herramientas y herrajes necesarios, checklist de montaje y exportación/impresión de manual técnico.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas en la fase de clarificación:**
> - **Visualización:** Vista 3D interactiva paso a paso con ensamble y cotas dinámicas, incluyendo control de explosión (despiece animado) y distancias de montaje.
> - **Herramientas y Materiales:** Lista de herramientas de taller y montaje, cálculo estimado de tornillería/herrajes y un checklist interactivo para marcar piezas ensambladas.
> - **Ubicación del Acceso:** Modal flotante accesible desde la barra superior de herramientas (botón "Armado" con icono de herramienta) y desde el menú de opciones de exportación, con opción de exportar/imprimir la guía técnica.

---

### 1. Overview & Core Concept

- **Qué hace:** Permite al fabricante, carpintero o cliente final visualizar cómo se construye el mueble paso a paso en un entorno 3D. Calcula automáticamente la secuencia lógica de montaje (de estructura base a divisiones y accesorios), proyecta cotas milimétricas clave entre paneles, genera la lista de herramientas de taller indispensables (atornillador, brocas, prensas, nivel) y la cuantificación de herrajes (tornillos soberbios, soportes, etc.), permitiendo tachar piezas en un checklist en tiempo real e imprimir el manual de armado.
- **Público objetivo:** Diseñadores de muebles, carpinteros en taller y armadores en obra que necesitan instrucciones claras de montaje sin errores de ensamblado.
- **Valor clave:** Reduce fallos de armado, evita perforaciones en lados equivocados y entrega un manual profesional de montaje listo para taller o cliente.

---

### 2. User Experience & Visual Design

- **Flujos de usuario:**
  1. El usuario hace clic en el botón **«Armado»** en la barra superior o en el menú de exportación.
  2. Se abre una ventana modal de pantalla completa/centrada con diseño de taller profesional oscuro (`#1f1f1f`), dividida en dos áreas principales:
     - **Área Izquierda (Visor 3D de Ensamblado):**
       - Controles orbitales 3D (rotar, zoom, paneo).
       - Botones de paso: `Anterior`, `Siguiente`, control deslizante de pasos (ej. Paso 1/5) y botón `Reproducir / Auto`.
       - Control deslizante de **Explosión 3D** (0% ensamble cerrado a 100% despiece abierto).
       - Alternador de **Cotas Dinámicas**: Líneas de cota con medidas en mm sobre las piezas activas (alturas de repisas, distancias libres, ancho y alto total).
       - Resaltado visual en verde esmeralda / ámbar de las piezas que entran en el paso actual.
     - **Área Derecha (Panel de Control y Guía Técnica):**
       - **Pestaña 1 - Pasos & Checklist:** Explicación del paso actual, lista de piezas a montar con sus dimensiones y cantos, y casillas de verificación interactiva con barra de progreso porcentual.
       - **Pestaña 2 - Herramientas & Herrajes:** Tarjetas limpias de herramientas necesarias (taladro, broca guía, escuadra, cinta métrica, destornillador) y tabla calculada de tornillos soberbios, tarugos y accesorios.
       - **Pestaña 3 - Resumen Técnico:** Dimensiones totales exteriores, volumen y peso estimado.
  3. **Impresión / PDF:** Botón «Imprimir Guía de Armado» que formatea un documento imprimible limpio con todas las etapas, cotas, lista de corte y checklist de verificación.

- **Diseño visual:**
  - **Paleta de colores:** Fondo neutro carbón (`#1a1a1a`), superficies elevadas (`#242424`), acentos de acción en ámbar cálido (`#d97706`) y esmeralda (`#10b981`), tipografía blanca y gris plata con cifras tabulares (`tabular-nums font-mono`).
  - **Jerarquía y legibilidad:** Títulos limpios sin adornos mecánicos, tarjetas sobrias con bordes sutiles de 1px (`border-[#333]`), badges funcionales sin estilo píldora excesivo.

---

### 3. Key Product Decisions & Trade-Offs

- **Secuenciación lógica automática de piezas:**
  - *Enfoque elegido:* Algoritmo de clasificación por posición y rol geométrico (primero piezas de base/zócalo con menor `Y`, luego laterales/costados verticales, luego repisas fijas y amarres, luego fondos/ranuras, finalmente puertas/cajones/repisas móviles).
  - *Por qué:* Permite generar automáticamente un manual coherente para cualquier diseño libre sin obligar al usuario a programar manualmente cada paso.
- **Renderizado 3D de cotas y cotas dinámicas:**
  - *Enfoque elegido:* Canvas 3D Three.js integrado con geometrías de línea y etiquetas HTML/Sprite para cotas milimétricas legibles desde cualquier ángulo de cámara.
  - *Por qué:* Máxima nitidez y fidelidad espacial sin distorsión de escala.
- **Cálculo de herramientas y herrajes:**
  - *Enfoque elegido:* Detección de uniones y contactos perpendiculares entre tableros de melamina para estimar puntos de atornillado (2 a 3 tornillos 4x50mm por unión estándar de 300-600mm de profundidad).

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App.tsx (Header & State)                        │
│   [3D Viewport]  [Cortes]  [Almacén]  │  [🔨 Armado]  [📥 Exportar]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ triggers
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    AssemblyGuideModal.tsx                              │
│                                                                        │
│  ┌────────────────────────────────────┐ ┌───────────────────────────┐  │
│  │     Assembly3DCanvas.tsx           │ │ AssemblySidebar.tsx       │  │
│  │  - Three.js Orbit Controls         │ │  - Selector de Pasos      │  │
│  │  - Piezas con animación de ensamble│ │  - Checklist interactivo  │  │
│  │  - Cotas 3D en tiempo real (mm)    │ │  - Herramientas requeridas│  │
│  │  - Resaltado de piezas del paso    │ │  - Herrajes y tornillos   │  │
│  │  - Slider de explosión (0-100%)    │ │  - Barra de progreso (%)  │  │
│  └────────────────────────────────────┘ └───────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Actions Footer: [Anterior] [Siguiente] [Auto] [🖨️ Imprimir Guía] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Estructura de datos (`AssemblyStep`):**
  - `stepNumber`: Índice del paso (1, 2, 3...).
  - `title`: Título descriptivo (ej. "Ensamble de Estructura Base y Laterales").
  - `pieceIds`: IDs de las piezas involucradas.
  - `toolsNeeded`: Lista de herramientas utilizadas en este paso.
  - `hardwareNeeded`: Conteo de tornillos y herrajes utilizados.
  - `dimensions`: Cotas clave a mostrar (distancias interiores, altura, escuadra).
  - `completed`: Estado booleano en el checklist reactivo.
