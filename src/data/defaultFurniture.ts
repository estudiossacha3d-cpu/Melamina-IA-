import { DynamicFurnitureItem } from '../types';

export const DEFAULT_FURNITURE_CATEGORIES = [
  'Todos',
  'Estantes',
  'Roperos',
  'Cocina',
  'Escritorios',
  'Mesas',
  'Personalizados'
];

export const DEFAULT_FURNITURE: DynamicFurnitureItem[] = [
{
  "id": "furn-shelf-mv7aisix",
  "name": "Estante Modular con MDF Ranurado 18mm",
  "category": "Estantes",
  "description": "Estante modular paramétrico (4 repisas, 0 divisiones verticales, zócalo 80mm). Fondo MDF 4mm ranurado en piezas.",
  "dimensions": {
    "width": 636,
    "height": 2100,
    "depth": 400
  },
  "thickness": 18,
  "tags": [
    "componente dinámico",
    "paramétrico",
    "estante",
    "modular",
    "repisas-4",
    "columna-unica",
    "mdf-ranurado"
  ],
  "pieces": [
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": true,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-lat-izq",
      "name": "Parante Izquierdo",
      "largo": 2100,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Canto Delgado",
        "ancho2": "Canto Delgado"
      },
      "position3D": [
        -309,
        1050,
        0
      ],
      "rotation3D": [
        0,
        0,
        1.5707963267948966
      ],
      "ranuraConfig": {
        "lado": "L2",
        "dist": 18,
        "esp": 4,
        "prof": 8,
        "cara": "inferior"
      }
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": true,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-lat-der",
      "name": "Parante Derecho",
      "largo": 2100,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Canto Delgado",
        "ancho2": "Canto Delgado"
      },
      "position3D": [
        309,
        1050,
        0
      ],
      "rotation3D": [
        0,
        0,
        1.5707963267948966
      ],
      "ranuraConfig": {
        "lado": "L2",
        "dist": 18,
        "esp": 4,
        "prof": 8,
        "cara": "superior"
      }
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-zocalo-front",
      "name": "Zócalo Frontal",
      "largo": 600,
      "ancho": 80,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        40,
        191
      ],
      "rotation3D": [
        1.5707963267948966,
        0,
        0
      ]
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-zocalo-post",
      "name": "Zócalo Posterior",
      "largo": 600,
      "ancho": 80,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        40,
        -171
      ],
      "rotation3D": [
        1.5707963267948966,
        0,
        0
      ]
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": true,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-base-piso",
      "name": "Piso / Base",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        89,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ],
      "ranuraConfig": {
        "lado": "L2",
        "dist": 18,
        "esp": 4,
        "prof": 8,
        "cara": "superior"
      }
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": true,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-techo-cubierta",
      "name": "Techo / Cubierta",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        2091,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ],
      "ranuraConfig": {
        "lado": "L2",
        "dist": 18,
        "esp": 4,
        "prof": 8,
        "cara": "inferior"
      }
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "MDF Blanco",
      "customColor": "#d6d3d1",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-fondo-trupan",
      "name": "Fondo MDF 4mm (Ranurado)",
      "largo": 2000,
      "ancho": 616,
      "espesor": 4,
      "cantidad": 1,
      "cantos": {
        "largo1": "Ninguno",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        1090,
        -180
      ],
      "rotation3D": [
        0,
        1.5707963267948966,
        1.5707963267948966
      ]
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-repisa-int-1",
      "name": "Repisa (Nivel 1)",
      "largo": 600,
      "ancho": 378,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        490,
        11
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-repisa-int-2",
      "name": "Repisa (Nivel 2)",
      "largo": 600,
      "ancho": 378,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        891,
        11
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-repisa-int-3",
      "name": "Repisa (Nivel 3)",
      "largo": 600,
      "ancho": 378,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        1291,
        11
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "c1981239-2c46-4de8-92f7-9c23eceb1993",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "c1981239-2c46-4de8-92f7-9c23eceb1993-repisa-int-4",
      "name": "Repisa (Nivel 4)",
      "largo": 600,
      "ancho": 378,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        1691,
        11
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    }
  ],
  "dynamicShelfConfig": {
    "totalHeight": 2100,
    "totalWidth": 636,
    "totalDepth": 400,
    "thickness": 18,
    "shelfCount": 4,
    "verticalDivisions": 0,
    "divisionStyle": "continuous_vertical",
    "staggerPattern": "offset",
    "includePlinth": true,
    "plinthHeight": 80,
    "includeBack": true,
    "backThickness": 4,
    "backType": "ranurado",
    "backGrooveDist": 18,
    "backGrooveDepth": 8,
    "material": "Blanco",
    "customColor": "#ecebe6",
    "customRoughness": 0.85,
    "customMetalness": 0
  },
  "dynamicParameters": [
    {
      "id": "totalHeight",
      "name": "Altura Total",
      "label": "Altura (H mm)",
      "type": "dimension",
      "defaultValue": 2100,
      "unit": "mm",
      "description": "Altura exterior total del mueble"
    },
    {
      "id": "totalWidth",
      "name": "Ancho Total",
      "label": "Ancho (W mm)",
      "type": "dimension",
      "defaultValue": 636,
      "unit": "mm",
      "description": "Ancho frontal exterior total"
    },
    {
      "id": "totalDepth",
      "name": "Profundidad",
      "label": "Profundidad (D mm)",
      "type": "dimension",
      "defaultValue": 400,
      "unit": "mm",
      "description": "Profundidad de repisas y parantes"
    },
    {
      "id": "shelfCount",
      "name": "Repisas Intermedias",
      "label": "Número de Repisas",
      "type": "number",
      "defaultValue": 4,
      "description": "Cantidad de baldas o repisas intermedias"
    },
    {
      "id": "verticalDivisions",
      "name": "Divisiones Verticales",
      "label": "Divisiones en medio",
      "type": "number",
      "defaultValue": 0,
      "description": "Montantes divisorios para diseños de múltiples columnas"
    },
    {
      "id": "divisionStyle",
      "name": "Estilo de División",
      "label": "Tipo de Estructura",
      "type": "select",
      "defaultValue": "continuous_vertical",
      "options": [
        "continuous_vertical",
        "continuous_horizontal",
        "staggered"
      ],
      "description": "Diseño estructural de las divisiones"
    },
    {
      "id": "staggerPattern",
      "name": "Patrón de Alternancia",
      "label": "Tipo de Alternancia",
      "type": "select",
      "defaultValue": "offset",
      "options": [
        "offset",
        "brick"
      ],
      "description": "Patrón de casilleros alternos (offset: zig-zag nórdico, brick: aparejo trabado)"
    }
  ],
  "status": "has_3d",
  "createdAt": "2026-10-13T23:06:38.697Z",
  "updatedAt": "2026-10-13T23:06:38.697Z",
  "notes": "Generado desde el componente dinámico de estantes."
},
{
  "id": "furn-shelf-mv7aisiy",
  "name": "Estante Modular con MDF Sobrepuesto 4mm",
  "category": "Estantes",
  "description": "Estante modular paramétrico (4 repisas, 0 divisiones verticales, zócalo 80mm). Fondo MDF 4mm sobrepuesto / clavado.",
  "dimensions": {
    "width": 636,
    "height": 2100,
    "depth": 400
  },
  "thickness": 18,
  "tags": [
    "componente dinámico",
    "paramétrico",
    "estante",
    "modular",
    "repisas-4",
    "columna-unica",
    "mdf-sobrepuesto"
  ],
  "pieces": [
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-lat-izq",
      "name": "Parante Izquierdo",
      "largo": 2100,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Canto Delgado",
        "ancho2": "Canto Delgado"
      },
      "position3D": [
        -309,
        1050,
        0
      ],
      "rotation3D": [
        0,
        0,
        1.5707963267948966
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-lat-der",
      "name": "Parante Derecho",
      "largo": 2100,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Canto Delgado",
        "ancho2": "Canto Delgado"
      },
      "position3D": [
        309,
        1050,
        0
      ],
      "rotation3D": [
        0,
        0,
        1.5707963267948966
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-zocalo-front",
      "name": "Zócalo Frontal",
      "largo": 600,
      "ancho": 80,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        40,
        191
      ],
      "rotation3D": [
        1.5707963267948966,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-zocalo-post",
      "name": "Zócalo Posterior",
      "largo": 600,
      "ancho": 80,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        40,
        -167
      ],
      "rotation3D": [
        1.5707963267948966,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-base-piso",
      "name": "Piso / Base",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        89,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-techo-cubierta",
      "name": "Techo / Cubierta",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        2091,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "MDF Blanco",
      "customColor": "#d6d3d1",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-fondo-trupan",
      "name": "Fondo MDF 4mm (Sobrepuesto)",
      "largo": 2020,
      "ancho": 636,
      "espesor": 4,
      "cantidad": 1,
      "cantos": {
        "largo1": "Ninguno",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        1090,
        -202
      ],
      "rotation3D": [
        0,
        1.5707963267948966,
        1.5707963267948966
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-repisa-int-1",
      "name": "Repisa (Nivel 1)",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        490,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-repisa-int-2",
      "name": "Repisa (Nivel 2)",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        891,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-repisa-int-3",
      "name": "Repisa (Nivel 3)",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        1291,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    },
    {
      "groupId": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1",
      "material": "Blanco",
      "customColor": "#ecebe6",
      "customRoughness": 0.85,
      "customMetalness": 0,
      "customOpacity": 1,
      "veta": false,
      "rotacion": true,
      "ranurado": false,
      "abisagrado": false,
      "id": "d8f1e30a-0193-43ce-98d9-044cfc9f43a1-repisa-int-4",
      "name": "Repisa (Nivel 4)",
      "largo": 600,
      "ancho": 400,
      "espesor": 18,
      "cantidad": 1,
      "cantos": {
        "largo1": "Canto Delgado",
        "largo2": "Ninguno",
        "ancho1": "Ninguno",
        "ancho2": "Ninguno"
      },
      "position3D": [
        0,
        1691,
        0
      ],
      "rotation3D": [
        0,
        0,
        0
      ]
    }
  ],
  "dynamicShelfConfig": {
    "totalHeight": 2100,
    "totalWidth": 636,
    "totalDepth": 400,
    "thickness": 18,
    "shelfCount": 4,
    "verticalDivisions": 0,
    "divisionStyle": "continuous_vertical",
    "staggerPattern": "offset",
    "includePlinth": true,
    "plinthHeight": 80,
    "includeBack": true,
    "backThickness": 4,
    "backType": "sobrepuesto",
    "backGrooveDist": 18,
    "backGrooveDepth": 8,
    "material": "Blanco",
    "customColor": "#ecebe6",
    "customRoughness": 0.85,
    "customMetalness": 0
  },
  "dynamicParameters": [
    {
      "id": "totalHeight",
      "name": "Altura Total",
      "label": "Altura (H mm)",
      "type": "dimension",
      "defaultValue": 2100,
      "unit": "mm",
      "description": "Altura exterior total del mueble"
    },
    {
      "id": "totalWidth",
      "name": "Ancho Total",
      "label": "Ancho (W mm)",
      "type": "dimension",
      "defaultValue": 636,
      "unit": "mm",
      "description": "Ancho frontal exterior total"
    },
    {
      "id": "totalDepth",
      "name": "Profundidad",
      "label": "Profundidad (D mm)",
      "type": "dimension",
      "defaultValue": 400,
      "unit": "mm",
      "description": "Profundidad de repisas y parantes"
    },
    {
      "id": "shelfCount",
      "name": "Repisas Intermedias",
      "label": "Número de Repisas",
      "type": "number",
      "defaultValue": 4,
      "description": "Cantidad de baldas o repisas intermedias"
    },
    {
      "id": "verticalDivisions",
      "name": "Divisiones Verticales",
      "label": "Divisiones en medio",
      "type": "number",
      "defaultValue": 0,
      "description": "Montantes divisorios para diseños de múltiples columnas"
    },
    {
      "id": "divisionStyle",
      "name": "Estilo de División",
      "label": "Tipo de Estructura",
      "type": "select",
      "defaultValue": "continuous_vertical",
      "options": [
        "continuous_vertical",
        "continuous_horizontal",
        "staggered"
      ],
      "description": "Diseño estructural de las divisiones"
    },
    {
      "id": "staggerPattern",
      "name": "Patrón de Alternancia",
      "label": "Tipo de Alternancia",
      "type": "select",
      "defaultValue": "offset",
      "options": [
        "offset",
        "brick"
      ],
      "description": "Patrón de casilleros alternos (offset: zig-zag nórdico, brick: aparejo trabado)"
    }
  ],
  "status": "has_3d",
  "createdAt": "2026-10-13T23:06:38.698Z",
  "updatedAt": "2026-10-13T23:06:38.698Z",
  "notes": "Generado desde el componente dinámico de estantes."
}
];

export const DEFAULT_FURNITURE_CATALOG = DEFAULT_FURNITURE;
