import * as THREE from 'three';

export interface GrooveParams {
  lado: 'L1' | 'L2' | 'A1' | 'A2';
  dist: number; // Distancia en mm desde el borde hasta la ranura
  esp: number;  // Espesor de la ranura / Grosor del fondo o respaldo en mm
  prof: number; // Profundidad de la ranura en mm
  cara?: 'superior' | 'inferior'; // Cara sobre la cual se fresa la ranura (+Y o -Y)
}

/**
 * Genera la geometría 3D física real con el ranurado mecanizado (CNC / Sierra de banco).
 * El canal o ranura se talla físicamente sobre la pieza según las dimensiones especificadas:
 * - L1: A lo largo del Largo (eje X), junto al borde frontal +Z (Largo 1)
 * - L2: A lo largo del Largo (eje X), junto al borde posterior -Z (Largo 2)
 * - A1: A lo largo del Ancho (eje Z), junto al borde lateral derecho +X (Ancho 1)
 * - A2: A lo largo del Ancho (eje Z), junto al borde lateral izquierdo -X (Ancho 2)
 *
 * Las dimensiones pLargo, pEspesor y pAncho están en unidades 3D (metros).
 */
export function createGroovedPieceGeometry(
  pLargo: number,
  pEspesor: number,
  pAncho: number,
  params: GrooveParams,
  scale: number = 0.001
): THREE.BufferGeometry {
  const lado = params.lado || 'L2';
  const isInferior = params.cara === 'inferior';
  
  // Convertir milímetros a metros
  const rawDist = Math.max(1, params.dist ?? 18) * scale;
  const rawEsp = Math.max(1, params.esp ?? 4) * scale;
  const rawProf = Math.max(1, params.prof ?? 8) * scale;

  // Seguridad: la profundidad no puede traspasar el 90% del espesor total
  const safeProf = Math.min(rawProf, pEspesor * 0.90);

  const halfLargo = pLargo / 2;
  const halfEspesor = pEspesor / 2;
  const halfAncho = pAncho / 2;

  let geom: THREE.BufferGeometry;

  if (lado === 'L1' || lado === 'L2') {
    // La ranura corre a lo largo del Largo (eje X).
    // La sección transversal perfilada está en el plano (Z, Y).
    const shape = new THREE.Shape();
    const maxCross = pAncho;
    const safeDist = Math.max(0.001, Math.min(rawDist, maxCross - 0.003));
    const safeEsp = Math.max(0.001, Math.min(rawEsp, maxCross - safeDist - 0.001));

    const yBottom = -halfEspesor;
    const yTop = halfEspesor;

    if (lado === 'L1') {
      // Borde L1 en +Z (halfAncho)
      const zEdge = halfAncho;
      const zBase = -halfAncho;
      const zOuter = zEdge - safeDist;
      const zInner = zOuter - safeEsp;

      if (!isInferior) {
        // Polígono anti-horario cerrado con ranura en cara superior (+Y)
        shape.moveTo(zBase, yBottom);
        shape.lineTo(zEdge, yBottom);
        shape.lineTo(zEdge, yTop);
        shape.lineTo(zOuter, yTop);
        shape.lineTo(zOuter, yTop - safeProf);
        shape.lineTo(zInner, yTop - safeProf);
        shape.lineTo(zInner, yTop);
        shape.lineTo(zBase, yTop);
        shape.closePath();
      } else {
        // Polígono anti-horario cerrado con ranura en cara inferior (-Y)
        shape.moveTo(zBase, yBottom);
        shape.lineTo(zInner, yBottom);
        shape.lineTo(zInner, yBottom + safeProf);
        shape.lineTo(zOuter, yBottom + safeProf);
        shape.lineTo(zOuter, yBottom);
        shape.lineTo(zEdge, yBottom);
        shape.lineTo(zEdge, yTop);
        shape.lineTo(zBase, yTop);
        shape.closePath();
      }
    } else {
      // Borde L2 en -Z (-halfAncho)
      const zEdge = -halfAncho;
      const zBase = halfAncho;
      const zOuter = zEdge + safeDist;
      const zInner = zOuter + safeEsp;

      if (!isInferior) {
        // Polígono anti-horario cerrado con ranura en cara superior (+Y)
        shape.moveTo(zEdge, yBottom);
        shape.lineTo(zBase, yBottom);
        shape.lineTo(zBase, yTop);
        shape.lineTo(zInner, yTop);
        shape.lineTo(zInner, yTop - safeProf);
        shape.lineTo(zOuter, yTop - safeProf);
        shape.lineTo(zOuter, yTop);
        shape.lineTo(zEdge, yTop);
        shape.closePath();
      } else {
        // Polígono anti-horario cerrado con ranura en cara inferior (-Y)
        shape.moveTo(zEdge, yBottom);
        shape.lineTo(zOuter, yBottom);
        shape.lineTo(zOuter, yBottom + safeProf);
        shape.lineTo(zInner, yBottom + safeProf);
        shape.lineTo(zInner, yBottom);
        shape.lineTo(zBase, yBottom);
        shape.lineTo(zBase, yTop);
        shape.lineTo(zEdge, yTop);
        shape.closePath();
      }
    }

    const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
      depth: pLargo,
      bevelEnabled: false
    });

    // Centrar en Z (que corresponde al Largo durante la extrusión)
    extrudeGeom.translate(0, 0, -halfLargo);

    // Rotar para alinear: el eje de la sección (X del shape) pasa a Z de la pieza,
    // y la longitud extruida (Z del shape) pasa a X de la pieza.
    extrudeGeom.rotateY(-Math.PI / 2);
    extrudeGeom.computeVertexNormals();
    extrudeGeom.computeBoundingBox();
    extrudeGeom.computeBoundingSphere();
    geom = extrudeGeom;
  } else {
    // A1 o A2: La ranura corre a lo largo del Ancho (eje Z).
    // La sección transversal perfilada está en el plano (X, Y).
    const shape = new THREE.Shape();
    const maxCross = pLargo;
    const safeDist = Math.max(0.001, Math.min(rawDist, maxCross - 0.003));
    const safeEsp = Math.max(0.001, Math.min(rawEsp, maxCross - safeDist - 0.001));

    const yBottom = -halfEspesor;
    const yTop = halfEspesor;

    if (lado === 'A1') {
      // Borde A1 en +X (halfLargo)
      const xEdge = halfLargo;
      const xBase = -halfLargo;
      const xOuter = xEdge - safeDist;
      const xInner = xOuter - safeEsp;

      if (!isInferior) {
        shape.moveTo(xBase, yBottom);
        shape.lineTo(xEdge, yBottom);
        shape.lineTo(xEdge, yTop);
        shape.lineTo(xOuter, yTop);
        shape.lineTo(xOuter, yTop - safeProf);
        shape.lineTo(xInner, yTop - safeProf);
        shape.lineTo(xInner, yTop);
        shape.lineTo(xBase, yTop);
        shape.closePath();
      } else {
        shape.moveTo(xBase, yBottom);
        shape.lineTo(xInner, yBottom);
        shape.lineTo(xInner, yBottom + safeProf);
        shape.lineTo(xOuter, yBottom + safeProf);
        shape.lineTo(xOuter, yBottom);
        shape.lineTo(xEdge, yBottom);
        shape.lineTo(xEdge, yTop);
        shape.lineTo(xBase, yTop);
        shape.closePath();
      }
    } else {
      // Borde A2 en -X (-halfLargo)
      const xEdge = -halfLargo;
      const xBase = halfLargo;
      const xOuter = xEdge + safeDist;
      const xInner = xOuter + safeEsp;

      if (!isInferior) {
        shape.moveTo(xEdge, yBottom);
        shape.lineTo(xBase, yBottom);
        shape.lineTo(xBase, yTop);
        shape.lineTo(xInner, yTop);
        shape.lineTo(xInner, yTop - safeProf);
        shape.lineTo(xOuter, yTop - safeProf);
        shape.lineTo(xOuter, yTop);
        shape.lineTo(xEdge, yTop);
        shape.closePath();
      } else {
        shape.moveTo(xEdge, yBottom);
        shape.lineTo(xOuter, yBottom);
        shape.lineTo(xOuter, yBottom + safeProf);
        shape.lineTo(xInner, yBottom + safeProf);
        shape.lineTo(xInner, yBottom);
        shape.lineTo(xBase, yBottom);
        shape.lineTo(xBase, yTop);
        shape.lineTo(xEdge, yTop);
        shape.closePath();
      }
    }

    const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
      depth: pAncho,
      bevelEnabled: false
    });

    // Centrar en Z (que corresponde al Ancho durante la extrusión)
    extrudeGeom.translate(0, 0, -halfAncho);
    extrudeGeom.computeVertexNormals();
    extrudeGeom.computeBoundingBox();
    extrudeGeom.computeBoundingSphere();
    geom = extrudeGeom;
  }

  return geom;
}
