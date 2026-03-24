import React, { useMemo, useState } from "react";
import { ChevronLeft, CheckCircle, Clock } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { db, Transaction } from "@/db/db";

interface ReconciliationViewProps {
  account: any;
  transactions: Transaction[];
  onBack: () => void;
}

export default function ReconciliationView({ account, transactions, onBack }: ReconciliationViewProps) {
  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    sorted.forEach(tx => {
      const datePart = tx.date.split('T')[0];
      const [y, m, d] = datePart.split(/[/|-]/);
      const displayKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      
      if (!groups[displayKey]) groups[displayKey] = [];
      groups[displayKey].push(tx);
    });
    
    return Object.entries(groups);
  }, [transactions]);

  // Statistics
  const stats = useMemo(() => {
    const confirmedCount = transactions.filter(t => t.status === "reconciled").length;
    const totalCount = transactions.length;
    const totalAmount = transactions.filter(t => t.status === "reconciled").reduce((acc, t) => acc + Math.abs(t.amount), 0);
    return { confirmedCount, totalCount, totalAmount };
  }, [transactions]);

  const reconciliationMonth = useMemo(() => {
    if (transactions.length === 0) return "";
    // Pick the most recent transaction's billing month or date
    const latest = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return latest.billing_month || latest.date.split(/[/-]/).slice(0, 2).join("-");
  }, [transactions]);

  const handleAction = async (id: number, action: "confirm" | "delay") => {
    const t = await db.transactions.get(id);
    if (!t) return;

    if (action === "confirm") {
      await db.transactions.update(id, { status: "reconciled" });
    } else if (action === "delay") {
      const currentBilling = t.billing_month || t.date.split(/[/-]/).slice(0, 2).join("-");
      const [year, month] = currentBilling.split("-").map(Number);
      
      const txDate = new Date(t.date.replace(/\//g, '-'));
      const maxDate = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 1);
      const maxMonthStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`;

      if (currentBilling >= maxMonthStr) return;

      const nextDate = new Date(year, month, 1);
      const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      await db.transactions.update(id, { billing_month: nextMonthStr });
    }
  };

  return (
    <motion.div
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex flex-col gap-micro overflow-hidden">
          <div className="flex items-center gap-item">
            <button onClick={onBack} className="p-inner -ml-2 rounded-inner hover:bg-surface-glass transition-all ease-apple shrink-0">
              <ChevronLeft className="size-icon-lg text-brand-primary" />
            </button>
            <h1 className="text-h3 font-h3 tracking-tight text-text-primary whitespace-nowrap leading-tight">對帳模式</h1>
          </div>
          <p className="px-micro text-caption font-caption text-text-tertiary uppercase tracking-wide leading-none">
            {account.name} · 對帳中
          </p>
        </div>
        <div className="flex items-center gap-inner">
          <span className="text-brand-primary font-h3 bg-brand-primary/10 px-item py-micro.5 rounded-inner text-caption border border-brand-primary/20 shrink-0 leading-none">
            {reconciliationMonth}
          </span>
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
                {txs.map((tx) => (
                  <ReconciliationItem 
                    key={tx.id} 
                    tx={tx} 
                    onAction={(action) => tx.id && handleAction(tx.id, action)} 
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <footer className="fixed bottom-0 inset-x-0 px-screen py-section pb-12 bg-bg-base/80 backdrop-blur-md border-t border-hairline border-border-subtle z-nav">
        <div className="flex justify-between items-center w-full">
          <div className="flex flex-col">
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-1.5">對帳進度</span>
            <div className="flex items-baseline gap-micro.5">
              <span className="text-h2 font-h2 text-brand-primary leading-none">{stats.confirmedCount}</span>
               <span className="text-text-tertiary font-body text-body lowercase tracking-tight leading-normal">/ {stats.totalCount} 筆</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mb-1.5">總對帳金額</span>
            <span className="text-h2 font-h2 tracking-tight tabular-nums text-text-primary leading-none">
              $ {stats.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}

function ReconciliationItem({ tx, onAction }: { tx: Transaction, onAction: (action: "confirm" | "delay") => void }) {
  const x = useMotionValue(0);
  const opacityDelay = useTransform(x, [0, 80], [0, 1]);
  const opacityConfirm = useTransform(x, [-80, 0], [1, 0]);

  return (
    <div className="relative overflow-hidden group">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between px-section z-0">
        <motion.div style={{ opacity: opacityDelay }} className="flex items-center gap-inner text-brand-primary/60 font-h3 text-h3">
          <Clock className="size-icon-md" /> 延後
        </motion.div>
        <motion.div style={{ opacity: opacityConfirm }} className="flex items-center gap-inner text-brand-primary font-h3 text-h3">
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
          x.set(0);
        }}
        className="relative z-10 bg-bg-base py-section px-section flex justify-between items-center active:bg-surface-glass transition-all ease-apple"
      >
        <div className="flex flex-col">
          <span className={`font-body text-body tracking-tight leading-normal ${tx.status === 'reconciled' ? 'text-text-tertiary opacity-50 line-through' : 'text-text-primary'}`}>
            {tx.item_name || tx.merchant || tx.main_category}
          </span>
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mt-1">
            {tx.main_category} · {tx.sub_category}
          </span>
        </div>
        <span className={`font-h3 text-h3 tabular-nums tracking-tight ${tx.status === 'reconciled' ? 'text-brand-primary/30' : 'text-text-primary'}`}>
          $ {Math.abs(tx.amount).toLocaleString()}
        </span>
      </motion.div>
    </div>
  );
}
