import { Piece } from '../types';

/**
 * El reconocimiento por imagen queda desactivado en la versión estática.
 * Una clave privada nunca debe compilarse dentro del JavaScript del navegador.
 * Cuando exista un backend autenticado, esta función podrá llamar a ese servicio
 * sin exponer credenciales a los clientes.
 */
export const isAiConfigured = false;

export async function interpretFurnitureImage(
  _base64Image: string,
  _mimeType: string,
): Promise<Piece[]> {
  throw new Error('Reconocimiento por imagen no configurado en esta versión segura.');
}
