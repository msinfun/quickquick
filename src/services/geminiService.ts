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
   * Automatically categorize an item name based on user's categories.
   */
  static async categorizeItem(itemName: string, userCategories: any[]): Promise<{ main_category: string; sub_category: string } | null> {
    const systemPrompt = `你是一個專業的記帳分類助手。請依據使用者提供的預設分類表，將使用者的輸入項目準確分類。\n\n預設分類表：\n${JSON.stringify(userCategories, null, 2)}\n\n請以最合適的分類來回覆，只回傳 JSON，格式如下：\n{"main_category": "對應的主分類", "sub_category": "對應的子分類"}\n如果不確定，回傳你覺得最可能的主分類/子分類。`;

    try {
      const results = await this.parseExpense(systemPrompt, itemName);
      if (results && results.length > 0 && results[0].main_category) {
        return { main_category: results[0].main_category, sub_category: results[0].sub_category || "其他" };
      }
      return null;
    } catch (e) {
      console.warn("Categorize feature error:", e);
      return null;
    }
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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || "未知錯誤";

        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error("API 金鑰無效或權限不足，請至「設定」重新檢查金鑰。");
        } else if (response.status === 429) {
          throw new Error("API 呼叫次數已達配額上限，請稍後再試。");
        } else if (response.status >= 500) {
          throw new Error("Google AI 伺服器目前不穩定，請稍後再試。");
        } else {
          throw new Error(`AI 解析失敗 (${response.status}): ${errorMessage}`);
        }
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
