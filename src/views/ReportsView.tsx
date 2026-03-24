import { useState, useMemo } from "react";
import { 
  ArrowRightLeft, ArrowLeft, ChevronDown, ListOrdered, ChevronRight,
  TrendingUp, TrendingDown, X, Trash2, Copy, Edit2, Database, Calendar, Box, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { ICON_MAP } from "@/constants/icons";

interface Transaction {
  id?: number;
  date: string;
  type: "expense" | "income" | "transfer";
  main_category: string;
  sub_category: string;
  amount: number;
  account_id: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "飲食": "#f59e0b",
  "交通": "#3b82f6",
  "購物": "#ec4899",
  "娛樂": "#8b5cf6",
  "家居": "#10b981",
  "醫療": "#ef4444",
  "學習": "#34d399",
  "其它": "#64748b",
  "收入": "#10b981",
  "轉帳": "#6366f1"
};

// Helper to get week range text
const getWeekRange = (date: Date) => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
};

export default function ReportsView() {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"expense" | "income">("expense");

  // Real data from IndexedDB
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      // DB date format is YYYY/MM/DD
      const txDate = new Date(tx.date.replace(/\//g, '-'));
      if (timeRange === "year") {
        return txDate.getFullYear() === currentDate.getFullYear();
      }
      if (timeRange === "month") {
        return txDate.getMonth() === currentDate.getMonth() && txDate.getFullYear() === currentDate.getFullYear();
      }
      if (timeRange === "week") {
        const start = new Date(currentDate);
        start.setDate(currentDate.getDate() - currentDate.getDay());
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23,59,59,999);
        return txDate >= start && txDate <= end;
      }
      return true;
    });
  }, [currentDate, timeRange, allTransactions]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const expenseMap: Record<string, { amount: number, sub: Record<string, number> }> = {};
    const incomeMap: Record<string, { amount: number, sub: Record<string, number> }> = {};

    filteredTransactions.forEach(tx => {
      const amt = Math.abs(tx.amount);
      if (tx.type === "income") {
        income += amt;
        if (!incomeMap[tx.main_category]) incomeMap[tx.main_category] = { amount: 0, sub: {} };
        incomeMap[tx.main_category].amount += amt;
        incomeMap[tx.main_category].sub[tx.sub_category] = (incomeMap[tx.main_category].sub[tx.sub_category] || 0) + amt;
      } else if (tx.type === "expense") {
        expense += amt;
        if (!expenseMap[tx.main_category]) expenseMap[tx.main_category] = { amount: 0, sub: {} };
        expenseMap[tx.main_category].amount += amt;
        expenseMap[tx.main_category].sub[tx.sub_category] = (expenseMap[tx.main_category].sub[tx.sub_category] || 0) + amt;
      }
    });

    const activeMap = reportType === "expense" ? expenseMap : incomeMap;
    const totalForType = reportType === "expense" ? expense : income;

    const categories = Object.entries(activeMap).map(([name, val]) => ({
      name,
      amount: val.amount,
      percentage: totalForType > 0 ? (val.amount / totalForType) * 100 : 0,
      sub: Object.entries(val.sub).map(([sName, sAmt]) => ({
        name: sName,
        amount: sAmt,
        percentage: val.amount > 0 ? (sAmt / val.amount) * 100 : 0
      })).sort((a,b) => b.amount - a.amount)
    })).sort((a,b) => b.amount - a.amount);

    return { income, expense, total: income - expense, categories };
  }, [filteredTransactions, reportType]);

  const changeDate = (offset: number) => {
    const next = new Date(currentDate);
    if (timeRange === "year") next.setFullYear(currentDate.getFullYear() + offset);
    else if (timeRange === "month") next.setMonth(currentDate.getMonth() + offset);
    else if (timeRange === "week") next.setDate(currentDate.getDate() + (offset * 7));
    setCurrentDate(next);
    setDrillDownCategory(null);
  };

  const renderIcon = (name: string, className: string = "size-icon-md") => {
    const IconComponent = ICON_MAP[name] || ICON_MAP["Tag"];
    return <IconComponent className={className} />;
  };

  const currentCategoryData = useMemo(() => {
    if (!drillDownCategory) return null;
    return stats.categories.find(c => c.name === drillDownCategory);
  }, [drillDownCategory, stats]);

  return (
    <div className="relative w-full h-full text-text-primary flex flex-col overflow-hidden bg-bg-base">
      {/* Background Glows: Simplified for seamless look */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-base">

      </div>

      {/* Persistent Header: Shrunk for space */}
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex flex-col items-start justify-center">
          <h1 className="text-h3 font-h3 text-text-primary leading-tight">分析報表</h1>
        </div>

        <div className="flex items-center gap-inner">
          {/* Date Switcher */}
          <div className="flex bg-surface-glass p-0.5 rounded-button border border-hairline border-border-subtle scale-90 origin-right transition-all duration-normal ease-apple">
            <button onClick={() => changeDate(-1)} className="px-inner py-micro rounded-inner hover:bg-brand-primary active:scale-95 transition-all duration-normal text-text-tertiary hover:text-bg-base">
              <ChevronLeft className="size-icon-sm" />
            </button>
            <button onClick={() => changeDate(1)} className="px-inner py-micro rounded-inner hover:bg-brand-primary active:scale-95 transition-all duration-normal text-text-tertiary hover:text-bg-base">
              <ChevronRight className="size-icon-sm" />
            </button>
          </div>

          <div className="flex bg-surface-glass p-0.5 rounded-button border border-hairline border-border-subtle scale-90 origin-right transition-all duration-normal ease-apple">
            {(["week", "month", "year"] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-item py-micro rounded-inner text-caption font-h3 uppercase tracking-wide transition-all ease-apple ${
                  timeRange === range ? "bg-brand-primary text-bg-base shadow-sm" : "text-text-tertiary"
                }`}
              >
                {range === "week" ? "週" : range === "month" ? "月" : "年"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base pb-nav-clearance">
        {/* Overview Row: Minimalist */}
        <div className="px-screen pt-2">
          <div className="grid grid-cols-3 gap-inner">
            <button 
              onClick={() => { setReportType("income"); setDrillDownCategory(null); }}
              className={`rounded-card p-item flex flex-col items-center border transition-all duration-normal ease-apple active:opacity-active ${
                reportType === "income" 
                ? 'bg-brand-primary/20 border-brand-primary/40' 
                : 'bg-surface-primary border-hairline border-border-subtle opacity-60'
              }`}
            >
              <span className="text-caption font-caption text-brand-primary uppercase tracking-wide mb-0.5">收入</span>
              <span className="text-h3 font-h3 tabular-nums tracking-tighter text-text-primary leading-none">
                ${stats.income.toLocaleString()}
              </span>
            </button>
            <button 
              onClick={() => { setReportType("expense"); setDrillDownCategory(null); }}
              className={`rounded-card p-item flex flex-col items-center border transition-all duration-normal ease-apple active:opacity-active ${
                reportType === "expense" 
                ? 'bg-semantic-danger/20 border-semantic-danger/40' 
                : 'bg-surface-primary border-hairline border-border-subtle opacity-60'
              }`}
            >
              <span className="text-caption font-caption text-semantic-danger uppercase tracking-widest mb-0.5">支出</span>
              <span className="text-h3 font-h3 tabular-nums tracking-tighter text-text-primary leading-none">
                ${stats.expense.toLocaleString()}
              </span>
            </button>
            <div className="rounded-card p-item flex flex-col items-center bg-surface-primary border border-hairline border-border-subtle">
              <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-0.5">小計</span>
              <span className={`text-h3 font-h3 tabular-nums tracking-tighter leading-none ${stats.total >= 0 ? 'text-brand-primary' : 'text-semantic-danger'}`}>
                {stats.total >= 0 ? '+' : '-'}${Math.abs(stats.total).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!drillDownCategory ? (
            <motion.div 
              key={`${reportType}-main`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-section px-screen"
            >
              {/* Donut Chart: Scaled Down */}
              <div className="bg-surface-primary rounded-card p-section flex items-center justify-center relative overflow-hidden h-44 border border-hairline border-border-subtle">

                 <div className="relative w-32 h-32 flex items-center justify-center text-center z-10">
                    <svg className="w-full h-full transform -rotate-90">
                      {stats.categories.length === 0 ? (
                        <circle cx="64" cy="64" r="54" stroke="var(--color-surface-glass-heavy)" strokeWidth="12" fill="transparent" />
                      ) : (
                        stats.categories.map((cat, idx) => {
                          let offset = 0;
                          for (let i = 0; i < idx; i++) offset += stats.categories[i].percentage;
                          const circumference = 2 * Math.PI * 54;
                          const dashArray = `${(cat.percentage * circumference) / 100} ${circumference}`;
                          const dashOffset = `-${(offset * circumference) / 100}`;
                          return (
                            <circle
                              key={cat.name}
                              cx="64"
                              cy="64"
                              r="54"
                              stroke={CATEGORY_COLORS[cat.name] || (reportType === "income" ? "#10b981" : "#64748b")}
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={dashArray}
                              strokeDashoffset={dashOffset}
                              className="transition-all duration-normal"
                              strokeLinecap="round"
                            />
                          );
                        })
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-0.5">
                        {reportType === "expense" ? "總支出" : "總收入"}
                      </span>
                      <span className={`text-h2 font-h2 tabular-nums tracking-tight leading-none ${reportType === "income" ? 'text-brand-primary' : 'text-text-primary'}`}>
                        ${(reportType === "expense" ? stats.expense : stats.income).toLocaleString()}
                      </span>
                    </div>
                 </div>
              </div>

              {/* List: Tighter Items */}
              <div className="flex flex-col gap-item">
                <div className="flex justify-between px-inner">
                  <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">
                    {reportType === "expense" ? "支出分類分析" : "收入分類分析"}
                  </span>
                </div>
                
                <div className="bg-surface-primary rounded-card overflow-hidden divide-y-hairline divide-border-subtle shadow-xl border border-hairline border-border-subtle">
                  {stats.categories.map((cat) => (
                    <button 
                      key={cat.name}
                      onClick={() => setDrillDownCategory(cat.name)}
                      className="w-full px-section py-item flex items-center justify-between active:bg-surface-glass transition-colors ease-apple group"
                    >
                      <div className="flex items-center gap-item flex-1 overflow-hidden">
                        <div className="size-icon-md rounded-button bg-bg-base/40 border border-hairline border-border-subtle flex items-center justify-center text-brand-primary shrink-0 transition-transform group-hover:scale-110">
                          {renderIcon(
                            cat.name === "飲食" ? "Utensils" : 
                            cat.name === "交通" ? "Car" : 
                            cat.name === "購物" ? "ShoppingBag" : 
                            cat.name === "娛樂" ? "Gamepad2" : 
                            cat.name === "家居" ? "Home" : 
                            cat.name === "收入" ? "TrendingUp" : "Tag", 
                            "size-icon-sm"
                          )}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 pr-1">
                            <span className="font-body text-body text-text-primary leading-normal truncate">{cat.name}</span>
                            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide tabular-nums">{Math.round(cat.percentage)}%</span>
                          </div>
                          <div className="w-full h-1 bg-bg-base rounded-button overflow-hidden border border-hairline border-surface-glass-heavy/30">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${cat.percentage}%` }}
                              className="h-full rounded-button"
                              style={{ backgroundColor: CATEGORY_COLORS[cat.name] || "#64748b" }}
                            ></motion.div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-inner ml-4">
                        <span className={`font-h2 text-h3 tabular-nums tracking-tighter leading-none ${reportType === "income" ? "text-brand-primary" : "text-text-primary"}`}>
                          ${cat.amount.toLocaleString()}
                        </span>
                        <ChevronRight className="size-icon-sm text-text-tertiary" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="drill"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-section px-screen"
            >
              <button 
                onClick={() => setDrillDownCategory(null)}
                className="flex items-center gap-inner text-text-tertiary hover:text-text-primary transition-colors p-inner -ml-2 w-fit active:scale-95 active:opacity-active duration-fast ease-apple"
              >
                <ArrowLeft className="size-icon-sm" />
                <span className="text-caption font-caption uppercase tracking-wide">返回分析</span>
              </button>

              <div className="bg-surface-primary rounded-card p-section flex flex-col items-center gap-item relative overflow-hidden border border-hairline border-border-subtle">
                <div className="size-icon-lg rounded-button bg-bg-base flex items-center justify-center text-brand-primary shrink-0 shadow-inner">
                   {renderIcon(
                    drillDownCategory === "飲食" ? "Utensils" : 
                    drillDownCategory === "交通" ? "Car" : 
                    drillDownCategory === "購物" ? "ShoppingBag" : 
                    drillDownCategory === "收入" ? "TrendingUp" : "Tag", 
                    "size-icon-md"
                  )}
                </div>
                <div className="text-center relative z-10">
                  <h3 className="text-h3 font-h3 tracking-tight text-text-primary leading-tight">{drillDownCategory}</h3>
                  <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide mt-1">
                    {reportType === "income" ? "收入來源分析" : "支出細目分析"}
                  </p>
                </div>
                <div className="w-full h-hairline bg-surface-glass-heavy relative z-10 opacity-50"></div>
                <span className={`text-h2 font-h2 tabular-nums tracking-tight leading-none ${reportType === 'income' ? 'text-brand-primary' : 'text-text-primary'}`}>
                  $ {currentCategoryData?.amount.toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-item">
                <div className="bg-surface-primary rounded-card overflow-hidden divide-y-hairline divide-border-subtle border border-hairline border-border-subtle">
                  {currentCategoryData?.sub.map(sub => (
                    <div key={sub.name} className="px-section py-item flex items-center justify-between group">
                      <div className="flex flex-col gap-inner flex-1 pr-4">
                        <div className="flex items-center justify-between">
                          <span className="font-body text-body text-text-primary leading-normal">{sub.name}</span>
                          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">{Math.round(sub.percentage)}%</span>
                        </div>
                        <div className="w-full h-1 bg-bg-base rounded-button overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${sub.percentage}%` }}
                             className={`h-full rounded-button ${reportType === "income" ? "bg-brand-primary/40" : "bg-brand-primary/20"}`}
                           ></motion.div>
                        </div>
                      </div>
                      <span className={`font-h3 text-body tabular-nums tracking-tighter leading-none ${reportType === "income" ? "text-brand-primary" : "text-text-primary"}`}>
                        $ {sub.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
