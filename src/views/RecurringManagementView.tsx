import { useState, useMemo } from "react";
import { ChevronLeft, Repeat, Play, Pause, Trash2, Calendar, Clock, CreditCard, Info, DollarSign, CheckCircle2, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, RecurringRule, Transaction, deleteTransaction } from "@/db/db";
import SwipeableDelete from "@/components/SwipeableDelete";
import TransactionDetailView from "./TransactionDetailView";
import TransactionFormView from "./TransactionFormView";
import ConfirmModal from "@/components/ConfirmModal";

interface RecurringManagementViewProps {
  onBack: () => void;
}

export default function RecurringManagementView({ onBack }: RecurringManagementViewProps) {
  const allRules = useLiveQuery(() => db.recurringRules.toArray()) || [];
  const [swipedId, setSwipedId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<"installment" | "recurring">("installment");
  const [selectedRule, setSelectedRule] = useState<RecurringRule | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [isDeletingRecurring, setIsDeletingRecurring] = useState(false);

  const ruleTransactions = useLiveQuery(
    () => (selectedRule ? db.transactions.where("rule_id").equals(selectedRule.id!).toArray() : []),
    [selectedRule]
  ) || [];

  const formatFrequency = (freq: string, interval?: number) => {
    const unit = freq === 'daily' ? '天' : freq === 'weekly' ? '週' : freq === 'monthly' ? '個月' : '年';
    return `每 ${interval || 1} ${unit}`;
  };

  const activeRules = allRules.filter(r => r.is_active && r.type === viewType).sort((a, b) => new Date(a.next_generation_date).getTime() - new Date(b.next_generation_date).getTime());
  const inactiveRules = allRules.filter(r => !r.is_active && r.type === viewType).sort((a, b) => new Date(b.next_generation_date).getTime() - new Date(a.next_generation_date).getTime());

  const deleteRule = async (id: number) => {
    await db.recurringRules.delete(id);
    if (selectedRule?.id === id) setSelectedRule(null);
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
    await deleteTransaction(idOrGroupId);
  };

  const executeDelete = async () => {
    if (deleteId) {
      await deleteTransaction(deleteId);
      setDeleteId(null);
      setIsDeletingRecurring(false);
    }
  };

  const renderRuleGroup = (title: string, rules: RecurringRule[]) => {
    if (rules.length === 0) return null;
    return (
      <div className="flex flex-col gap-inner">
        <h3 className="text-caption font-caption text-text-tertiary px-inner uppercase tracking-wide opacity-50">{title}</h3>
        <div className="flex flex-col gap-inner px-px">
          {rules.map((rule, index) => {
            const template = rule.template_transaction as any;
            const items = template?.items || [];
            const isInstallment = rule.type === 'installment';

            const displayTitle = (items.length > 1 && template.merchant)
              ? template.merchant
              : (items[0]?.item_name || template.merchant || '未命名排程');

            const totalAmount = Math.abs(rule.total_amount || template?.amount || (items.reduce((acc: number, item: any) => acc + (item.amount || 0), 0)) || 0);
            const perAmount = isInstallment && rule.total_installments
              ? Math.ceil(totalAmount / rule.total_installments)
              : totalAmount;

            return (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={() => setSelectedRule(rule)}
                className="group relative mb-4"
              >
                <SwipeableDelete
                  onDelete={() => deleteRule(rule.id!)}
                  isOpen={swipedId === rule.id}
                  onOpenStateChange={(open) => setSwipedId(open ? rule.id || null : null)}
                >
                  <div className="w-full bg-surface-primary rounded-xl border border-border-subtle p-4 flex flex-col active:bg-surface-glass transition-all duration-normal ease-apple cursor-pointer group-active:scale-[0.98]">
                    {/* Header: Title & Status */}
                    <div className="flex justify-between items-center">
                      <span className="text-body font-h3 text-text-primary truncate pr-4">
                        {displayTitle}
                      </span>
                      {rule.is_active ? (
                        <span className="whitespace-nowrap bg-surface-glass text-brand-primary border border-border-subtle px-2 py-1 rounded-inner text-caption font-medium">
                          進行中
                        </span>
                      ) : (
                        <span className="whitespace-nowrap bg-surface-glass text-text-tertiary border border-border-subtle px-2 py-1 rounded-inner text-caption font-medium">
                          已結束
                        </span>
                      )}
                    </div>

                    {/* Primary Info Area: Amount */}
                    <div className="mt-3 flex items-baseline gap-2 truncate">
                      <div className="text-2xl font-bold text-text-primary leading-none">
                        ${(isInstallment ? perAmount : totalAmount).toLocaleString()}
                        <span className="text-caption font-normal text-text-tertiary ml-1">
                          {isInstallment ? '/ 每期' : '/ 每次'}
                        </span>
                      </div>
                      <div className="text-caption text-text-tertiary truncate opacity-70">
                        (總額: ${totalAmount.toLocaleString()})
                      </div>
                    </div>

                    {/* Secondary Info Area: Details */}
                    <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between items-center text-caption text-text-secondary">
                      <div className="flex items-center gap-1.5 grayscale opacity-70">
                        <Repeat className="size-icon-xs" />
                        {formatFrequency(rule.frequency, rule.interval)}
                      </div>
                      <div className="font-h3 tracking-tight">
                        下次: {rule.next_generation_date}
                      </div>
                      {isInstallment && (
                        <div>
                          進度: {rule.installments_paid || 0}/{rule.total_installments}
                        </div>
                      )}
                    </div>
                  </div>
                </SwipeableDelete>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const RuleDetailModal = () => {
    if (!selectedRule) return null;

    const template = selectedRule.template_transaction as any;
    const items = template?.items || [];
    const itemName = items[0]?.item_name || template.merchant || "未命名項目";

    const sortedTxs = [...ruleTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalAmount = selectedRule.total_amount || (selectedRule.type === 'installment' ? (template.amount * (selectedRule.total_installments || 1)) : template.amount) || 0;
    const paidAmount = ruleTransactions
      .filter(tx => tx.status === 'confirmed' || tx.status === 'reconciled')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const remainingAmount = Math.max(0, Math.abs(totalAmount) - paidAmount);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-screen bg-bg-base/90 backdrop-blur-md"
        onClick={() => setSelectedRule(null)}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-surface-primary rounded-[24px] border border-border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Minimal Header */}
          <div className="flex flex-col px-item pt-item pb-INNER items-center text-center shrink-0">
            <h2 className="text-body font-h2 text-text-primary tracking-tight truncate w-full px-4">{itemName}</h2>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-item flex flex-col gap-section">
            {/* Minimal Summary Box */}
            <div className="flex justify-between px-inner">
              <div className="flex flex-col items-center flex-1">
                <span className="text-[11px] font-caption text-text-tertiary uppercase tracking-wider mb-0.5">總額</span>
                <span className="text-body font-body tabular-nums text-text-secondary">${totalAmount.toLocaleString()}</span>
              </div>
              <div className="w-[1px] h-8 bg-border-subtle self-center opacity-30" />
              <div className="flex flex-col items-center flex-1">
                <span className="text-[11px] font-caption text-text-tertiary uppercase tracking-wider mb-0.5">{selectedRule.type === 'installment' ? '已繳' : '累計'}</span>
                <span className="text-body font-body tabular-nums text-text-primary">${paidAmount.toLocaleString()}</span>
              </div>
              <div className="w-[1px] h-8 bg-border-subtle self-center opacity-30" />
              <div className="flex flex-col items-center flex-1">
                <span className="text-[11px] font-caption text-text-tertiary uppercase tracking-wider mb-0.5">剩餘</span>
                <span className="text-body font-body tabular-nums text-text-tertiary">${remainingAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 py-3 border-y border-hairline border-border-subtle">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-tertiary flex items-center gap-2">
                  <Calendar className="size-3.5 opacity-50" /> 預計週期
                </span>
                <span className="text-text-secondary font-body">{formatFrequency(selectedRule.frequency, selectedRule.interval)}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-tertiary flex items-center gap-2">
                  <Repeat className="size-3.5 opacity-50" /> 當前進度
                </span>
                <span className="text-text-secondary font-body">
                  {selectedRule.type === 'installment' ? `${selectedRule.installments_paid || 0} / ${selectedRule.total_installments}` : "定期產生"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-tertiary flex items-center gap-2">
                  <Clock className="size-3.5 opacity-50" /> 下次預計
                </span>
                <span className="text-text-secondary font-body">{selectedRule.next_generation_date}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-caption text-text-tertiary px-inner uppercase tracking-widest text-center">交易明細</h3>
              <div className="flex flex-col gap-1">
                {sortedTxs.length === 0 ? (
                  <div className="p-8 text-center text-text-tertiary opacity-30 flex flex-col items-center gap-2">
                    <Info className="size-8" strokeWidth={1} />
                    <span className="text-[12px]">無交易紀錄</span>
                  </div>
                ) : (
                  sortedTxs.map((tx) => {
                    const isConfirmed = tx.status === 'confirmed' || tx.status === 'reconciled';
                    const isPending = tx.status === 'pending';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="py-inner px-inner rounded-inner flex items-center justify-between active:bg-surface-glass transition-colors cursor-pointer group"
                      >
                        <div className="flex flex-col">
                          <span className="text-[13px] font-body text-text-secondary group-active:text-text-primary">{tx.date}</span>
                          <div className="mt-0.5">
                            {isConfirmed ? (
                              <span className="text-[10px] text-text-tertiary opacity-60">已入帳</span>
                            ) : isPending ? (
                              <span className="px-1 py-0.5 rounded-[4px] bg-surface-glass text-text-secondary text-[9px] font-h3 uppercase tracking-wider border border-border-subtle">
                                待審核
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-tertiary opacity-60">未發生</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[14px] font-body tabular-nums text-text-primary">
                          ${Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <div className="p-item bg-surface-primary shrink-0">
            <button
              onClick={() => setSelectedRule(null)}
              className="w-full py-3 rounded-button bg-surface-glass text-text-secondary font-h3 active:scale-[0.98] active:bg-surface-glass-heavy transition-all border border-border-subtle text-[14px]"
            >
              關閉
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className="fixed inset-0 z-modal bg-bg-base flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <button onClick={onBack} className="p-inner -ml-inner rounded-button active:bg-surface-glass-heavy transition-colors ease-apple group flex items-center">
          <ChevronLeft className="size-icon-lg text-text-tertiary group-active:text-text-primary transition-colors" />
        </button>
        <div className="flex items-center gap-2">
          <Repeat className="size-icon-md text-brand-primary" />
          <h1 className="text-h3 font-h3 text-text-primary tracking-tight leading-tight">分期與定期管理</h1>
        </div>
        <div className="w-10"></div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-screen py-section flex flex-col gap-section pb-nav-clearance">
        <div className="flex bg-surface-glass p-1 rounded-button border border-hairline border-border-subtle shrink-0">
          <button
            onClick={() => setViewType('installment')}
            className={`flex-1 py-3 rounded-full text-caption font-h3 tracking-wide transition-all ease-apple ${viewType === 'installment' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            分期付款
          </button>
          <button
            onClick={() => setViewType('recurring')}
            className={`flex-1 py-3 rounded-full text-caption font-h3 tracking-wide transition-all ease-apple ${viewType === 'recurring' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            定期紀錄
          </button>
        </div>

        {activeRules.length === 0 && inactiveRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-tertiary gap-item py-20 opacity-50">
            <Repeat className="size-avatar-lg" />
            <span className="text-body font-body text-text-secondary">目前沒有設定任何規則</span>
          </div>
        ) : (
          <div className="flex flex-col gap-section">
            {renderRuleGroup(viewType === "installment" ? "進行中的分期" : "執行中的規則", activeRules)}
            {renderRuleGroup(viewType === "installment" ? "已結束的分期" : "已暫停或結束的規則", inactiveRules)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRule && <RuleDetailModal />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-[100]">
            <TransactionDetailView
              transactions={selectedTx}
              onBack={() => setSelectedTx(null)}
              onEdit={(tx) => {
                setEditingTx(tx);
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
                const txs = Array.isArray(selectedTx) ? (selectedTx as any[]) : [selectedTx];
                const copiedTxs = txs.map(tx => {
                  const { id, group_id, rule_id, status, ...rest } = tx;
                  return { ...rest, status: 'confirmed' } as any;
                });
                setEditingTx(copiedTxs);
                setSelectedTx(null);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTx && (
          <TransactionFormView
            initialData={editingTx}
            onBack={() => setEditingTx(null)}
            onSave={() => setEditingTx(null)}
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
    </motion.div>
  );
}

