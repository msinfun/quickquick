import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/db/db";

/**
 * Service to interact directly with Google Gemini AI for structured parsing.
 */
export class GeminiService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static async getGenAI() {
    if (this.genAI) return this.genAI;

    const keySetting = await db.settings.where("key").equals("gemini_api_key").first();
    const apiKey = keySetting?.value;

    if (!apiKey) {
      console.warn("Gemini API Key is missing in local settings.");
      return null;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    return this.genAI;
  }

  /**
   * Parses user input using Gemini Flash model.
   * @param systemPrompt The instructions for the AI
   * @param userInput The raw text/OCR/voice input from the user
   * @param images Optional Base64 images for vision parsing
   * @param audio Optional Base64 audio for speech parsing
   */
  static async parseExpense(systemPrompt: string, userInput: string, images: string[] = [], audio?: { data: string, mimeType: string }): Promise<any[]> {
    const aiInstance = await this.getGenAI();
    if (!aiInstance) {
      throw new Error("API_KEY_MISSING");
    }

    try {
      // 依使用者要求切換至指定的精確版本
      const model = aiInstance.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview", 
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      // Prepare multi-modal parts
      const promptParts = [
        { text: systemPrompt },
        { text: "User Input: " + (userInput || "Parsing request from provided image.") }
      ];

      // Add image parts if provided
      images.forEach((base64, idx) => {
        // Extract mime type if present in data URL, or default to image/jpeg
        let mimeType = "image/jpeg";
        let data = base64;
        
        if (base64.startsWith("data:")) {
          const match = base64.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            data = match[2];
          }
        }

        promptParts.push({
          inlineData: {
            mimeType: mimeType,
            data: data
          }
        } as any);
      });

      // Add audio part if provided
      if (audio) {
        promptParts.push({
          inlineData: {
            mimeType: audio.mimeType,
            data: audio.data
          }
        } as any);
      }

      const result = await model.generateContent(promptParts);
      const responseText = result.response.text();
      
      console.log("Gemini Raw Response:", responseText);

      // Parse the JSON array
      const parsed = JSON.parse(responseText);
      
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        return [parsed]; // Wrap single object in array if needed
      }
      
      return [];
    } catch (error) {
      console.error("Gemini AI Parsing Error:", error);
      throw error;
    }
  }
}
