import { useRef, useState, useEffect } from "react";
import { Bell, Palette, Shield, HelpCircle, LogOut, Tag, Download, Upload, AlertTriangle, Check, ChevronRight, Loader2, Sparkles, Key, Save, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { AnimatePresence, motion } from "framer-motion";
import CategoryManagementView from "./CategoryManagementView";
import { exportDatabaseToJSON, importDatabaseFromJSON, clearAllData } from "@/db/db";

export default function SettingsView() {
  const [showCategories, setShowCategories] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  // AI Key State
  const geminiKeySetting = useLiveQuery(() => 
    db.settings.where("key").equals("gemini_api_key").first()
  );
  const [apiKey, setApiKey] = useState("");
  const [isEditingKey, setIsEditingKey] = useState(false);

  useEffect(() => {
    if (geminiKeySetting) {
      setApiKey(geminiKeySetting.value);
    }
  }, [geminiKeySetting]);

  const saveApiKey = async () => {
    const existing = await db.settings.where("key").equals("gemini_api_key").first();
    if (existing) {
      await db.settings.update(existing.id!, { value: apiKey });
    } else {
      await db.settings.add({ key: "gemini_api_key", value: apiKey });
    }
    setIsEditingKey(false);
    setLastAction("API Key 已儲存");
    setTimeout(() => setLastAction(null), 3000);
  };

  const handleExport = async (type: "json" | "csv") => {
    if (type === "csv") {
      setLastAction("CSV 匯出尚未實作");
      setTimeout(() => setLastAction(null), 3000);
      return;
    }

    try {
      setIsProcessing(true);
      await exportDatabaseToJSON();
      setLastAction(`已匯出 JSON 備份`);
    } catch (error) {
      console.error("Export failed:", error);
      setLastAction("匯出失敗");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setLastAction(null), 3000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setShowBackupConfirm(true);
    }
    // Reset input value so same file can be selected again
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!pendingFile) return;

    try {
      setIsProcessing(true);
      setShowBackupConfirm(false);
      await importDatabaseFromJSON(pendingFile);
      setLastAction("資料已還原");
      // Force reload to refresh all live queries
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Import failed:", error);
      setLastAction("還原失敗：格式錯誤");
    } finally {
      setIsProcessing(false);
      setPendingFile(null);
      setTimeout(() => setLastAction(null), 3000);
    }
  };

  const confirmReset = async () => {
    try {
      setIsProcessing(true);
      setShowResetConfirm(false);
      await clearAllData();
      setLastAction("資料已全數清空");
      // Force reload to refresh all states
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Reset failed:", error);
      setLastAction("清空失敗");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setLastAction(null), 3000);
    }
  };

  interface SettingItem {
    icon: React.ReactNode;
    label: string;
    value?: string;
    isToggle?: boolean;
    active?: boolean;
    onClick?: () => void;
  }

  interface SettingGroup {
    title: string;
    items: SettingItem[];
  }

  const settingGroups: SettingGroup[] = [
    {
      title: "分類管理",
      items: [
        { 
          icon: <Tag className="size-icon-md" />, 
          label: "主/次分類管理", 
          value: "已設定", 
          isToggle: false,
          onClick: () => setShowCategories(true) 
        },
      ]
    },
    {
      title: "數據管理",
      items: [
        { 
          icon: <Download className="size-icon-md" />, 
          label: "匯出備份 (JSON)", 
          onClick: () => handleExport("json")
        },
        { 
          icon: <Download className="size-icon-md" />, 
          label: "匯出明細 (CSV)", 
          onClick: () => handleExport("csv")
        },
        { 
          icon: isProcessing ? <Loader2 className="size-icon-md animate-spin" /> : <Upload className="size-icon-md" />, 
          label: "從檔案還原", 
          onClick: handleImportClick
        },
      ]
    },
    {
      title: "AI 引擎設定",
      items: [] // Custom rendered below
    },
    {
      title: "危險區域",
      items: [
        {
          icon: <AlertTriangle className="size-icon-md text-semantic-danger" />,
          label: "清除全部資料",
          onClick: () => setShowResetConfirm(true)
        }
      ]
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base pb-nav-clearance animate-in fade-in duration-normal">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />

      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex flex-col items-start justify-center">
          <h1 className="text-h3 font-h3 text-text-primary leading-tight">設定</h1>
        </div>
        <div className="flex items-center gap-item">
          <AnimatePresence>
            {lastAction && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-brand-primary text-bg-base px-section py-inner rounded-button font-h3 shadow-xl shadow-brand-primary/20 flex items-center gap-inner ease-spring"
              >
                <Check className="size-icon-sm" strokeWidth={3} />
                {lastAction}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex flex-col gap-section px-screen">
        {settingGroups.map((group, idx) => (
          <section key={idx} className="flex flex-col gap-item">
             <h3 className="text-caption font-caption text-text-tertiary px-inner uppercase tracking-wide">{group.title}</h3>
             <div className="bg-surface-primary rounded-card overflow-hidden divide-y-hairline divide-border-subtle border border-hairline border-border-subtle">
                {group.title === "AI 引擎設定" ? (
                  <div className="p-section flex flex-col gap-item">
                     <div className="flex items-center justify-between mb-inner">
                       <div className="flex items-center gap-item">
                          <div className="size-icon-container text-h1 rounded-inner bg-bg-base flex items-center justify-center border border-surface-glass-heavy text-brand-primary shrink-0 shadow-inner">
                             <Sparkles className="size-icon-md" />
                          </div>
                          <span className="font-body text-body text-text-primary leading-normal">Gemini API Key</span>
                       </div>
                      <button 
                        onClick={() => setIsEditingKey(!isEditingKey)}
                        className="text-text-tertiary hover:text-text-primary transition-colors p-item active:scale-90 active:opacity-active duration-fast ease-apple"
                      >
                        {isEditingKey ? <X className="size-icon-md" /> : <ChevronRight className="size-icon-md" />}
                      </button>
                    </div>

                    <div className="relative">
                      <input 
                        type={isEditingKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="請輸入 Gemini API Key..."
                        disabled={!isEditingKey}
                        className={`w-full bg-bg-base border ${isEditingKey ? 'border-brand-primary/50' : 'border-surface-glass-heavy'} rounded-input px-section py-section text-body font-mono text-text-primary outline-none transition-all placeholder:text-text-tertiary/20 leading-normal`}
                      />
                      {isEditingKey && (
                        <button 
                          onClick={saveApiKey}
                          disabled={!apiKey.trim() || isProcessing}
                          className="absolute right-2 top-2 bottom-2 px-section bg-brand-primary text-bg-base rounded-button font-h3 shadow-xl shadow-brand-primary/20 active:scale-95 active:opacity-active transition-all duration-fast ease-apple disabled:opacity-disabled"
                        >
                          <Save className="size-icon-md" /> 儲存
                        </button>
                      )}
                    </div>
                    
                    <p className="text-caption font-caption text-text-tertiary leading-relaxed px-micro tracking-wide">
                      此 Key 僅儲存於您目前的瀏覽器中，不會上傳至伺服器。您可以前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-brand-primary underline">Google AI Studio</a> 免費申請。
                    </p>
                  </div>
                ) : (
                  group.items.map((item, itemIdx) => (
                     <button 
                       key={itemIdx} 
                       onClick={item.onClick}
                       disabled={isProcessing && item.label !== "主/次分類管理"}
                       className="flex items-center justify-between px-section py-item active:bg-surface-glass transition-colors ease-apple group text-left w-full"
                     >
                       <div className="flex items-center gap-item text-text-primary overflow-hidden">
                         <div className="size-icon-md flex items-center justify-center text-brand-primary bg-bg-base rounded-button shadow-inner shrink-0">
                           {item.icon}
                         </div>
                         <span className="font-body text-body tracking-tight leading-normal">{item.label}</span>
                       </div>
                      
                      <div className="flex items-center gap-inner">
                        {item.value && <span className="text-text-tertiary font-h3 text-body leading-normal">{item.value}</span>}
                        {item.onClick && <ChevronRight className="size-icon-md text-text-tertiary group-hover:text-text-primary transition-colors" />}
                      </div>
                    </button>
                  ))
                )}
             </div>
          </section>
        ))}

        <div className="px-section py-section flex flex-col items-center gap-inner border-t border-surface-glass-heavy/50">
          <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide leading-normal">資料僅儲存在此裝置中</p>
        </div>
      </div>

      {/* Sub-Views Overlay */}
      <AnimatePresence>
        {showCategories && (
          <CategoryManagementView onBack={() => setShowCategories(false)} />
        )}
      </AnimatePresence>

      {/* Backup Restoration Modal */}
      <AnimatePresence>
        {showBackupConfirm && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-section bg-bg-base/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-primary border border-border-subtle w-full max-w-sm p-section flex flex-col items-center gap-section text-center rounded-card shadow-dropdown ease-spring"
            >
              <div className="size-avatar-lg rounded-button bg-semantic-danger/20 flex items-center justify-center border border-semantic-danger/30">
                <AlertTriangle className="size-icon-container text-h1 text-semantic-danger" />
              </div>
              <div className="flex flex-col gap-inner">
                <h3 className="text-h2 font-h2 tracking-tight mb-1 text-text-primary leading-tight">確定要還原嗎？</h3>
                <p className="text-text-tertiary text-body leading-relaxed px-inner">
                  還原操作將會<span className="text-semantic-danger font-h3">永久刪除</span>目前所有的帳務資料，並以備份檔內容取代。此操作無法復原。
                </p>
              </div>
              <div className="flex flex-col w-full gap-item pt-2">
                <button 
                  onClick={confirmImport}
                  disabled={isProcessing}
                   className="w-full py-item rounded-button bg-semantic-danger text-text-primary font-h3 shadow-xl shadow-semantic-danger/20 active:scale-95 active:opacity-active transition-all duration-fast ease-apple disabled:opacity-disabled"
                >
                  確認還原 (覆蓋)
                </button>
                <button 
                  onClick={() => setShowBackupConfirm(false)}
                   className="w-full py-item rounded-button bg-surface-glass text-text-tertiary font-body active:bg-surface-glass-heavy active:scale-95 transition-all ease-apple border border-surface-glass-heavy"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Factory Reset Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-section bg-bg-base/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-primary border border-semantic-danger/30 w-full max-w-sm p-section flex flex-col items-center gap-section text-center rounded-card shadow-dropdown shadow-semantic-danger/10 ease-spring"
            >
              <div className="size-avatar-lg rounded-button bg-semantic-danger/20 flex items-center justify-center border border-semantic-danger/30 animate-pulse">
                <AlertTriangle className="size-icon-container text-h1 text-semantic-danger" />
              </div>
              <div className="flex flex-col gap-inner">
                <h3 className="text-h2 font-h2 tracking-tight text-semantic-danger leading-tight uppercase tracking-tight">絕對確定嗎？</h3>
                <p className="text-text-tertiary text-body leading-relaxed px-inner">
                  這將會<span className="text-semantic-danger font-h3 underline">永久刪除</span>您在此裝置上的所有帳務紀錄、帳戶設定、分類偏好及 API Key。系統將恢復至初始狀態。
                </p>
              </div>
              <div className="flex flex-col w-full gap-item pt-2">
                <button 
                  onClick={confirmReset}
                  disabled={isProcessing}
                   className="w-full py-item rounded-button bg-semantic-danger text-text-primary font-h3 shadow-xl shadow-semantic-danger/30 active:scale-95 active:opacity-active transition-all duration-fast ease-apple disabled:opacity-disabled"
                >
                  確認全部清除
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                   className="w-full py-item rounded-button bg-surface-glass text-text-tertiary font-body active:bg-surface-glass-heavy active:scale-95 transition-all ease-apple border border-surface-glass-heavy"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
