import { GoogleGenAI, Type } from "@google/genai";
import { Piece } from "../types";
import { v4 as uuidv4 } from "uuid";

// Initialize the GenAI SDK
let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch (error) {
  console.error("Failed to initialize GoogleGenAI. Is GEMINI_API_KEY set?", error);
}

export async function interpretFurnitureImage(base64Image: string, mimeType: string): Promise<Piece[]> {
  if (!ai) {
    throw new Error("API de Gemini no configurada.");
  }

  const systemInstruction = `
Eres un ingeniero de diseño de muebles de melamina (Despiece). Tu tarea es hacer ingeniería inversa a partir de una imagen de un mueble de gabinete/melamina.
Debes identificar cada pieza (tablero) necesaria para construir el mueble, estimar sus dimensiones y configurar sus cantos.

REGLAS ESTRICTAS:
1. "largo" debe ser el lado más grande de la pieza, "ancho" el lado más corto, todo en milímetros (mm).
2. "espesor" por defecto es 18 (mm).
3. "cantidad" es el número de piezas idénticas.
4. "cantos" debe especificar la aplicación de cantos para sus 4 lados (Largo 1, Largo 2, Ancho 1, Ancho 2).
   Los valores válidos son "Canto Delgado", "Canto Grueso", o "Ninguno".
5. "position3D" es la posición central [x, y, z] de la pieza en el ensamblaje en milímetros (considerando el centro inferior como origen [0,0,0]).
6. "rotation3D" es la rotación de la pieza [x, y, z] en radianes. Por ejemplo, un lateral suele ser [0, 0, 0] o rotado en algún eje, un tablero superior estará horizontal [Math.PI/2, 0, 0]. Trata de adivinar el ensamblaje básico.

Devuelve un JSON array de estas piezas.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        "Analiza esta imagen y devuelve el despiece en melamina."
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre descriptivo de la pieza (ej. 'Lateral izquierdo', 'Tapa superior')" },
              largo: { type: Type.NUMBER, description: "Largo en milímetros." },
              ancho: { type: Type.NUMBER, description: "Ancho en milímetros." },
              espesor: { type: Type.NUMBER, description: "Espesor típicamente 18mm." },
              cantidad: { type: Type.NUMBER, description: "Cantidad de piezas." },
              cantos: {
                type: Type.OBJECT,
                properties: {
                  largo1: { type: Type.STRING, enum: ["Canto Delgado", "Canto Grueso", "Ninguno"] },
                  largo2: { type: Type.STRING, enum: ["Canto Delgado", "Canto Grueso", "Ninguno"] },
                  ancho1: { type: Type.STRING, enum: ["Canto Delgado", "Canto Grueso", "Ninguno"] },
                  ancho2: { type: Type.STRING, enum: ["Canto Delgado", "Canto Grueso", "Ninguno"] },
                },
                required: ["largo1", "largo2", "ancho1", "ancho2"]
              },
              position3D: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Matriz de 3 números [x, y, z] representando la posición de la pieza en mm."
              },
              rotation3D: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Matriz de 3 números [x, y, z] representando la rotación en radianes."
              }
            },
            required: ["name", "largo", "ancho", "espesor", "cantidad", "cantos", "position3D", "rotation3D"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No hay respuesta de texto de Gemini.");

    const piecesData = JSON.parse(text);
    // Agregamos UUIDs a cada pieza que venga del AI
    return piecesData.map((p: any) => ({
      ...p,
      id: uuidv4()
    }));
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
