import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Camera, Mic, Send, X, Loader2, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AIService } from "@/services/aiService";
import { db, getHistoryForAI } from "@/db/db";
import { useLiveQuery } from "dexie-react-hooks";

// Declare global types for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface AddViewProps {
  onBack: () => void;
  onSuccess?: () => void; // Callback to switch to Pending tab
}

export default function AddView({ onBack, onSuccess }: AddViewProps) {
  const [inputText, setInputText] = useState("");
  const [images, setImages] = useState<string[]>([]); // Base64 or Blob URLs
  const [isParsing, setIsParsing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Camera & Gallery & Audio Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Fetch contextual data for AI
  const categoriesSetting = useLiveQuery(() =>
    db.settings.where("key").equals("categories").first()
  );
  const geminiKeySetting = useLiveQuery(() =>
    db.settings.where("key").equals("gemini_api_key").first()
  );
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const hasApiKey = geminiKeySetting?.value && geminiKeySetting.value.trim() !== "";

  // Shared Helper to prepare AI context
  const getAIContext = async () => {
    const categoriesList = (categoriesSetting?.value as any[]) || [];
    const categoryDict: Record<string, string[]> = categoriesList.reduce((acc, cat) => {
      acc[cat.name] = cat.subCategories?.map((s: any) => s.name) || [];
      return acc;
    }, {} as Record<string, string[]>);
    const historyData = await getHistoryForAI();
    return { categoryDict, historyData };
  };

  const handleSend = async () => {
    if (!inputText && images.length === 0) return;

    setIsParsing(true);
    setValidationError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const { categoryDict, historyData } = await getAIContext();
      const results = await AIService.parseInput(inputText, categoryDict, historyData, images, undefined, controller.signal);

      if (results.length > 0) {
        let sourcePrefix = "";
        if (images && images.length > 0) {
          sourcePrefix = "來源：照片輸入。";
        } else {
          sourcePrefix = `來源：文字輸入：${inputText}`;
        }
        await saveResultsToDB(results, sourcePrefix);
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setValidationError("AI 辨識已超時 (20秒)，請檢查網路連線或稍後再試。");
      } else {
        setValidationError(error.message || "網路連線失敗，請檢查您的網路狀態。");
      }
      console.error("AI Send Error:", error);
    } finally {
      clearTimeout(timeoutId);
      setIsParsing(false);
    }
  };

  // Voice Interaction Logic
  const startRecording = async () => {
    // If not in a secure context (HTTPS or localhost), use file upload fallback
    if (!window.isSecureContext && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      audioInputRef.current?.click();
      return;
    }

    const { webkitSpeechRecognition, SpeechRecognition } = window as any;
    const SpeechRec = SpeechRecognition || webkitSpeechRecognition;

    // Try native speech recognition first
    if (SpeechRec) {
      const recognition = new SpeechRec();
      recognition.lang = "zh-TW";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + transcript);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      // Fallback to MediaRecorder (Raw Audio to Gemini)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size < 1000) return; // Ignore very short taps

          setIsParsing(true);
          setValidationError(null);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          try {
            const { categoryDict, historyData } = await getAIContext();
            const reader = new FileReader();
            
            const processAudio = new Promise<void>((resolve, reject) => {
              reader.onloadend = async () => {
                try {
                  const base64Audio = (reader.result as string).split(',')[1];
                  const results = await AIService.parseInput("", categoryDict, historyData, images, {
                    data: base64Audio,
                    mimeType: 'audio/webm'
                  }, controller.signal);

                  if (results.length > 0) {
                    let sourcePrefix = `來源：語音辨識：${inputText || "音訊檔"}`;
                    await saveResultsToDB(results, sourcePrefix);
                    if (onSuccess) onSuccess();
                  }
                  resolve();
                } catch (err) {
                  reject(err);
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
            });
            await processAudio;
          } catch (error: any) {
            if (error.name === 'AbortError') {
              setValidationError("AI 辨識已超時 (20秒)，請檢查網路連線或稍後再試。");
            } else {
              setValidationError(error.message || "網路連線失敗，請檢查您的網路狀態。");
            }
            console.error("Audio Processing Error:", error);
          } finally {
            clearTimeout(timeoutId);
            setIsParsing(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);
        timerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error("Mic Access Error:", err);
        // Fallback to file input if getUserMedia fails
        audioInputRef.current?.click();
      }
    }
  };

  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setValidationError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const { categoryDict, historyData } = await getAIContext();
      const reader = new FileReader();
      
      const processFile = new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64Audio = (reader.result as string).split(',')[1];
            const results = await AIService.parseInput("", categoryDict, historyData, images, {
              data: base64Audio,
              mimeType: file.type || 'audio/webm'
            }, controller.signal);

            if (results.length > 0) {
              let sourcePrefix = `來源：語音檔案輸入：${file.name}`;
              await saveResultsToDB(results, sourcePrefix);
              if (onSuccess) onSuccess();
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await processFile;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setValidationError("AI 辨識已超時 (20秒)，請檢查網路連線或稍後再試。");
      } else {
        setValidationError(error.message || "網路連線失敗，請檢查您的網路狀態。");
      }
      console.error("Audio File Processing Error:", error);
    } finally {
      clearTimeout(timeoutId);
      setIsParsing(false);
    }
    // Reset
    e.target.value = "";
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Shared Helper to save results
  const saveResultsToDB = async (results: any[], baseNote: string) => {
    // 取得現有帳戶清單與分類設定，用於名稱配對與屬性判定
    const accountsList = await db.accounts.toArray();
    const categoriesSettingRecord = await db.settings.where("key").equals("categories").first();
    const categoriesList = (categoriesSettingRecord?.value as any[]) || [];

    const receiptGroups: Record<string, any[]> = {};
    results.forEach((res: any) => {
      const key = `${res.date || 'unknown'}_${res.merchant || 'unknown'}_${res.invoice_number || ''}`;
      if (!receiptGroups[key]) receiptGroups[key] = [];
      receiptGroups[key].push(res);
    });

    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      for (const groupItems of Object.values(receiptGroups)) {
        const groupId = groupItems.length > 1 ? (window.crypto?.randomUUID?.() || Date.now().toString()) : undefined;

        for (const res of groupItems) {
          const finalDate = (res.date || new Date().toISOString().split('T')[0]).replace(/-/g, '/');
          const finalAmount = parseFloat(String(res.amount || 0).replace(/[^\d.-]/g, ''));
          const finalItemName = res.item_name || res.itemName || "未指定項目";
          const finalMainCat = res.main_category || res.mainCategory || "飲食";
          const finalSubCat = res.sub_category || res.subCategory || "其他";
          // 確保 sourcePrefix 在第一行，其餘 AI 解析或自訂備註在下一行
          const finalNote = res.note 
            ? `${baseNote}\n${res.note}` 
            : baseNote;

          // 1. 嘗試配對帳戶：若 AI 有解析出帳戶名稱，嘗試與資料庫比對
          const aiAccountName = res.account || res.account_name || "";
          const matchedAccount = aiAccountName 
            ? accountsList.find(a => a.name.includes(aiAccountName) || aiAccountName.includes(a.name)) 
            : null;
          const finalAccountId = matchedAccount ? matchedAccount.id : -1;

          // 2. 智慧狀態判定 (核心邏輯)
          const determineStatus = () => {
            if (finalAccountId === -1) return "pending"; // 缺失必要資訊：帳戶
            if (finalAmount === 0 || isNaN(finalAmount)) return "pending"; // 缺失必要資訊：金額
            
            const placeholders = ["未指定項目", "未辨識品項", "未命名項目", "未指定"];
            if (placeholders.some(p => finalItemName.includes(p))) return "pending"; // 缺失必要資訊：名稱
            
            if (res.confidence_score !== undefined && res.confidence_score < 0.9) return "pending"; // AI 信心度不足
            
            return "completed"; // 資訊齊全，免審核直接入帳
          };

          const status = determineStatus();

          const matchedCat = categoriesList.find((c: any) => c.name === finalMainCat);
          const finalType = matchedCat ? matchedCat.type : (finalMainCat === "收入" || finalMainCat.includes("收入") ? "income" : "expense");
          const finalSignedAmount = finalType === "income" ? Math.abs(finalAmount) : -Math.abs(finalAmount);

          await db.transactions.add({
            date: finalDate,
            type: finalType,
            main_category: finalMainCat,
            sub_category: finalSubCat,
            account_id: finalAccountId === -1 ? undefined : finalAccountId,
            amount: finalSignedAmount,
            item_name: finalItemName,
            merchant: res.merchant || "",
            status: status,
            note: finalNote,
            group_id: groupId,
            invoice_number: res.invoice_number || ""
          });

          // 如果狀態為 completed，同步更新帳戶餘額 (收入為加，支出為扣)
          if (status === "completed" && finalAccountId !== -1) {
            const account = await db.accounts.get(finalAccountId);
            if (account) {
              await db.accounts.update(finalAccountId, {
                current_balance: account.current_balance + finalSignedAmount
              });
            }
          }
        }
      }
    });
  };

  // Image Compression Utility
  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7)); // 0.7 quality for speed/size balance
      };
    });
  };

  // Camera Interaction Logic
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 5 - images.length;
    if (remainingSlots <= 0) {
      alert("最多只能上傳 5 張照片");
      e.target.value = "";
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`最多只能再上傳 ${remainingSlots} 張照片，已為您選取前 ${remainingSlots} 張。`);
    }

    for (const file of filesToProcess) {
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = async () => {
          const rawBase64 = reader.result as string;
          const compressed = await compressImage(rawBase64);
          resolve(compressed);
        };
      });
      reader.readAsDataURL(file);
      const compressedImage = await promise;
      setImages(prev => [...prev, compressedImage]);
    }

    // Reset input
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 overflow-y-auto no-scrollbar flex flex-col bg-bg-base pb-nav-clearance"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex items-center gap-item overflow-hidden">
          <button onClick={onBack} className="p-inner -ml-2 rounded-inner hover:bg-surface-glass-heavy transition-all ease-apple active:opacity-active duration-fast shrink-0">
            <ChevronLeft className="size-icon-lg text-brand-primary" />
          </button>
          <h1 className="text-h3 font-h3 tracking-tight text-text-primary leading-tight">
            新增交易
          </h1>
        </div>
        <div className={`ml-auto px-item py-micro.5 rounded-button text-caption font-caption uppercase tracking-wide flex items-center gap-inner backdrop-blur-md border ${hasApiKey
          ? "bg-brand-secondary/10 text-brand-secondary border-border-subtle"
          : "bg-surface-glass text-text-secondary border-border-subtle"
          }`}>
          <div className={`w-1.5 h-1.5 rounded-button ${hasApiKey ? "bg-brand-secondary animate-pulse" : "bg-text-tertiary opacity-50"}`} />
          {hasApiKey ? "Gemini AI" : "模擬模式"}
        </div>
      </header>

      <div className="flex flex-col gap-section px-screen py-section">
        {/* NLP Input Box */}
        <div className="bg-surface-primary w-full p-section flex flex-col gap-item relative overflow-hidden border border-hairline border-border-subtle rounded-card group">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isParsing}
            placeholder="今天花了什麼？例如：中午吃麥當勞 180 元"
            className="flex-1 bg-transparent border-none outline-none text-h2 font-body text-text-primary placeholder:text-text-tertiary resize-none no-scrollbar disabled:opacity-disabled min-h-[160px] leading-tight"
          />

          {validationError && (
            <div className="flex items-start gap-inner text-semantic-danger bg-semantic-danger/10 p-inner rounded-button border border-semantic-danger/20 mb-2 mt-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-icon-sm shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span className="text-caption font-caption leading-tight">{validationError}</span>
            </div>
          )}

          {/* Action Buttons inside Input Box */}
          <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
            {/* 左側：相機與麥克風 */}
            <div className="flex items-center gap-4">
              <input type="file" accept="image/*" multiple className="hidden" ref={imageInputRef} onChange={handleCapture} />
              <input type="file" accept="audio/*" capture={"microphone" as any} className="hidden" ref={audioInputRef} onChange={handleAudioFile} />
              
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-12 h-12 shrink-0 rounded-button bg-surface-glass flex items-center justify-center text-text-secondary active:bg-brand-primary/20 active:text-brand-primary active:opacity-active transition-all duration-fast ease-apple border border-border-subtle"
              >
                <Camera className="size-icon-md" />
              </button>
              
              <button
                onClick={toggleRecording}
                className={`w-12 h-12 shrink-0 rounded-button flex items-center justify-center transition-all duration-fast ease-apple border ${
                  isRecording
                    ? "bg-semantic-danger/20 text-semantic-danger border-semantic-danger/30 animate-pulse"
                    : "bg-surface-glass text-text-secondary active:bg-brand-primary/20 active:text-brand-primary active:opacity-active border-border-subtle"
                }`}
              >
                {isRecording ? <MicOff className="size-icon-md" /> : <Mic className="size-icon-md" />}
              </button>
            </div>

            {/* 右側：發送按鈕 */}
            <button
              onClick={handleSend}
              disabled={isParsing || (!inputText && images.length === 0)}
              className={`w-12 h-12 shrink-0 rounded-button flex items-center justify-center transition-all duration-fast ${
                inputText || images.length > 0
                  ? "bg-brand-primary text-bg-base shadow-lg shadow-brand-primary/20 active:scale-95 active:opacity-active ease-apple"
                  : "bg-surface-glass text-text-tertiary border border-border-subtle"
              } ${isParsing ? "opacity-disabled" : ""}`}
            >
              {isParsing ? (
                <Loader2 className="size-icon-md animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-icon-md">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Image Preview Area */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-item overflow-x-auto no-scrollbar pb-2 px-micro"
            >
              {images.map((img, idx) => (
                <div key={idx} className="relative shrink-0">
                  <div className="w-20 h-20 rounded-inner bg-surface-primary overflow-hidden shadow-lg border border-border-subtle">
                    <img src={img} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 size-icon-lg rounded-button bg-semantic-danger text-text-primary flex items-center justify-center shadow-xl border border-bg-base"
                  >
                    <X className="size-icon-sm" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-caption font-caption text-text-tertiary px-item leading-relaxed uppercase tracking-wide">
          提示：您可以直接輸入文字，或上傳最多 5 張發票照片，AI 將自動辨識明細。
        </p>
      </div>


      {/* Recording Overlay */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-section bg-bg-base/95 backdrop-blur-heavy rounded-card"
          >
            <div className="flex-1 flex flex-col items-center justify-center gap-12 px-section py-section text-text-primary">
              <div className="relative flex items-center justify-center">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 2],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6,
                      ease: "easeOut",
                    }}
                    className="absolute w-32 h-32 rounded-button border-2 border-bg-base/20"
                  />
                ))}
                <div className="w-32 h-32 rounded-button bg-bg-base flex items-center justify-center border-4 border-surface-glass">
                  <Mic className="size-icon-container text-[3rem] text-brand-primary" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <h2 className="text-h2 font-h2 tracking-tight italic uppercase text-bg-base/90 leading-tight">正在聆聽...</h2>
                <div className="flex items-center justify-center gap-item font-mono text-h2 tracking-wide text-bg-base/40 leading-none">
                  <div className="w-2 h-2 rounded-button bg-semantic-danger animate-pulse" />
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </div>
              </div>

              <p className="text-caption font-caption text-text-tertiary max-w-[240px] text-center uppercase tracking-wide leading-normal">
                您可以說：<br />「中午吃排骨便當 120 元」
              </p>
            </div>

            <button
              onClick={stopRecording}
              className="w-full max-w-xs bg-bg-base text-brand-primary py-section rounded-button text-h3 font-h3 active:scale-95 transition-all ease-apple mb-12 border border-border-subtle"
            >
              完成錄音
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
