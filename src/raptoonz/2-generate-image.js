// Step 2: generate the rapper x cartoon-art-style mashup image. A plain
// stylized character-portrait prompt -- deliberately not staging any
// specific scene/action, and not naming any of the show's own characters
// (the pin is a style mashup of the rapper themselves, not a claim that
// they ARE e.g. Johnny Bravo).
import { generateImage } from "../clients/replicate.js";

export async function generateMashupImage({ rapper, style }) {
  const prompt =
    `Portrait of ${rapper}, a hip-hop artist, reimagined as an animated cartoon character, ` +
    `drawn in the visual art style of the show "${style.name}" (${style.description}). ` +
    `Digital illustration, character portrait, waist-up, vibrant colors, clean line art. No text, no logos, no watermark.`;

  const imageUrl = await generateImage(prompt);
  return { imageUrl, prompt };
}
