import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle, Clock } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Transaction } from "@/db/db";

interface ReconciliationViewProps {
  account: any;
  onBack: () => void;
}

const getBillingPeriod = (targetDate: Date, cycleDay: number) => {
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth(); // 0-based
  
  // 當期結束日：這個月的 cycleDay (需處理月底溢位，如 4月沒有31號)
  const currentMonthDays = new Date(y, m + 1, 0).getDate();
  const endDay = Math.min(cycleDay, currentMonthDays);
  const endDate = new Date(y, m, endDay, 23, 59, 59);
  
  // 上期結束日 -> 本期開始日：上個月的 cycleDay + 1 天
  const prevMonthDays = new Date(y, m, 0).getDate();
  const prevEndDay = Math.min(cycleDay, prevMonthDays);
  const startDate = new Date(y, m - 1, prevEndDay + 1, 0, 0, 0);
  
  const format = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return { startStr: format(startDate), endStr: format(endDate) };
};

export default function ReconciliationView({ account, onBack }: ReconciliationViewProps) {
  const [targetMonth, setTargetMonth] = useState(new Date());

  const allTransactions = useLiveQuery(() => 
    db.transactions.where("account_id").equals(account.id).toArray()
  , [account.id]) || [];

  const { startStr, endStr } = useMemo(() => {
    const cycleDay = account.billing_cycle || 31;
    return getBillingPeriod(targetMonth, cycleDay);
  }, [targetMonth, account.billing_cycle]);

  const transactions = useMemo(() => 
    allTransactions.filter(t => {
      if (t.status === "pending" || t.status === "scheduled") return false;
      const txDateStr = t.date.split('T')[0].replace(/-/g, '/');
      return txDateStr >= startStr && txDateStr <= endStr;
    })
  , [allTransactions, startStr, endStr]);

  // Group transactions by date AND group_id
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Group by Date first
    const dateGroups: Record<string, any[]> = {};
    sorted.forEach(tx => {
      const datePart = tx.date.split('T')[0];
      const [y, m, d] = datePart.split(/[/|-]/);
      const displayKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (!dateGroups[displayKey]) dateGroups[displayKey] = [];
      dateGroups[displayKey].push(tx);
    });

    // Group by group_id within each date
    return Object.entries(dateGroups).map(([date, items]) => {
      const subGroups: Record<string, any[]> = {};
      const ungrouped: any[] = [];
      
      items.forEach(tx => {
        if (tx.group_id) {
          if (!subGroups[tx.group_id]) subGroups[tx.group_id] = [];
          subGroups[tx.group_id].push(tx);
        } else {
          ungrouped.push({ type: 'single', data: tx, id: tx.id });
        }
      });
      
      const groupedEntries = Object.entries(subGroups).map(([id, txs]) => ({
        type: 'group',
        id,
        data: txs,
        totalAmount: txs.reduce((acc, t) => acc + t.amount, 0),
        merchant: txs[0].merchant || "多項交易項目",
        date: txs[0].date
      }));

      const finalEntries = [...ungrouped, ...groupedEntries].sort((a, b) => {
        const idA = a.type === 'single' ? (a.data.id || 0) : 0;
        const idB = b.type === 'single' ? (b.data.id || 0) : 0;
        return (idB as number) - (idA as number);
      });

      return [date, finalEntries] as [string, any[]];
    });
  }, [transactions]);

  // Statistics
  const stats = useMemo(() => {
    const confirmedCount = transactions.filter(t => t.status === "reconciled").length;
    const totalCount = transactions.length;
    const totalAmount = transactions.filter(t => t.status === "reconciled").reduce((acc, t) => acc + Math.abs(t.amount), 0);
    return { confirmedCount, totalCount, totalAmount };
  }, [transactions]);

  // No longer needed: reconciliationMonth

  const handleAction = async (entry: any, action: "confirm" | "delay") => {
    const txsToUpdate = entry.type === 'group' ? entry.data : [entry.data];
    
    for (const t of txsToUpdate) {
      if (!t.id) continue;
      
      if (action === "confirm") {
        await db.transactions.update(t.id, { status: "reconciled" });
      } else if (action === "delay") {
        const currentBilling = t.billing_month || t.date.split(/[/-]/).slice(0, 2).join("-");
        const [year, month] = currentBilling.split("-").map(Number);
        
        const txDate = new Date(t.date.replace(/\//g, '-'));
        const maxDate = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 1);
        const maxMonthStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`;

        if (currentBilling >= maxMonthStr) {
          // 已達最多延後一個月的限制，僅復原對帳狀態
          await db.transactions.update(t.id, { status: "confirmed" });
          continue;
        }

        const nextDate = new Date(year, month, 1);
        const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        
        await db.transactions.update(t.id, { billing_month: nextMonthStr, status: "confirmed" });
      }
    }
  };

  return (
    <motion.div
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex flex-col gap-1 overflow-hidden">
          <div className="flex items-center gap-item">
            <button onClick={onBack} className="p-inner -ml-2 rounded-inner hover:bg-surface-glass transition-all ease-apple shrink-0">
              <ChevronLeft className="size-icon-lg text-brand-primary" />
            </button>
            <h1 className="text-h3 font-h3 tracking-tight text-text-primary whitespace-nowrap leading-tight">對帳模式</h1>
          </div>
          <div className="flex items-center gap-1.5 pl-9 pr-1">
            <span className="text-[10px] font-medium text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded-inner truncate shrink-0 border border-brand-primary/20">
              {account.name}
            </span>
            <span className="text-[10px] font-caption text-text-tertiary tracking-widest whitespace-nowrap opacity-80">
              {startStr.replace(/^\d{4}\//, '')} ~ {endStr.replace(/^\d{4}\//, '')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-inner">
          <div className="flex bg-surface-glass p-0.5 rounded-button border border-hairline border-border-subtle overflow-hidden">
            <button onClick={() => setTargetMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="px-inner py-micro rounded-inner hover:bg-brand-primary hover:text-bg-base active:scale-95 transition-all text-text-tertiary">
              <ChevronLeft className="size-icon-sm" />
            </button>
            <span className="text-brand-primary font-h3 px-item py-micro.5 text-caption leading-none flex items-center justify-center min-w-[70px]">
              {targetMonth.getFullYear()}-{String(targetMonth.getMonth() + 1).padStart(2, '0')}
            </span>
            <button onClick={() => setTargetMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="px-inner py-micro rounded-inner hover:bg-brand-primary hover:text-bg-base active:scale-95 transition-all text-text-tertiary">
              <ChevronRight className="size-icon-sm" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base px-screen pb-nav-clearance py-section">
        <section className="flex flex-col gap-section">
          {groupedTransactions.map(([date, txs]) => (
            <div key={date} className="flex flex-col gap-inner">
              <div className="px-inner flex justify-between items-center">
                <span className="text-[11px] font-caption text-text-tertiary tracking-[0.2em] uppercase">{date}</span>
              </div>
              <div className="bg-surface-primary rounded-card overflow-hidden divide-y-hairline divide-border-subtle border border-hairline border-border-subtle shadow-xl">
                {txs.map((entry) => (
                  <ReconciliationItem 
                    key={entry.id} 
                    entry={entry} 
                    onAction={(action) => handleAction(entry, action)} 
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <footer className="fixed bottom-0 inset-x-0 px-screen py-section pb-12 bg-bg-base/80 backdrop-blur-md border-t border-hairline border-border-subtle z-nav">
        <div className="flex justify-between items-center w-full">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">對帳進度</span>
            <span className="text-h3 font-h3 tracking-tight text-text-primary leading-none tabular-nums">
              {stats.confirmedCount} <span className="text-text-tertiary opacity-70">/ {stats.totalCount} 筆</span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">總對帳金額</span>
            <span className="text-h3 font-h3 tracking-tight tabular-nums text-text-primary leading-none">
              ${stats.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}

function ReconciliationItem({ entry, onAction }: { entry: any, onAction: (action: "confirm" | "delay") => void }) {
  const x = useMotionValue(0);
  const isGroup = entry.type === 'group';
  const tx = isGroup ? entry.data[0] : entry.data;
  const amount = isGroup ? entry.totalAmount : tx.amount;
  
  // For group status, check if all are reconciled
  const isReconciled = isGroup 
    ? entry.data.every((t: any) => t.status === 'reconciled')
    : tx.status === 'reconciled';

  const opacityDelay = useTransform(x, [0, 60], [0, 1]);
  const opacityConfirm = useTransform(x, [-60, 0], [1, 0]);

  const bgConfirm = useTransform(x, [-60, -100], ["rgba(16, 185, 129, 0)", "rgba(16, 185, 129, 0.2)"]);
  const bgDelay = useTransform(x, [60, 100], ["rgba(245, 158, 11, 0)", "rgba(245, 158, 11, 0.2)"]);

  return (
    <div className="relative overflow-hidden group">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between px-section z-0">
        <motion.div style={{ opacity: opacityDelay, backgroundColor: bgDelay }} className="absolute inset-y-0 left-0 w-1/2 flex items-center pl-section gap-inner text-semantic-warning font-h3 text-h3 transition-colors">
          <Clock className="size-icon-md" /> 延後
        </motion.div>
        <motion.div style={{ opacity: opacityConfirm, backgroundColor: bgConfirm }} className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-end pr-section gap-inner text-brand-primary font-h3 text-h3 transition-colors">
          確認 <CheckCircle className="size-icon-md" />
        </motion.div>
      </div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x > 60) onAction("delay");
          else if (info.offset.x < -60) onAction("confirm");
          
          animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
        }}
        className="relative z-10 bg-bg-base py-item px-section flex justify-between items-center h-[72px] active:bg-surface-glass transition-all ease-apple"
      >
        <div className="flex flex-col">
          <span className={`font-body text-body tracking-tight leading-normal ${isReconciled ? 'text-text-tertiary opacity-50 line-through' : 'text-text-primary'}`}>
            {isGroup ? entry.merchant : (tx.item_name || tx.merchant || tx.main_category)}
          </span>
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mt-1 flex items-center gap-2">
            <span>
              {isGroup 
                ? Array.from(new Set(entry.data.map((t: any) => t.main_category))).join(' · ')
                : `${tx.main_category} · ${tx.sub_category}`
              }
            </span>
            {tx.billing_month && tx.billing_month !== tx.date.split(/[/-]/).slice(0, 2).join('-') && (
              <span className="bg-semantic-warning/10 text-semantic-warning px-1.5 py-0.5 rounded-inner text-[10px] font-bold">
                已延後至 {tx.billing_month.replace('-', '/')}
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`font-h3 text-h3 tabular-nums tracking-tight ${isReconciled ? 'text-brand-primary/30' : 'text-text-primary'}`}>
            ${Math.abs(amount).toLocaleString()}
          </span>
          {isGroup && (
             <span className="text-caption font-caption px-1.5 py-0.5 rounded-button bg-surface-glass-heavy text-text-tertiary">
               {entry.data.length} 筆
             </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
