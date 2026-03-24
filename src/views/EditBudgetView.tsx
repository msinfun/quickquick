import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, Save, Plus, Minus, Box } from "lucide-react";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { ICON_MAP } from "@/constants/icons";

interface CategoryBudget {
  category: string;
  budget: number;
  iconName: string;
}

interface EditBudgetViewProps {
  onBack: () => void;
  onSave: () => void;
}

export default function EditBudgetView({ onBack, onSave }: EditBudgetViewProps) {
  const budgetSettingsSetting = useLiveQuery(() => 
    db.settings.where("key").equals("budget_settings").first()
  );
  const categoriesSetting = useLiveQuery(() => 
    db.settings.where("key").equals("categories").first()
  );

  const initialBudgets = useMemo(() => {
    const categories = (categoriesSetting?.value as any[]) || [];
    const settings = (budgetSettingsSetting?.value as Record<string, number>) || {};
    
    return categories.map(cat => ({
      category: cat.name,
      budget: settings[cat.name] || 0,
      iconName: cat.iconName || "Box"
    }));
  }, [budgetSettingsSetting, categoriesSetting]);

  const [localBudgets, setLocalBudgets] = useState<CategoryBudget[]>([]);

  // Update local state when DB loads
  useEffect(() => {
    if (initialBudgets.length > 0 && localBudgets.length === 0) {
      setLocalBudgets(initialBudgets);
    }
  }, [initialBudgets, localBudgets.length]);

  const totalBudget = useMemo(() => localBudgets.reduce((acc, b) => acc + b.budget, 0), [localBudgets]);

  const handleBudgetChange = (category: string, value: string) => {
    const rawValue = value.replace(/\D/g, "");
    const num = rawValue === "" ? 0 : parseInt(rawValue);
    setLocalBudgets(prev => prev.map(b => b.category === category ? { ...b, budget: num } : b));
  };

  const handleSave = async () => {
    const newSettings: Record<string, number> = {};
    localBudgets.forEach(b => {
      newSettings[b.category] = b.budget;
    });
    
    await db.settings.where("key").equals("budget_settings").modify({ value: newSettings });
    onSave();
  };

  const handleResetAll = () => {
    setLocalBudgets(prev => prev.map(b => ({ ...b, budget: 0 })));
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex items-center gap-item overflow-hidden">
          <button onClick={onBack} className="p-inner -ml-2 rounded-inner hover:bg-surface-glass-heavy transition-all ease-apple shrink-0 active:opacity-active">
            <ChevronLeft className="size-icon-lg text-brand-primary" />
          </button>
          <h1 className="text-h3 font-h3 tracking-tight text-text-primary whitespace-nowrap leading-tight">編輯預算</h1>
        </div>
        <button onClick={handleSave} className="px-section py-inner rounded-inner bg-brand-primary text-bg-base font-h3 active:scale-95 transition-all ease-apple">
          儲存
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base px-screen pb-nav-clearance py-section">
        {/* Total Summary Header */}
        <div className="mb-10 text-center py-section">
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-3 block">預算總額加總</span>
          <h2 className="text-h2 font-h2 tracking-tight tabular-nums text-text-primary">
            $ {totalBudget.toLocaleString()}
          </h2>
          <button 
            onClick={handleResetAll}
            className="mt-4 px-item py-micro rounded-button bg-surface-glass text-text-tertiary text-caption font-caption active:bg-surface-glass-heavy transition-all ease-apple border border-border-subtle"
          >
            全部歸零
          </button>
        </div>

        <div className="flex flex-col gap-section">
          {localBudgets.map((b) => (
            <div key={b.category} className="flex flex-col gap-item group">
              <div className="flex items-center justify-between px-inner">
                <div className="flex items-center gap-item">
                  <div className="text-brand-primary">
                    {(() => {
                      const Icon = ICON_MAP[b.iconName] || Box;
                      return <Icon className="size-icon-md" />;
                    })()}
                  </div>
                  <label className="text-caption font-caption text-text-tertiary uppercase tracking-wide">{b.category} 預算</label>
                </div>
                <div className="flex items-center gap-item">
                    <button 
                      onClick={() => handleBudgetChange(b.category, Math.max(0, b.budget - 500).toString())}
                      className="size-icon-container text-h1 rounded-inner bg-surface-glass flex items-center justify-center text-text-tertiary active:bg-surface-glass-heavy transition-all ease-apple border border-border-subtle"
                    >
                      <Minus className="size-icon-md" />
                    </button>
                    <button 
                      onClick={() => handleBudgetChange(b.category, (b.budget + 500).toString())}
                      className="size-icon-container text-h1 rounded-inner bg-surface-glass flex items-center justify-center text-brand-primary active:bg-brand-primary/10 transition-all ease-apple border border-border-subtle"
                    >
                      <Plus className="size-icon-md" />
                    </button>
                </div>
              </div>
              
              <div className="relative flex items-center bg-bg-base border border-hairline border-border-subtle rounded-input p-item focus-within:border-brand-primary/30 transition-all shadow-inner">
                <span className="text-brand-primary font-h3 text-body mr-2 leading-none">$</span>
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={b.budget === 0 ? "" : b.budget.toString()}
                  onChange={(e) => handleBudgetChange(b.category, e.target.value)}
                  className="bg-transparent border-none outline-none text-body font-body text-text-primary w-full placeholder:text-text-tertiary/20 tabular-nums leading-none"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
