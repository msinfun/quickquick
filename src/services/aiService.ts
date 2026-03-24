import { SYSTEM_PROMPT_TEMPLATE } from "@/constants/prompts";
import { GeminiService } from "./geminiService";

export interface AIParseResult {
  date: string;
  amount: number;
  item_name: string;
  main_category: string;
  sub_category: string;
  merchant: string;
  billing_month: string;
  invoice_number: string;
  note: string;
  confidence_score: number;
}

/**
 * Service to handle AI-powered expense parsing.
 */
export class AIService {
  /**
   * Generates the system prompt with injected dynamic context.
   * @param categoryDict Current system categories mapping.
   * @param historyData User's historical transaction patterns.
   */
  static generateSystemPrompt(categoryDict: Record<string, string[]>, historyData: { merchant: string; main_category: string; sub_category: string }[]): string {
    const now = new Date();
    const currentDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return SYSTEM_PROMPT_TEMPLATE
      .replace("{{CURRENT_DATE}}", currentDate)
      .replace("{{CURRENT_MONTH}}", currentMonth)
      .replace("{{CATEGORY_DICT}}", JSON.stringify(categoryDict))
      .replace("{{HISTORY_DATA}}", JSON.stringify(historyData));
  }

  /**
   * Parses natural language input into structured transaction data.
   */
  static async parseInput(input: string, categoryDict: Record<string, string[]>, historyData: { merchant: string; main_category: string; sub_category: string }[], images: string[] = [], audio?: { data: string, mimeType: string }): Promise<AIParseResult[]> {
    const systemPrompt = this.generateSystemPrompt(categoryDict, historyData);
    
    try {
      console.log("AI Parsing Input (Attempting Gemini):", input, "with", images.length, "images", audio ? "and audio" : "");
      
      // Attempt to use Real Gemini AI
      try {
        const results = await GeminiService.parseExpense(systemPrompt, input, images, audio);
        if (results && results.length > 0) {
          return results;
        }
      } catch (geminiError) {
        console.warn("Gemini Parsing failed, falling back to local simulation:", geminiError);
      }

      // --- Local Simulation Fallback (Enhanced Regex Logic) ---
      let dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      let remainingInput = input;
      
      // 1. Try to extract date like "3/15", "03/15", "3月15"
      const dateMatch = remainingInput.match(/(\d{1,2})[\/\-月](\d{1,2})/);
      if (dateMatch) {
         const currentYear = new Date().getFullYear();
         const month = String(dateMatch[1]).padStart(2, '0');
         const day = String(dateMatch[2]).padStart(2, '0');
         dateStr = `${currentYear}/${month}/${day}`;
         // Remove the matched date from the input string
         remainingInput = remainingInput.replace(dateMatch[0], '').replace(/日/g, "").trim();
      }

      // 2. Extract amount - look for numbers that don't look like years (4 digits starting with 20)
      // or very long strings (phone numbers/invoices)
      const numberMatches = remainingInput.match(/\b\d+(\.\d+)?\b/g);
      let amount = 0;
      
      if (numberMatches && numberMatches.length > 0) {
         // Filter out potential years or tiny numbers unless they are the only ones
         const potAmount = numberMatches.find(n => {
           const val = parseFloat(n);
           return val > 0 && n.length <= 8 && !n.startsWith('20'); // Simple heuristic to avoid YYYY
         }) || numberMatches[numberMatches.length - 1];
         
         amount = parseFloat(potAmount);
         const lastIdx = remainingInput.lastIndexOf(potAmount);
         if (lastIdx !== -1) {
           remainingInput = remainingInput.substring(0, lastIdx) + remainingInput.substring(lastIdx + potAmount.length);
         }
      }

      // 3. Extract Item Name and Merchant
      remainingInput = remainingInput.trim().replace(/\s+/g, ' ');
      const textParts = remainingInput.split(' ').filter(Boolean);
      
      let itemName = "未命名項目";
      let merchant = "";
      
      if (textParts.length >= 2) {
        merchant = textParts[0];
        itemName = textParts.slice(1).join(" ");
      } else if (textParts.length === 1 && textParts[0]) {
        itemName = textParts[0];
      }

      const mockResult: AIParseResult[] = [{
        date: dateStr,
        amount: amount,
        item_name: itemName,
        main_category: Object.keys(categoryDict)[0] || "飲食",
        sub_category: categoryDict[Object.keys(categoryDict)[0]]?.[0] || "其他",
        merchant: merchant,
        billing_month: dateStr.slice(0, 7).replace(/\//g, '-'),
        invoice_number: "",
        note: `自動解析: ${input}`,
        confidence_score: 0.8
      }];

      return mockResult;

    } catch (error) {
      console.error("AI Parsing Fatal Error:", error);
      return [];
    }
  }
}
