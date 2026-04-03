import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, CheckCircle, Clock, Edit2, Trash2, Tag } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteTransaction } from "@/db/db";
import ConfirmModal from "@/components/ConfirmModal";
import TransactionFormView from "./TransactionFormView";
import { ICON_MAP } from "@/constants/icons";

interface Transaction {
  id?: number | string;
  date: string; 
  type: "expense" | "income" | "transfer";
  main_category: string;
  sub_category: string;
  account_id: number;
  amount: number;
  item_name?: string;
  merchant?: string;
  invoice_number?: string;
  note?: string;
  status?: string;
  billing_month?: string;
  group_id?: string;
}

interface AccountDetailViewProps {
  account: any | null;
  onBack: () => void;
  onEditAccount: () => void;
  onDeleteAccount: () => void;
  onStartReconciliation: (txs: Transaction[]) => void;
}

const getBillingPeriod = (targetDate: Date, cycleDay: number | null) => {
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth();
  const format = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  if (!cycleDay) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    return { startStr: format(start), endStr: format(end) };
  }

  const endMonthDays = new Date(y, m + 1, 0).getDate();
  const endDay = Math.min(cycleDay, endMonthDays);
  const endDate = new Date(y, m, endDay, 23, 59, 59);
  
  const prevMonthDays = new Date(y, m, 0).getDate();
  const prevEndDay = Math.min(cycleDay, prevMonthDays);
  const startDate = new Date(y, m - 1, prevEndDay + 1, 0, 0, 0);

  return { startStr: format(startDate), endStr: format(endDate) };
};

