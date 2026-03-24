import { useState, useMemo } from "react";
import { ChevronLeft, Edit3, PieChart, Box } from "lucide-react";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { ICON_MAP } from "@/constants/icons";

interface CategoryBudget {
  category: string;
  budget: number;
  spent: number;
}

interface BudgetViewProps {
  onBack: () => void;
  onEdit: () => void;
}

export default function BudgetView({ onBack, onEdit }: BudgetViewProps) {
  // Mock data for budgets
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const budgetSettingsSetting = useLiveQuery(() => 
    db.settings.where("key").equals("budget_settings").first()
  );
  const budgetSettings = (budgetSettingsSetting?.value as Record<string, number>) || {};

  const currentMonth = new Date();
  const monthStr = `${currentMonth.getFullYear()}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const budgets = useMemo(() => {
    return Object.entries(budgetSettings).map(([category, budget]) => {
      const spent = allTransactions
        .filter(t => t.date.startsWith(monthStr) && t.main_category === category && t.type === 'expense')
        .reduce((acc: number, t: any) => acc + Math.abs(t.amount), 0);
      
      return { category, budget, spent };
    });
  }, [budgetSettings, allTransactions, monthStr]);

  const totalBudget = useMemo(() => budgets.reduce((acc: number, b: any) => acc + b.budget, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((acc: number, b: any) => acc + b.spent, 0), [budgets]);
  const totalPercent = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

  // Lift the categories query to the top level
  const categoriesSetting = useLiveQuery(() => db.settings.where("key").equals("categories").first());
  const categories = (categoriesSetting?.value as any[]) || [];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex items-center gap-item">
          <button onClick={onBack} className="p-inner -ml-2 rounded-inner hover:bg-surface-glass transition-all ease-apple">
            <ChevronLeft className="size-icon-lg text-brand-primary" />
          </button>
          <h1 className="text-h3 font-h3 tracking-tight text-text-primary leading-tight">預算概覽</h1>
        </div>
        <button onClick={onEdit} className="p-inner rounded-inner bg-surface-glass active:bg-surface-glass-heavy text-brand-primary transition-all ease-apple border border-hairline border-border-subtle">
          <Edit3 className="size-icon-md" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base px-screen pb-nav-clearance">
        {/* Total Progress Card */}
        <div className="bg-surface-primary w-full p-section rounded-card relative overflow-hidden group border border-hairline border-border-subtle mt-section">

          <div className="flex justify-between items-end mb-item relative z-10">
            <div>
              <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide">總預算執行率</p>
              <h2 className="text-h2 font-h2 tracking-tight tabular-nums text-text-primary mt-1 leading-none">
                {totalPercent}%
              </h2>
            </div>
            <PieChart className="size-icon-container text-[3rem] text-brand-primary opacity-50 mb-1" />
          </div>
          
          <div className="w-full h-4 bg-bg-base rounded-button overflow-hidden mb-section relative z-10">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${totalPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-button ${totalPercent > 90 ? 'bg-semantic-danger' : 'bg-brand-primary'}`}
            />
          </div>

          <div className="flex justify-between text-body font-body tracking-tight relative z-10 leading-normal">
            <div className="flex flex-col">
              <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-0.5">已支出</span>
              <span className="text-brand-primary font-h3 text-h3 tabular-nums">${totalSpent.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-0.5">總額度</span>
              <span className="text-text-secondary font-h3 text-h3 tabular-nums">${totalBudget.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="flex justify-between items-center mb-item px-inner">
          <h3 className="text-caption font-caption text-text-tertiary uppercase tracking-wide">各類別進度</h3>
        </div>
        <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle overflow-hidden divide-y-hairline divide-border-subtle">
          {budgets.map((b: any) => {
            const percent = Math.min(Math.round((b.spent / b.budget) * 100), 100);
            const catInfo = categories.find(c => c.name === b.category);
            const Icon = ICON_MAP[catInfo?.iconName || "Box"] || Box;

            return (
              <div key={b.category} className="px-section py-item flex items-center justify-between group">
                <div className="flex items-center gap-item flex-1 overflow-hidden">
                  <div className="size-icon-md flex items-center justify-center text-brand-primary bg-bg-base rounded-button shadow-inner shrink-0 group-active:scale-95 transition-transform">
                    <Icon className="size-icon-sm" />
                  </div>
                  <div className="flex flex-col flex-1 truncate">
                    <div className="flex justify-between items-end mb-1.5 pr-2">
                      <span className="font-body text-body text-text-primary truncate leading-normal">{b.category}</span>
                      <span className="text-[10px] font-caption text-text-tertiary uppercase tracking-wide">{percent}%</span>
                    </div>
                    <div className="w-full h-1 bg-bg-base rounded-button overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        className={`h-full rounded-button ${percent > 90 ? 'bg-semantic-danger/60' : 'bg-brand-primary/40'}`}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-micro ml-6 shrink-0">
                  <span className="text-body font-h3 text-text-primary tabular-nums tracking-tight leading-normal">${b.spent.toLocaleString()}</span>
                  <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">/ ${b.budget.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
