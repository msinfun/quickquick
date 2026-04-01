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
  static async parseExpense(systemPrompt: string, userInput: string, images: string[] = [], audio?: { data: string, mimeType: string }, signal?: AbortSignal): Promise<any[]> {
    const keySetting = await db.settings.where("key").equals("gemini_api_key").first();
    const apiKey = keySetting?.value;

    if (!apiKey) {
      console.warn("Gemini API Key is missing in local settings.");
      throw new Error("API_KEY_MISSING");
    }

    // 依使用者要求維持模型版本
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const parts: any[] = [
      { text: systemPrompt },
      { text: "User Input: " + (userInput || "Parsing request from provided image.") }
    ];

    images.forEach(base64 => {
      let mimeType = "image/jpeg";
      let data = base64;
      if (base64.startsWith("data:")) {
        const match = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) { mimeType = match[1]; data = match[2]; }
      }
      parts.push({ inlineData: { mimeType, data } });
    });

    if (audio) {
      parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data } });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" }
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal
      });

      if (!response.ok) {
        let errorMessage = "發生未知錯誤，請稍後再試。";
        switch (response.status) {
          case 400: errorMessage = "請求格式錯誤 (400)。"; break;
          case 401: errorMessage = "未授權，請檢查 API 權限設定 (401)。"; break;
          case 403: errorMessage = "拒絕存取 (403)。"; break;
          case 404: errorMessage = "找不到請求的資源 (404)。"; break;
          case 408: errorMessage = "請求超時 (408)。"; break;
          case 429: errorMessage = "請求次數過多，請稍後再試 (429)。"; break;
          case 500: errorMessage = "伺服器內部錯誤 (500)。"; break;
          case 502: errorMessage = "錯誤的閘道 (502)。"; break;
          case 503: errorMessage = "服務暫時無法使用，請稍後再試 (503)。"; break;
          case 504: errorMessage = "閘道超時 (504)。"; break;
          default: errorMessage = `連線錯誤 (${response.status})。`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      
      console.log("Gemini Raw Response:", responseText);

      const parsed = JSON.parse(responseText);
      
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) return [parsed];
      
      return [];
    } catch (error) {
      console.error("Gemini AI Parsing Error:", error);
      throw error;
    }
  }
}