export default function AccountDetailView({ 
  account, 
  onBack, 
  onEditAccount, 
  onDeleteAccount,
  onStartReconciliation
}: AccountDetailViewProps) {
  // --- REAL DATA FROM DB ---
  const transactions = useLiveQuery(() => 
    account ? db.transactions.where("account_id").equals(account.id).toArray() : []
  , [account]) || [];

  const categoriesSetting = useLiveQuery(() => 
    db.settings.where("key").equals("categories").first()
  );
  const categories = (categoriesSetting?.value as any[]) || [];

  const getIcon = (mainCat: string, subCat?: string) => {
    const main = categories.find(c => c.name === mainCat);
    if (!main) return <Tag className="size-icon-md text-text-tertiary" />;
    const sub = main.subCategories?.find((s: any) => s.name === subCat);
    const iconName = sub?.iconName || main.iconName || "Box";
    const IconComponent = ICON_MAP[iconName] || Tag;
    return <IconComponent className="size-icon-md" />;
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // --- Swiped Item ID for Mutual Exclusion ---
  const [swipedItemId, setSwipedItemId] = useState<string | number | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [editTx, setEditTx] = useState<any | null>(null);

  const defaultTargetDate = useMemo(() => {
    if (account?.type !== 'credit_card' || !account.billing_cycle) return new Date();
    const today = new Date();
    const cycleDay = account.billing_cycle;
    const currentMonthEndDay = Math.min(cycleDay, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
    const currentMonthEndDate = new Date(today.getFullYear(), today.getMonth(), currentMonthEndDay, 23, 59, 59);
    
    const target = new Date(today);
    if (today > currentMonthEndDate) {
      target.setMonth(target.getMonth() + 1);
    }
    return new Date(target.getFullYear(), target.getMonth(), 1);
  }, [account]);

  const [targetMonth, setTargetMonth] = useState<Date>(() => new Date());

  useEffect(() => {
    if (account) setTargetMonth(defaultTargetDate);
  }, [defaultTargetDate, account]);

  const { startStr, endStr } = useMemo(() => {
    const cycleDay = account?.type === 'credit_card' ? account.billing_cycle : null;
    return getBillingPeriod(targetMonth, cycleDay);
  }, [targetMonth, account]);

  const periodTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDateStr = tx.date.split('T')[0].replace(/-/g, '/');
      return txDateStr >= startStr && txDateStr <= endStr;
    });
  }, [transactions, startStr, endStr]);

  const billingInfo = useMemo(() => {
    if (account?.type !== 'credit_card' || !account.billing_cycle) return null;
    
    const unbilledTxs = periodTransactions.filter(tx => tx.status !== 'scheduled');
    const unbilledAmount = unbilledTxs.reduce((acc, tx) => acc + tx.amount, 0);

    return {
      startDateStr: startStr,
      endDateStr: endStr,
      unbilledAmount
    };
  }, [account, periodTransactions, startStr, endStr]);

  const groupedTransactions = useMemo(() => {
    const sorted = [...periodTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // 1st Level: Group by Date
    const dateGroups: Record<string, any[]> = {};
    sorted.forEach(tx => {
      const datePart = tx.date.split('T')[0];
      const [y, m, d] = datePart.split(/[/|-]/);
      const displayKey = `${parseInt(m)}月${parseInt(d)}日`;
      if (!dateGroups[displayKey]) dateGroups[displayKey] = [];
      dateGroups[displayKey].push(tx);
    });

    // 2nd Level: Group by group_id within each date
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
      
      const groupedEntries: any[] = [];
      Object.entries(subGroups).forEach(([id, txs]) => {
        if (txs.length === 1) {
          ungrouped.push({ type: 'single', data: txs[0], id: txs[0].id });
        } else {
          groupedEntries.push({
            type: 'group',
            id,
            data: txs,
            totalAmount: txs.reduce((acc, t) => acc + t.amount, 0),
            merchant: txs[0].merchant || "多項交易項目",
            date: txs[0].date
          });
        }
      });

      const finalEntries = [...ungrouped, ...groupedEntries].sort((a, b) => {
        const idA = a.type === 'single' ? (a.data.id || 0) : 0;
        const idB = b.type === 'single' ? (b.data.id || 0) : 0;
        return (idB as number) - (idA as number);
      });

      return [date, finalEntries] as [string, any[]];
    });
  }, [periodTransactions]);


  const handleEdit = (tx: any) => {
    setEditTx(tx);
    setSelectedTx(null);
  };

  const handleDelete = (idOrGroupId: number | string) => {
    setConfirmModal({
      isOpen: true,
      title: "刪除紀錄",
      message: typeof idOrGroupId === 'string' ? "確定要刪除這組多項消費紀錄嗎？" : "確定要刪除這筆明細嗎？",
      onConfirm: async () => {
        await deleteTransaction(idOrGroupId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const renderIcon = (name: string, className: string = "size-icon-lg") => {
    const IconComponent = ICON_MAP[name] || Tag;
    return <IconComponent className={className} />;
  };

  if (!account) return null;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col gap-section overflow-hidden"
    >


      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex items-center gap-3 overflow-hidden">
          <button onClick={onBack} className="p-inner -ml-inner rounded-button active:bg-surface-glass-heavy transition-all duration-normal ease-apple active:opacity-active shrink-0">
            <ChevronLeft className="size-icon-lg text-brand-primary" />
          </button>
          <div className="size-icon-container rounded-button bg-bg-base flex items-center justify-center border border-border-subtle shrink-0">
            {renderIcon(account.icon, "size-icon-lg text-brand-primary")}
          </div>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-h3 font-h3 tracking-tight text-text-primary leading-tight whitespace-nowrap truncate">{account.name}</h1>
            <span className="text-text-tertiary text-caption font-caption uppercase tracking-wide truncate">
              {account.type === 'credit_card' ? `結帳日：每月 ${account.billing_cycle} 號` : `帳單週期日：每月 ${account.billing_cycle} 號`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 -mr-inner">
          <button onClick={onEditAccount} className="p-inner rounded-button active:bg-surface-glass-heavy text-text-primary transition-all duration-normal ease-apple active:opacity-active">
            <Edit2 className="size-icon-md" />
          </button>
          <button 
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                title: "刪除帳戶",
                message: `確定要刪除「${account.name}」帳戶嗎？所有明細也將一併移除。`,
                onConfirm: onDeleteAccount
              });
            }}
            className="p-inner rounded-button active:bg-semantic-danger/10 text-semantic-danger transition-all duration-normal ease-apple active:opacity-active"
          >
            <Trash2 className="size-icon-md" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-screen pb-nav-clearance flex flex-col gap-section bg-bg-base">
        {account.type === 'credit_card' && billingInfo ? (
          <div className="flex flex-col gap-item shrink-0">
            {/* 信用卡總覽卡片 */}
            <div className="bg-surface-primary rounded-card p-item flex flex-col gap-item relative overflow-hidden group border border-hairline border-border-subtle shadow-sm">
              <div className="flex justify-between items-center">
                <p className="text-text-tertiary font-caption uppercase tracking-wide text-caption">累積未繳總額</p>
                {account.payment_due_day && (
                  <span className="text-caption font-caption text-text-tertiary">
                    繳款日: {account.payment_due_day} 號
                  </span>
                )}
              </div>
              <h2 className="text-h2 font-h2 tracking-tight tabular-nums text-semantic-danger leading-none">
                ${Math.abs(account.current_balance).toLocaleString()}
              </h2>
            </div>
            {/* 本期未出帳 */}
            <div className="bg-surface-glass rounded-card p-item flex flex-col gap-1 relative overflow-hidden border border-hairline border-border-subtle">
              <div className="flex items-center text-text-secondary">
                <span className="font-caption uppercase tracking-wide text-caption">本期未出帳試算</span>
              </div>
              <h3 className="text-h3 font-h3 tracking-tight tabular-nums text-text-primary mt-1">
                ${Math.abs(billingInfo.unbilledAmount).toLocaleString()}
              </h3>
            </div>
          </div>
        ) : (
          <div className="bg-surface-primary rounded-card p-item flex flex-col gap-item relative overflow-hidden group border border-hairline border-border-subtle shrink-0">
            <p className="text-text-tertiary font-caption uppercase tracking-wide text-caption">目前餘額</p>
            <h2 className="text-h2 font-h2 tracking-tight tabular-nums leading-none text-text-primary">
              ${Math.abs(account.current_balance).toLocaleString()}
            </h2>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-h3 font-h3 text-text-primary tracking-tight">帳期明細</h3>
                <div className="flex bg-surface-glass p-0.5 rounded-button border border-hairline border-border-subtle overflow-hidden relative z-10">
                  <button onClick={() => setTargetMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="px-1.5 py-1 rounded-inner hover:bg-brand-primary/10 active:opacity-50 text-text-tertiary">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-text-primary font-caption px-1 flex items-center justify-center min-w-[50px] text-[11px] font-medium tracking-wide">
                    {targetMonth.getFullYear()}-{String(targetMonth.getMonth() + 1).padStart(2, '0')}
                  </span>
                  <button onClick={() => setTargetMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="px-1.5 py-1 rounded-inner hover:bg-brand-primary/10 active:opacity-50 text-text-tertiary">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => onStartReconciliation(periodTransactions as any)}
                className="px-section py-item rounded-button bg-surface-primary border border-border-subtle text-text-secondary font-body text-caption active:bg-surface-glass active:opacity-active transition-all duration-fast ease-apple shadow-dropdown"
              >
                開始對帳
              </button>
            </div>
            <span className="text-text-tertiary font-caption text-caption uppercase tracking-wide">
              {periodTransactions.length} 筆紀錄 · {startStr.replace(/^\d{4}\//, '')} ~ {endStr.replace(/^\d{4}\//, '')}
            </span>
          </div>
        </div>

        <section className="flex flex-col gap-section">
          {groupedTransactions.length === 0 ? (
            <div className="mt-section text-center text-text-tertiary font-h3 tracking-widest">尚無紀錄</div>
          ) : (
            groupedTransactions.map(([date, entries]) => (
              <div key={date} className="flex flex-col gap-inner">
                <div className="mb-inner">
                  <span className="text-caption font-caption text-text-tertiary tracking-wide uppercase">{date}</span>
                </div>
                <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle divide-y-hairline divide-border-subtle overflow-hidden">
                  {entries.map((entry) => (
                    <SwipeableTransactionItem 
                      key={entry.id} 
                      entry={entry} 
                      isOpen={swipedItemId === entry.id}
                      onOpenStateChange={(open) => setSwipedItemId(open ? entry.id : null)}
                      onDelete={(id) => handleDelete(id)}
                      onEdit={(id) => {
                        const item = transactions.find(t => t.id === id);
                        if (item) handleEdit(item);
                      }}
                      onSelect={() => setSelectedTx(entry.data)}
                      getIcon={getIcon}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>


      </div>

      <AnimatePresence>
        {selectedTx && (
          <TransactionDetailView
            transactions={selectedTx}
            onBack={() => setSelectedTx(null)}
            onEdit={handleEdit}
            accountName={account.name}
            onDelete={() => {
              const idToDelete = Array.isArray(selectedTx) ? (selectedTx[0].group_id || selectedTx[0].id) : selectedTx.id;
              if (idToDelete) {
                handleDelete(idToDelete);
                setSelectedTx(null);
              }
            }}
            onDuplicate={async () => {
              const txs = Array.isArray(selectedTx) ? selectedTx : [selectedTx];
              // Use Math.random for broad mobile compatibility instead of crypto.randomUUID()
              const newGroupId = txs.length > 1 ? (Math.random().toString(36).substring(2, 11) + Date.now().toString(36)) : undefined;
              const now = new Date();
              const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
              
              for (const tx of txs) {
                const { id, ...copy } = tx;
                await db.transactions.add({
                  ...copy,
                  date: dateStr,
                  group_id: newGroupId || (txs.length === 1 ? undefined : tx.group_id),
                  status: 'confirmed'
                });
              }
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
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isDestructive={confirmModal.title.includes("刪除")}
        confirmText={confirmModal.title.includes("刪除") ? "刪除" : "確認"}
      />
    </motion.div>
  );
}

import TransactionDetailView from "./TransactionDetailView";

// Sub-component for Swipeable Gesture (Mutual Exclusion Supported)
function SwipeableTransactionItem({ 
  entry, 
  isOpen,
  onOpenStateChange,
  onDelete,
  onEdit,
  onSelect,
  getIcon
}: { 
  entry: any, 
  isOpen: boolean,
  onOpenStateChange: (open: boolean) => void,
  onDelete: (id: number | string) => void,
  onEdit: (id: number) => void,
  onSelect: () => void,
  getIcon: (mainCat: string, subCat?: string) => React.ReactNode
}) {
  const x = useMotionValue(0);
  const isGroup = entry.type === 'group';
  const tx = isGroup ? entry.data[0] : entry.data;
  const amount = isGroup ? entry.totalAmount : tx.amount;

  let displayStatus = tx.status;
  if (isGroup) {
    const allReconciled = entry.data.every((t: any) => t.status === "reconciled");
    const anyConfirmedOrReconciled = entry.data.some((t: any) => t.status === "confirmed" || t.status === "reconciled");
    if (allReconciled) displayStatus = "reconciled";
    else if (anyConfirmedOrReconciled) displayStatus = "confirmed";
    else displayStatus = "pending";
  }

  const buttonOpacity = useTransform(x, [-140, -40, 0], [1, 0, 0]);
  const buttonScale = useTransform(x, [-140, -40, 0], [1, 0.5, 0.5]);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x < -30) onOpenStateChange(true);
    else onOpenStateChange(false);
  };

  return (
    <div className="relative w-full overflow-hidden bg-bg-base">
      <div className="absolute inset-x-0 inset-y-0 flex items-center justify-between px-item z-0 pointer-events-none">
        <div /> 
        <div className="flex items-center gap-item h-full pointer-events-auto">
           {!isGroup && (
               <motion.button 
                style={{ opacity: buttonOpacity, scale: buttonScale }}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); tx.id && onEdit(tx.id); onOpenStateChange(false); }}
                className="size-icon-container rounded-button flex items-center justify-center bg-surface-glass text-text-secondary active:bg-brand-primary/20 active:text-brand-primary active:opacity-active transition-all duration-fast ease-apple border border-border-subtle"
              >
               <Edit2 className="size-icon-md" />
             </motion.button>
           )}
            <motion.button 
              style={{ opacity: buttonOpacity, scale: buttonScale }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); (tx.id || entry.id) && onDelete(isGroup ? entry.id : tx.id); onOpenStateChange(false); }}
              className="size-icon-container rounded-button flex items-center justify-center bg-semantic-danger text-text-primary active:bg-semantic-danger/80 active:opacity-active transition-all duration-fast ease-apple shadow-lg shadow-semantic-danger/20"
            >
             <Trash2 className="size-icon-md" />
           </motion.button>
        </div>
      </div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={0.05}
        animate={{ x: isOpen ? -160 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onDragStart={() => {
           if (!isOpen) onOpenStateChange(true);
        }}
        onDragEnd={handleDragEnd}
        onClick={onSelect}
        className="relative z-10 p-item flex items-center justify-between bg-surface-primary active:bg-surface-glass active:opacity-active transition-all duration-fast ease-apple"
      >
        <div className="flex items-center gap-item flex-1 min-w-0">
          <div className="size-icon-container rounded-button bg-bg-base flex items-center justify-center relative shrink-0 shadow-inner">
            {isGroup ? <ICON_MAP.Box className="size-icon-md text-brand-primary" /> : getIcon(tx.main_category, tx.sub_category)}
            {/* Logic for getIcon in AccountDetailView is simpler here for now */}
            {isGroup && (
              <div className="absolute -top-1 -right-1 bg-surface-glass-heavy text-text-secondary text-caption font-h2 size-icon-sm rounded-button flex items-center justify-center border-thick border-bg-base">
                {entry.data.length}
              </div>
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-body text-h3 tracking-tight text-text-primary truncate">
              {isGroup ? entry.merchant : (tx.item_name || tx.merchant || tx.main_category)}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-text-tertiary text-caption font-caption truncate tracking-wide shrink">
                {isGroup 
                  ? Array.from(new Set(entry.data.map((t: any) => t.main_category))).join(' · ')
                  : `${tx.main_category} · ${tx.sub_category}`
                }
              </span>
              {(displayStatus === "confirmed" || displayStatus === "reconciled") && (
                <span className={`text-[10px] px-1 py-[1px] rounded-[3px] tracking-wide shrink-0 leading-none ${
                  displayStatus === "reconciled" 
                    ? "text-text-secondary bg-surface-glass-heavy" 
                    : "text-text-tertiary bg-transparent border border-border-subtle"
                }`}>
                  {displayStatus === "reconciled" ? "已對帳" : "已確認"}
                </span>
              )}
              {displayStatus === "scheduled" && (
                <span className="text-[10px] px-1 py-[1px] rounded-[3px] tracking-wide shrink-0 leading-none text-text-tertiary bg-surface-glass-heavy border border-border-subtle">
                  未入帳
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center shrink-0 pl-item">
          <span className="font-h2 text-h3 tabular-nums tracking-tighter text-text-primary">
            ${Math.abs(amount).toLocaleString()}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
