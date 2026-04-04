import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Trash2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteTransaction } from "@/db/db";
import { ICON_MAP } from "@/constants/icons";
import { Tag, Box } from "lucide-react";
import TransactionDetailView from "./TransactionDetailView";
import TransactionFormView from "./TransactionFormView";
import ConfirmModal from "@/components/ConfirmModal";

interface HomeViewProps {
  onBudgetClick: () => void;
}

import SwipeableDelete from "@/components/SwipeableDelete";

export default function HomeView({ onBudgetClick }: HomeViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [isDeletingRecurring, setIsDeletingRecurring] = useState(false);

  // --- Swiped Item ID for Mutual Exclusion ---
  const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [editTx, setEditTx] = useState<any | null>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  useEffect(() => {
    setSwipedItemId(null);
  }, [selectedDate, currentMonth]);

  // Real data from IndexedDB
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const categoriesSetting = useLiveQuery(() =>
    db.settings.where("key").equals("categories").first()
  );
  const categories = (categoriesSetting?.value as any[]) || [];

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDay, days };
  }, [currentMonth]);

  const calendarDays = useMemo(() => {
    const days = [];

    if (isExpanded) {
      const { firstDay, days: totalDays } = daysInMonth;
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= totalDays; i++) {
        const dateStr = `${currentMonth.getFullYear()}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${String(i).padStart(2, '0')}`;
        const hasTx = allTransactions.some(t => t.date === dateStr);
        days.push({ day: i, hasTx, dateStr });
      }
    } else {
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        const hasTx = allTransactions.some(t => t.date === dateStr);
        days.push({
          day: d.getDate(),
          hasTx,
          dateStr,
          isCurrentMonth: d.getMonth() === currentMonth.getMonth()
        });
      }
    }
    return days;
  }, [daysInMonth, currentMonth, isExpanded, selectedDate, allTransactions]);

  const selectedDateTransactions = useMemo(() => {
    const dateStr = `${selectedDate.getFullYear()}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${String(selectedDate.getDate()).padStart(2, '0')}`;
    const dayTransactions = allTransactions.filter(t => t.date === dateStr);

    // Grouping Logic
    const groups: Record<string, any[]> = {};
    const ungrouped: any[] = [];

    dayTransactions.forEach(tx => {
      if (tx.group_id) {
        if (!groups[tx.group_id]) groups[tx.group_id] = [];
        groups[tx.group_id].push(tx);
      } else {
        ungrouped.push({ type: 'single', data: tx, id: tx.id });
      }
    });

    const groupedEntries = Object.entries(groups).map(([id, txs]) => ({
      type: 'group',
      id,
      data: txs,
      totalAmount: txs.reduce((acc, t) => acc + t.amount, 0),
      merchant: txs[0].merchant || "多項交易項目",
      date: txs[0].date
    }));

    return [...ungrouped, ...groupedEntries].sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [selectedDate, allTransactions]);

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const handleDelete = async (idOrGroupId: number | string) => {
    if (typeof idOrGroupId === 'number') {
      const tx = await db.transactions.get(idOrGroupId);
      if (tx?.rule_id) {
        setDeleteId(idOrGroupId);
        setIsDeletingRecurring(true);
        return;
      }
    } else {
      const txs = await db.transactions.where('group_id').equals(idOrGroupId).toArray();
      if (txs.some(t => t.rule_id)) {
        setDeleteId(idOrGroupId);
        setIsDeletingRecurring(true);
        return;
      }
    }
    
    // 一般交易：直接刪除，不進入 ConfirmModal
    await deleteTransaction(idOrGroupId);
  };

  const executeDelete = async () => {
    if (deleteId) {
      await deleteTransaction(deleteId);
      setDeleteId(null);
      setIsDeletingRecurring(false);
    }
  };

  const getIcon = (mainCat: string, subCat?: string) => {
    // 1. Find the main category first
    const main = categories.find(c => c.name === mainCat);
    if (!main) return <Box className="size-icon-md text-text-tertiary" />;

    // 2. Try to find the sub-category icon
    const sub = main.subCategories?.find((s: any) => s.name === subCat);
    const iconName = sub?.iconName || main.iconName || "Box";

    const IconComponent = ICON_MAP[iconName] || Box;
    return <IconComponent className="size-icon-md" />;
  };

  const budgetSettingsSetting = useLiveQuery(() =>
    db.settings.where("key").equals("budget_settings").first()
  );
  const budgetSettings = (budgetSettingsSetting?.value as Record<string, number>) || {};

  const { totalBudget, totalSpent, spentPercent } = useMemo(() => {
    const totalB = Object.values(budgetSettings).reduce((a, b) => a + b, 0);

    // Calculate current month's spending (expense and transfer-out)
    const monthStr = `${currentMonth.getFullYear()}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthTxs = allTransactions.filter(t => t.date.startsWith(monthStr));

    const spentAmount = monthTxs.reduce((acc, tx) => {
      if (tx.type === 'expense') return acc + Math.abs(tx.amount);
      // For transfer, we might only count it if it's leaving the "main" accounts, 
      // but for simplicity in a budget, we usually tract expenses.
      return acc;
    }, 0);

    const percent = totalB > 0 ? Math.min(Math.round((spentAmount / totalB) * 100), 100) : 0;
    return { totalBudget: totalB, totalSpent: spentAmount, spentPercent: percent };
  }, [budgetSettings, allTransactions, currentMonth]);

  return (
    <div className="w-full min-h-full flex flex-col text-text-primary relative">


      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex flex-col items-start justify-center">
          <h3 className="text-h3 font-h3 text-text-primary leading-tight">
            {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
          </h3>
        </div>
        <div className="flex items-center gap-item">
          <div className="flex bg-surface-glass p-0.5 rounded-button border border-hairline border-border-subtle scale-90 origin-right transition-all duration-normal ease-apple">
            <button onClick={() => changeMonth(-1)} className="px-item py-micro rounded-button hover:bg-brand-primary active:scale-95 active:opacity-active transition-all duration-normal text-text-tertiary hover:text-bg-base">
              <ChevronLeft className="size-icon-lg" />
            </button>
            <button onClick={() => changeMonth(1)} className="px-item py-micro rounded-button hover:bg-brand-primary active:scale-95 active:opacity-active transition-all duration-normal text-text-tertiary hover:text-bg-base">
              <ChevronRight className="size-icon-lg" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base pb-nav-clearance">
        <div className="relative z-nav transition-all duration-normal">
          <motion.div
            animate={{ height: "auto" }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className={`px-screen pt-safe-top pb-2 overflow-hidden sticky top-0 z-sticky ${!isExpanded ? 'bg-bg-base/80 backdrop-blur-md' : ''}`}
          >
            <div className="grid grid-cols-7 gap-y-1">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-center text-caption font-caption text-text-tertiary uppercase pb-1">{d}</div>
              ))}
              {calendarDays.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const isSelected = selectedDate.getDate() === d.day &&
                  selectedDate.getMonth() === (isExpanded ? currentMonth.getMonth() : new Date(d.dateStr).getMonth());
                const isToday = new Date().toDateString() === new Date(d.dateStr).toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(new Date(d.dateStr))}
                    className="relative flex flex-col items-center justify-center h-9 group active:opacity-active transition-opacity duration-normal"
                  >
                    <div className={`w-9 h-9 mx-auto rounded-button flex items-center justify-center transition-all duration-normal text-body font-h3 leading-none ${isSelected ? "bg-brand-primary text-bg-base shadow-lg shadow-brand-primary/20 scale-110" :
                      isToday ? "text-brand-primary border border-brand-primary/30" : "text-text-primary"
                      }`}>
                      {d.day}
                    </div>
                    {d.hasTx && !isSelected && (
                      <div className="absolute bottom-0.5 w-1 h-1 bg-brand-primary rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </div>

            <motion.div
              onPanEnd={(_, info) => {
                const swipeThreshold = 30;
                if (info.offset.y < -swipeThreshold) setIsExpanded(false);
                if (info.offset.y > swipeThreshold) setIsExpanded(true);
              }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex justify-center py-inner mt-1 cursor-ns-resize touch-none active:opacity-active transition-opacity duration-normal"
            >
              <div className="w-10 h-1 rounded-button bg-surface-glass-heavy"></div>
            </motion.div>
          </motion.div>

          {!isExpanded && (
            <motion.div
              onPanEnd={(_, info) => {
                if (info.offset.y > 30) setIsExpanded(true);
              }}
              className="absolute inset-x-0 top-0 h-[100px] z-sticky touch-none pointer-events-auto"
              style={{ background: 'transparent' }}
            />
          )}
        </div>

        <div className="px-screen py-inner z-10">
          <button
            onClick={onBudgetClick}
            className="w-full group active:opacity-active transition-all duration-normal text-left"
          >
            <div className="flex justify-between items-end mb-1.5 px-micro">
              <div className="flex items-center gap-inner">
                <span className="text-caption font-caption text-text-secondary uppercase tracking-wide">預算進度</span>
                <span className={`text-body font-body leading-normal ${spentPercent > 90 ? 'text-semantic-danger' : 'text-brand-primary'}`}>{spentPercent}%</span>
              </div>
              <span className="text-body font-caption text-text-secondary uppercase tracking-tight">
                {totalBudget - totalSpent >= 0 ? `剩餘 $${(totalBudget - totalSpent).toLocaleString()}` : `超支 $${Math.abs(totalBudget - totalSpent).toLocaleString()}`}
              </span>
            </div>
            <div className="w-full h-1 bg-surface-primary rounded-button overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${spentPercent}%` }}
                className={`h-full rounded-button shadow-[0_0_8px_rgba(16,185,129,0.3)] ${spentPercent > 90 ? 'bg-semantic-danger shadow-semantic-danger/20' : 'bg-brand-primary shadow-brand-primary/20'}`}
              />
            </div>
          </button>
        </div>

        <div className="px-screen flex flex-col gap-inner">
          <div className="flex justify-between items-center px-inner">
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide px-inner">
              {selectedDateTransactions.length} 筆紀錄
            </span>
          </div>

          <div className="bg-surface-primary rounded-card overflow-hidden shadow-xl border border-hairline border-border-subtle">
            {selectedDateTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-text-tertiary gap-item">
                <CalendarIcon className="size-icon-xl" />
                <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide">今日無支出紀錄</p>
              </div>
            ) : (
              selectedDateTransactions.map(entry => {
                const id = entry.id as any;
                const isGroup = entry.type === 'group';
                const displayTx = isGroup ? (entry.data as any[])[0] : (entry.data as any);
                const amount = isGroup ? entry.totalAmount : displayTx.amount;

                return (
                  <SwipeableDelete
                    key={id}
                    onDelete={() => handleDelete(id)}
                    isOpen={swipedItemId === id}
                    onOpenStateChange={(open) => setSwipedItemId(open ? id : null)}
                  >
                    <div
                      onClick={() => isGroup ? setSelectedTx(entry.data) : setSelectedTx(displayTx)}
                      className="flex items-center justify-between px-section py-item bg-surface-primary active:bg-surface-glass active:opacity-active transition-colors duration-fast"
                    >
                      <div className="flex items-center gap-item flex-1 min-w-0">
                        <div className="size-icon-container rounded-inner bg-bg-base flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform relative shrink-0">
                          {isGroup ? <Box className="size-icon-md text-brand-primary" /> : getIcon(displayTx.main_category, displayTx.sub_category)}
                          {isGroup && (
                            <div className="absolute -top-1 -right-1 bg-brand-primary text-bg-base text-caption font-body size-icon-md rounded-button flex items-center justify-center border-2 border-surface-primary">
                              {entry.data.length}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-body text-body leading-normal text-text-primary truncate">
                            {isGroup ? entry.merchant : (displayTx.item_name || displayTx.merchant || displayTx.main_category)}
                          </span>
                          <span className="text-caption font-caption text-text-tertiary uppercase tracking-normal mt-0.5 truncate">
                            {isGroup
                              ? Array.from(new Set(entry.data.map((t: any) => t.main_category))).join(' · ')
                              : `${displayTx.main_category} · ${displayTx.sub_category}`
                            }
                          </span>
                        </div>
                      </div>
                      <span className={`font-body text-h3 tabular-nums shrink-0 pl-item ${displayTx.type === 'expense' ? 'text-semantic-danger' : displayTx.type === 'income' ? 'text-brand-primary' : 'text-text-tertiary'}`}>
                        {amount < 0 ? '-' : amount > 0 ? '+' : ''}${Math.abs(amount).toLocaleString()}
                      </span>
                    </div>
                  </SwipeableDelete>
                );
              })
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedTx && (
          <TransactionDetailView
            transactions={selectedTx}
            accountName={accounts.find(a => a.id === (Array.isArray(selectedTx) ? selectedTx[0]?.account_id : selectedTx.account_id))?.name}
            onBack={() => setSelectedTx(null)}
            onEdit={(tx) => {
              setEditTx(tx);
              setSelectedTx(null);
            }}
            onDelete={() => {
              const idToDelete = Array.isArray(selectedTx) ? (selectedTx[0].group_id || selectedTx[0].id) : selectedTx.id;
              if (idToDelete) {
                handleDelete(idToDelete);
                setSelectedTx(null);
              }
            }}
            onDuplicate={() => {
              const txs = Array.isArray(selectedTx) ? selectedTx : [selectedTx];
              // Prepare copy: remove IDs and reset status
              const copiedTxs = txs.map(tx => {
                const { id, group_id, rule_id, status, ...rest } = tx;
                return {
                  ...rest,
                  status: 'confirmed'
                } as any;
              });

              setEditTx(copiedTxs);
              setSelectedTx(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTx && (
          <TransactionFormView
            initialData={editTx}
            onBack={() => setEditTx(null)}
            onSave={() => setEditTx(null)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="發起刪除"
        message={isDeletingRecurring 
          ? "此筆交易屬於分期/定期項目。刪除此明細「不會」停止未來期數的自動產生，如需取消排程請至管理頁面。" 
          : "確定要刪除此筆交易嗎？此操作無法還原。"}
        confirmText="刪除"
        cancelText="取消"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
