
import { GoogleGenAI } from "@google/genai";

export interface ProductSource {
  data: string;
  mimeType: string;
}

export interface RenderParams {
  products: ProductSource[];
  refinement: string;
  aspectRatio: string;
  quality: string;
  cameraAngle: string;
  material: string;
  reflection: string;
  isCaraway: boolean;
  productScale: number;
  backgroundImage: string;
  backgroundMime: string;
  stagingMode: 'replace' | 'add';
  strictFidelity: boolean;
}

export const editImage = async (params: RenderParams): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const parts: any[] = [];

    const fidelityInstruction = params.strictFidelity 
      ? "GEOMETRIC LOCK: The product images (IMAGE 1, 2, etc.) are the absolute ground truth. DO NOT change the shape, design, buttons, labels, or physical structure of these products. Only adjust their lighting, contact shadows, and subtle perspective skew to match IMAGE 0."
      : "NATURAL INTEGRATION: Seamlessly blend the products into the scene, ensuring they look like they were photographed there.";

    const stagingInstruction = params.stagingMode === 'replace' 
      ? "SWAP LOGIC: Identify existing objects in the center of IMAGE 0. Remove them and place the new products in their exact location with matching perspective."
      : "PLACEMENT LOGIC: Keep IMAGE 0 as is. Place the new products on a logical, flat surface within the environment.";

    const materialNote = {
      'Glossy': 'High-gloss finish with sharp, clear reflections.',
      'Matte': 'Satin matte finish with soft, diffused lighting.',
      'PolishedInox': 'Mirrored metallic finish.',
      'BrushedInox': 'Industrial brushed metal texture.'
    }[params.material] || 'Glossy';

    const reflectionNote = {
      'Natural': 'Realistic soft contact shadows and subtle ground reflections.',
      'Strong': 'Intense mirror-like reflections on the surface beneath the product.',
      'Cinematic': 'Atmospheric rim lighting and dramatic artistic shadows.'
    }[params.reflection] || 'Natural';

    const coreInstruction = `
      TASK: High-Fidelity Professional Visual Staging.
      
      CORE RULES:
      1. Use IMAGE 0 as the master environment.
      2. ${fidelityInstruction}
      3. ${stagingInstruction}
      4. Group all products together as a high-end staged set.
      
      STRICT REFINEMENT RULES:
      - DO NOT modify product geometry, structure, proportions, materials, or colors.
      - DO NOT reinterpret or replace materials (no wood conversion, no texture change).
      - Keep all product details exactly as original.
      
      LIGHTING & SHADOWS:
      - Match product lighting precisely with the environment.
      - Primary light source from top-right, angled natural indoor sunlight.
      - Apply consistent highlights and shadow direction across all objects.
      - Ensure realistic specular highlights on metal surfaces, no overexposure.
      - Generate accurate contact shadows under each product.
      - Shadows must be soft-edged but clearly visible and grounded.
      - Shadow direction must match environment (cast toward bottom-left).
      - No floating objects, no inconsistent shadow angles.
      
      COLOR & TONE:
      - Match overall white balance to warm indoor lighting.
      - Maintain true product colors, avoid color shifting.
      - Slightly balance contrast to integrate naturally with the scene.
      
      COMPOSITION & PERSPECTIVE:
      - Rearrange products into a clean, intentional layout:
        * One main (hero) product slightly dominant
        * Supporting products placed with equal spacing
        * Align all objects on the same surface plane
        * Create a clear horizontal visual flow
        * Avoid clutter, overlap, or random placement
      - Maintain correct perspective and scale for all products.
      - No distortion, all objects must sit naturally on the countertop.
      
      SPECIFICATIONS:
      - ASPECT RATIO: ${params.aspectRatio}
      - VIEWING ANGLE: Match the ${params.cameraAngle} degree perspective of the background.
      - PRODUCT SCALE: Render at ${params.productScale}x scale relative to environment.
      - SURFACE MATERIAL: ${materialNote}
      - REFLECTION STYLE: ${reflectionNote}
      
      USER REFINEMENT:
      ${params.refinement || 'Ensure products look heavy, anchored, and perfectly lit by the scene light sources.'}
      
      ${params.isCaraway ? 'STYLE: Minimalist, bright, premium commercial catalog aesthetic (Caraway style).' : ''}
      
      OUTPUT: Ultra-realistic, 4K professional photography. Preserve all product branding and details perfectly.
    `;

    // Part 0: Background
    parts.push({
      inlineData: { data: params.backgroundImage, mimeType: params.backgroundMime },
    });

    // Parts 1-N: Products
    params.products.forEach((p) => {
      parts.push({
        inlineData: { data: p.data, mimeType: p.mimeType },
      });
    });

    parts.push({ text: coreInstruction });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: {
        imageConfig: {
            aspectRatio: params.aspectRatio as any
        }
      },
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
      }
    }
    return null;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "Rendering failed.");
  }
};
