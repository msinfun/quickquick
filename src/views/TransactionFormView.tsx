import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Info, BrainCircuit, Mic, Calendar, Database, Box, Tag, CreditCard, Hash, LayoutGrid, AlertTriangle, Loader2, Save, Plus, Trash2, ArrowRight, X, Repeat, Store, CheckCircle, Percent } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addTransaction, deleteTransaction } from "@/db/db";
import SwipeableDelete from "@/components/SwipeableDelete";
import { ICON_MAP } from "@/constants/icons";
import { calculateNextDate } from "@/services/dateUtils";
import { GeminiService } from "@/services/geminiService";

interface Transaction {
  id?: number;
  date: string;
  type: "expense" | "income" | "transfer";
  main_category: string;
  sub_category: string;
  account_id?: number;
  amount: number;
  item_name?: string;
  merchant?: string;
  invoice_number?: string;
  note?: string;
  status?: string;
  group_id?: string;
  rule_id?: number;
}

interface TransactionFormViewProps {
  initialData?: Transaction | Transaction[] | null;
  onSave: (transaction: any) => void;
  onBack: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

export default function TransactionFormView({ initialData, onSave, onBack }: TransactionFormViewProps) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [sharedInfo, setSharedInfo] = useState({
    date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
    account_id: undefined as number | undefined,
    merchant: "",
    invoice_number: "",
    note: ""
  });

  const [pickingCategoryIdx, setPickingCategoryIdx] = useState<number | null>(null);
  const [swipedId, setSwipedId] = useState<string | number | null>(null);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState<{
    enabled: boolean;
    type: "recurring" | "installment";
    interval: number;
    frequency: "day" | "week" | "month" | "year";
    dayOfCycle: number;
    occurrenceCount: number;
    totalAmount: number;
    interestRate: number;
    roundingMethod: 'round' | 'ceil' | 'floor';
    remainderStrategy: 'first' | 'last';
    totalInstallments: number;
  }>({
    enabled: false,
    type: "recurring",
    interval: 1,
    frequency: "month",
    dayOfCycle: new Date().getDate(),
    occurrenceCount: 0,
    totalAmount: 0,
    interestRate: 0,
    roundingMethod: 'round',
    remainderStrategy: 'last',
    totalInstallments: 12
  });
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [groupEditPrompt, setGroupEditPrompt] = useState<{isOpen: boolean, relatedCount: number, hasRule?: boolean} | null>(null);
  const [loadingCategoryIdx, setLoadingCategoryIdx] = useState<number | null>(null);

  const isExistingInstallment = useMemo(() => {
    if (!initialData) return false;
    const dataArray = Array.isArray(initialData) ? initialData : [initialData];
    if (dataArray.length === 0) return false;
    const firstTx = dataArray[0];
    return !!(firstTx.id && firstTx.group_id && firstTx.item_name?.includes("期)"));
  }, [initialData]);

  // Fetch contextual data
  const categoriesSetting = useLiveQuery(() =>
    db.settings.where("key").equals("categories").first()
  );
  const geminiKeySetting = useLiveQuery(() => db.settings.where("key").equals("gemini_api_key").first());
  const hasApiKey = geminiKeySetting?.value && geminiKeySetting.value.trim() !== "";

  const categoriesList = (categoriesSetting?.value as any[]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  useEffect(() => {
    if (initialData) {
      const dataArray = Array.isArray(initialData) ? initialData : [initialData];
      setItems(dataArray.map(item => ({ ...item, tempId: (item as any).tempId || generateId() })));
      if (dataArray.length > 0) {
        const first = dataArray[0];
        setSharedInfo({
          date: first.date,
          account_id: first.account_id,
          merchant: first.merchant || "",
          invoice_number: first.invoice_number || "",
          note: first.note || ""
        });
      }
    } else {
      // Default new transaction
      setItems([{
        date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
        type: "expense",
        main_category: "飲食",
        sub_category: "其他",
        account_id: undefined,
        amount: 0,
        item_name: "",
        tempId: generateId()
      } as any]);
    }
  }, [initialData, accounts.length]);

  const totalAmount = useMemo(() => items.reduce((acc, t) => acc + t.amount, 0), [items]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // Validation: account_id must be selected
    if (!sharedInfo.account_id) {
      setValidationError("請先選擇付款帳戶");
      setIsSaving(false);
      return;
    }

    const remainingItems = items.filter(item => item.amount !== 0 || item.item_name);
    if (remainingItems.length === 0 && deletedIds.length === 0) {
      setIsSaving(false);
      onBack();
      return;
    }

    const firstInitial = Array.isArray(initialData) ? initialData[0] : initialData;
    const hasRule = !!(firstInitial?.rule_id || remainingItems.some(it => it.rule_id));
    const groupId = remainingItems[0]?.group_id || (firstInitial as any)?.group_id;
    const hasGroupId = !!groupId;
    const isEditMode = !!(firstInitial?.id || remainingItems.some(it => it.id));

    if (isEditMode && !groupEditPrompt) {
      const relatedGroupCount = hasGroupId ? await db.transactions.where('group_id').equals(groupId).count() : 0;
      
      if (hasRule || relatedGroupCount > 1) {
        setGroupEditPrompt({ 
          isOpen: true, 
          relatedCount: relatedGroupCount,
          hasRule: hasRule
        });
        setIsSaving(false); // 彈出選項時解除儲存中狀態，讓使用者可重新操作
        return; 
      }
    }
    
    await executeSave(false, false);
  };

  const executeSave = async (applyToAll: boolean, applyToRule: boolean) => {
    setGroupEditPrompt(null);
    try {
      const remainingItems = items.filter(item => item.amount !== 0 || item.item_name);

      // Determine group_id/rule_id
      const groupId = remainingItems.length > 1 ? (remainingItems[0].group_id || generateId()) : remainingItems[0]?.group_id;
      const ruleId = remainingItems[0]?.rule_id;

      await db.transaction('rw', [db.transactions, db.accounts, db.recurringRules], async () => {
        // 1. Physically delete items removed in UI
        if (deletedIds.length > 0) {
          for (const id of deletedIds) {
            const tx = await db.transactions.get(id);
            if (tx) {
              // Manually revert account balance if not pending
              if (tx.status !== 'pending' && tx.account_id !== undefined) {
                const account = await db.accounts.get(tx.account_id);
                if (account) {
                  await db.accounts.update(tx.account_id, { 
                    current_balance: account.current_balance - tx.amount 
                  });
                }
              }
              await db.transactions.delete(id);
            }
          }
        }

        // 【新增】規則連動修改邏輯 (更新 RecurringRule 範本與其餘 Pending 交易)
        if (applyToRule && ruleId) {
          const rule = await db.recurringRules.get(ruleId);
          if (rule) {
            const newTemplate = {
              ...rule.template_transaction,
              ...sharedInfo,
              items: remainingItems.map(({id, tempId, ...rest}: any) => rest)
            };
            
            if (remainingItems.length === 1) {
              const sign = remainingItems[0].type === 'expense' ? -1 : 1;
              newTemplate.amount = Math.abs(remainingItems[0].amount) * sign;
              newTemplate.main_category = remainingItems[0].main_category;
              newTemplate.sub_category = remainingItems[0].sub_category;
              newTemplate.item_name = remainingItems[0].item_name;
            }

            await db.recurringRules.update(ruleId, { template_transaction: newTemplate });

            const pendingTxs = await db.transactions.where('rule_id').equals(ruleId).filter(t => t.status === 'pending').toArray();
            for (const pTx of pendingTxs) {
              if (pTx.id === remainingItems[0].id) continue;
              
              await db.transactions.update(pTx.id!, {
                ...sharedInfo,
                main_category: remainingItems[0].main_category,
                sub_category: remainingItems[0].sub_category,
                amount: remainingItems[0].amount,
                item_name: remainingItems[0].item_name,
                merchant: sharedInfo.merchant,
                account_id: sharedInfo.account_id,
                note: sharedInfo.note
              });
            }
          }
        }

        // 2. 群組連動修改邏輯 (更新同個 groupId 的商家、帳戶與備註)
        if (applyToAll && groupId) {
          const relatedTxs = await db.transactions.where('group_id').equals(groupId).toArray();
          for (const rTx of relatedTxs) {
            if (rTx.id === remainingItems[0].id) continue;

            if (['confirmed', 'completed', 'reconciled'].includes(rTx.status || '')) {
              if (rTx.account_id) {
                const oldAcc = await db.accounts.get(rTx.account_id);
                if (oldAcc) await db.accounts.update(rTx.account_id, { current_balance: oldAcc.current_balance - rTx.amount });
              }
              if (sharedInfo.account_id) {
                const newAcc = await db.accounts.get(sharedInfo.account_id);
                if (newAcc) await db.accounts.update(sharedInfo.account_id, { current_balance: newAcc.current_balance + rTx.amount });
              }
            }

            await db.transactions.update(rTx.id!, {
              account_id: sharedInfo.account_id,
              merchant: sharedInfo.merchant,
              note: sharedInfo.note,
              status: "confirmed"
            });
          }
        }

        // 3. 處理「進階分期 re-gen」（僅當使用者明確在進階面板啟動且不是單純的規則同步時）
        if (advancedConfig.enabled && advancedConfig.type === 'installment' && !applyToRule) {
          for (const item of remainingItems) {
            if (item.id) {
              const old = await db.transactions.get(item.id);
              if (old) {
                if (old.account_id && (old.status === 'confirmed' || old.status === 'completed' || old.status === 'reconciled')) {
                  const acc = await db.accounts.get(old.account_id);
                  if (acc) await db.accounts.update(old.account_id, { current_balance: acc.current_balance - old.amount });
                }
                await db.transactions.delete(item.id); // This is part of installment re-gen, balance revert already handled above
              }
            }
          }

          const N = advancedConfig.totalInstallments;
          const total = advancedConfig.totalAmount || totalAmount;
          const baseItem = remainingItems[0] || items[0];
          const sign = baseItem.type === 'expense' ? -1 : (baseItem.type === 'income' ? 1 : -1);
          const absoluteTotal = Math.abs(total);
          
          let baseAmount = Math.floor(absoluteTotal / N);
          if (advancedConfig.roundingMethod === 'ceil') {
            baseAmount = Math.ceil(absoluteTotal / N);
          } else if (advancedConfig.roundingMethod === 'round') {
            baseAmount = Math.round(absoluteTotal / N);
          }
          
          const remainder = absoluteTotal - (baseAmount * N);
          const installmentGroupId = generateId();
          
          const today = new Date();
          const todayStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

          // Create tracking rule for AutomationListView
          const freqMap: Record<string, string> = {
            'day': 'daily',
            'week': 'weekly',
            'month': 'monthly',
            'year': 'yearly'
          };

          const ruleId = await db.recurringRules.add({
            template_transaction: {
              ...sharedInfo,
              group_id: installmentGroupId,
              items: remainingItems.map(({ id, ...rest }) => rest)
            } as any,
            frequency: (freqMap[advancedConfig.frequency] || 'monthly') as any,
            type: "installment",
            interval: advancedConfig.interval || 1,
            total_amount: total,
            total_installments: N,
            installments_paid: 1, // Phase 1 creates the first install!
            start_date: sharedInfo.date,
            next_generation_date: calculateNextDate(sharedInfo.date, (freqMap[advancedConfig.frequency] || 'monthly') as any, advancedConfig.interval),
            is_active: true
          });

          // Prepare Period 1
          const [y, m, d] = sharedInfo.date.split('/').map(Number);
          const ty = y;
          const tm = String(m).padStart(2, '0');
          const td = String(d).padStart(2, '0');
          const currentPeriodDateStr = `${ty}/${tm}/${td}`;

          let amount1 = baseAmount;
          if (advancedConfig.remainderStrategy === 'first') amount1 += remainder;
          const finalAmount1 = amount1 * sign;

          const baseName = baseItem.item_name || baseItem.main_category;
          const periodName = `${baseName} (第 1/${N} 期)`;
          const status = "confirmed"; // 手動建立的第一期固定為已確認狀態

          const finalTx = {
            ...baseItem,
            ...sharedInfo,
            date: currentPeriodDateStr,
            amount: finalAmount1,
            item_name: periodName,
            group_id: installmentGroupId,
            status: status,
            rule_id: ruleId as number
          };
          
          delete finalTx.id;
          delete (finalTx as any).tempId;

          await db.transactions.add(finalTx);

          if (status === "confirmed" && sharedInfo.account_id) {
             const acc = await db.accounts.get(sharedInfo.account_id);
             if (acc) {
               await db.accounts.update(sharedInfo.account_id, { current_balance: acc.current_balance + finalAmount1 });
             }
          }
        } else {
          // 2. Save remaining items
          const savedIds: number[] = [];
          for (const item of remainingItems) {
            const finalAmount = item.type === 'expense' ? -Math.abs(Number(item.amount)) : Math.abs(Number(item.amount));
            const finalTx = {
              ...item,
              ...sharedInfo,
              amount: finalAmount,
              group_id: groupId,
              status: "confirmed"
            };

            if (item.id) {
              const old = await db.transactions.get(item.id);
              if (old) {
                if (old.account_id && ['confirmed', 'completed', 'reconciled'].includes(old.status || '')) {
                  const oldAcc = await db.accounts.get(old.account_id);
                  if (oldAcc) await db.accounts.update(old.account_id, { current_balance: oldAcc.current_balance - old.amount });
                }

                  const isNewApplied = finalTx.status === 'confirmed' || finalTx.status === 'completed' || finalTx.status === 'reconciled';
                  if (sharedInfo.account_id && isNewApplied) {
                    const newAcc = await db.accounts.get(sharedInfo.account_id);
                    if (newAcc) await db.accounts.update(sharedInfo.account_id, { current_balance: newAcc.current_balance + finalAmount });
                  }
                }
              await db.transactions.update(item.id, finalTx);
              savedIds.push(item.id);
            } else {
              const newId = (await addTransaction(finalTx)) as number;
              savedIds.push(newId);
            }
          }

          // 3. Handle Advanced Rules
          if (advancedConfig.enabled) {
            const frequencyMap: Record<string, "daily" | "weekly" | "monthly" | "bi-monthly" | "quarterly" | "yearly"> = {
              'day': 'daily',
              'week': 'weekly',
              'month': 'monthly',
              'year': 'yearly'
            };

            const ruleId = await db.recurringRules.add({
              template_transaction: {
                ...sharedInfo,
                group_id: groupId,
                items: remainingItems.map(({ id, ...rest }) => rest)
              } as any,
              frequency: frequencyMap[advancedConfig.frequency] || 'monthly',
              type: advancedConfig.type,
              interval: advancedConfig.interval,
              day_of_cycle: advancedConfig.dayOfCycle,
              occurrence_count: advancedConfig.occurrenceCount > 0 ? advancedConfig.occurrenceCount : undefined,
              total_amount: advancedConfig.type === 'installment' ? (advancedConfig.totalAmount || totalAmount) : undefined,
              interest_rate: advancedConfig.interestRate,
              rounding_method: advancedConfig.roundingMethod,
              remainder_strategy: advancedConfig.remainderStrategy,
              total_installments: advancedConfig.type === 'installment' ? advancedConfig.totalInstallments : undefined,
              installments_paid: advancedConfig.type === 'installment' ? 1 : undefined,
              start_date: sharedInfo.date,
              next_generation_date: calculateNextDate(sharedInfo.date, advancedConfig.frequency, advancedConfig.interval),
              is_active: true
            });

            if (savedIds.length > 0) {
              await db.transactions.bulkUpdate(savedIds.map(id => ({ key: id, changes: { rule_id: ruleId } })));
            }
          }
        }
      });

      onSave(remainingItems.length > 1 ? remainingItems : remainingItems[0]);
    } catch (error) {
      console.error("Save error:", error);
      setIsSaving(false);
    }
  };

  const getIconName = (mainCat: string, subCat?: string) => {
    const main = categoriesList.find(c => c.name === mainCat);
    if (!main) return "Tag";
    const sub = main.subCategories?.find((s: any) => s.name === subCat);
    return sub?.iconName || main.iconName || "Tag";
  };

  const renderIcon = (name: string, className: string = "size-icon-sm text-brand-primary") => {
    const IconComponent = ICON_MAP[name] || Box;
    return <IconComponent className={className} />;
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed inset-0 z-modal bg-bg-base flex flex-col gap-section overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav sticky top-0 z-nav transition-all duration-normal ease-apple">
        <button onClick={onBack} className="p-inner -ml-inner rounded-button active:bg-surface-glass-heavy transition-colors">
          <ChevronLeft className="size-icon-lg text-brand-primary" />
        </button>
        <h1 className="text-h3 font-h3 tracking-tight text-text-primary whitespace-nowrap leading-tight">編輯交易</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-item py-1.5 rounded-button bg-brand-primary text-bg-base font-h3 active:scale-95 transition-all ease-apple ${isSaving ? 'opacity-50' : ''}`}
        >
          {isSaving ? <Loader2 className="size-icon-md animate-spin" /> : "儲存"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-screen pb-nav-clearance flex flex-col gap-section bg-bg-base">
        {/* Top Amount Region */}
        <div className="flex flex-col items-center py-[var(--size-icon-container)]">
          <span className={`text-[2.5rem] font-h2 tabular-nums tracking-tighter leading-none ${totalAmount < 0 ? 'text-semantic-danger' : 'text-brand-primary'}`}>
            ${Math.abs(totalAmount).toLocaleString()}
          </span>
          <div className="mt-item px-item py-1.5 rounded-button bg-surface-glass border border-hairline border-border-subtle text-caption font-caption uppercase tracking-wide text-text-tertiary">
            編輯總金額與共用資訊
          </div>
        </div>

        {/* Section 1: Shared Info Hub (Grouped Card) */}
        <div className="bg-surface-primary rounded-card p-item border border-hairline border-border-subtle grid grid-cols-2 gap-item shadow-sm">
          <EditField
            label="日期"
            icon={<Calendar className="size-icon-md" />}
            type="date"
            value={sharedInfo.date.replace(/\//g, '-')}
            onChange={(v: string) => setSharedInfo(prev => ({ ...prev, date: v.replace(/-/g, '/') }))}
          />
          <div className="flex flex-col gap-micro py-micro group relative overflow-hidden focus-within:bg-bg-base/40 rounded-inner transition-colors">
            <div className="flex items-center gap-inner">
              <CreditCard className="size-icon-md text-brand-primary scale-75 origin-left" />
              <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide leading-none">帳戶</span>
            </div>
            <select
              value={sharedInfo.account_id || ""}
              onChange={(e) => setSharedInfo(prev => ({ ...prev, account_id: e.target.value ? Number(e.target.value) : undefined }))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              <option value="">請選擇帳戶</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
            <span className={`font-h3 text-body leading-normal truncate ${!sharedInfo.account_id ? 'text-semantic-danger font-medium' : 'text-text-primary'}`}>
              {accounts.find(a => a.id === sharedInfo.account_id)?.name || "請選擇帳戶"}
            </span>
          </div>
          <EditField
            label="商家"
            icon={<Store className="size-icon-md" />}
            value={sharedInfo.merchant}
            onChange={(v: string) => setSharedInfo(prev => ({ ...prev, merchant: v }))}
            placeholder="輸入商家..."
          />
          <EditField
            label="發票"
            icon={<Hash className="size-icon-md" />}
            value={sharedInfo.invoice_number}
            onChange={(v: string) => setSharedInfo(prev => ({ ...prev, invoice_number: v }))}
            placeholder="AB-12345678"
          />
        </div>

        {/* Section 2: Editable Items List (Grouped Card) */}
        <div className="flex flex-col gap-inner">
          <div className="flex justify-between items-center mb-inner">
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide leading-none">編輯品項列表</span>
            <div className="flex items-center gap-item">
              {!isExistingInstallment && (
                <button
                  onClick={() => setShowAdvancedModal(true)}
                  className={`text-caption font-h3 px-item py-1.5 rounded-button flex items-center gap-1 active:scale-95 transition-all duration-fast ease-apple ${advancedConfig.enabled ? 'bg-brand-primary text-bg-base' : 'text-brand-primary bg-surface-glass border border-border-subtle'}`}
                >
                  <Repeat className="size-icon-sm" /> 進階
                </button>
              )}
              <button
                onClick={() => setItems(prev => [{ ...items[0], id: undefined, tempId: generateId(), amount: 0, item_name: "" } as any, ...prev])}
                className="text-caption font-caption text-brand-primary px-item py-1.5 rounded-button flex items-center gap-1 active:scale-95 transition-all duration-normal ease-apple border border-brand-primary/20"
              >
                <Plus className="size-icon-sm" /> 新增
              </button>
            </div>
          </div>

          <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle overflow-hidden shadow-sm">
            <AnimatePresence initial={false}>
              {items.map((item, idx) => {
                const itemKey = (item as any).id || (item as any).tempId;
                return (
                  <motion.div
                    key={itemKey}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, x: -200, height: 0 }}
                    className="relative overflow-hidden"
                  >
                    <SwipeableDelete
                      onDelete={() => {
                        const itemToDelete = items[idx];
                        if (itemToDelete.id) setDeletedIds(prev => [...prev, itemToDelete.id!]);
                        setItems(prev => prev.filter((_, i) => i !== idx));
                      }}
                      isOpen={swipedId === itemKey}
                      onOpenStateChange={(open: boolean) => setSwipedId(open ? itemKey : null)}
                    >
                      <div className="w-full p-item flex flex-col gap-inner bg-surface-primary active:bg-surface-glass-heavy transition-all duration-normal ease-apple border-b border-hairline border-border-subtle">
                        <div className="flex items-center gap-item">
                          <input
                            className="w-full bg-bg-base border border-hairline border-border-subtle rounded-input p-item text-body font-body text-text-primary placeholder:text-text-tertiary/40 focus:border-brand-primary/50 transition-all outline-none"
                            value={item.item_name || ""}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].item_name = e.target.value;
                              setItems(newItems);
                            }}
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (!val || val === "菜市場" || val === "超市" || val === "早餐") return;
                              
                              setLoadingCategoryIdx(idx);
                              try {
                                const categories = (await db.settings.where("key").equals("categories").first())?.value || [];
                                const res = await GeminiService.categorizeItem(val, categories);
                                if (res) {
                                  setItems(currentItems => {
                                    const updated = [...currentItems];
                                    if (updated[idx] && updated[idx].item_name?.trim() === val) {
                                      updated[idx].main_category = res.main_category || updated[idx].main_category;
                                      updated[idx].sub_category = res.sub_category || updated[idx].sub_category;
                                    }
                                    return updated;
                                  });
                                }
                              } finally {
                                setLoadingCategoryIdx(null);
                              }
                            }}
                            placeholder="品項名稱..."
                          />
                          <div className="flex items-center shrink-0 relative" style={{ width: "120px" }}>
                            <span className={`absolute left-item font-h3 ${
                              item.type === 'expense' ? 'text-semantic-danger' : 
                              item.type === 'income' ? 'text-brand-primary' : 
                              'text-text-tertiary'
                            }`}>$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              className={`w-full bg-bg-base border border-hairline border-border-subtle rounded-input p-item text-right text-h3 font-h3 outline-none focus:border-brand-primary/50 transition-all tabular-nums tracking-tight ${
                                item.type === 'expense' ? 'text-semantic-danger' : 
                                item.type === 'income' ? 'text-brand-primary' : 
                                'text-text-tertiary'
                              }`}
                              style={{ paddingLeft: "40px" }}
                              value={item.amount === 0 ? "" : Math.abs(item.amount)}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx].amount = (item.type === 'expense' ? -1 : 1) * Math.abs(e.target.value === "" ? 0 : Number(e.target.value));
                                setItems(newItems);
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setPickingCategoryIdx(idx)}
                            className={`flex items-center gap-inner rounded-button bg-bg-base border border-hairline border-border-subtle active:scale-[0.98] transition-all group/badge ${loadingCategoryIdx === idx ? 'opacity-70 animate-pulse' : ''}`}
                            style={{ padding: "6px 12px" }}
                          >
                            <div className="size-icon-md flex shrink-0 rounded-inner bg-bg-base items-center justify-center text-brand-primary">
                              {loadingCategoryIdx === idx ? <Loader2 className="size-icon-sm animate-spin" /> : renderIcon(getIconName(item.main_category, item.sub_category), "size-icon-sm")}
                            </div>
                            <div className="flex items-center gap-inner overflow-hidden">
                              <span className="text-caption font-medium text-text-secondary whitespace-nowrap">{item.main_category}</span>
                              <ChevronRight className="size-icon-sm text-text-tertiary shrink-0" />
                              <span className="text-caption font-medium text-text-secondary truncate">{item.sub_category}</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </SwipeableDelete>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Section 3: Notes (Grouped Card) */}
        <div className="flex flex-col gap-inner">
          <span className="text-caption font-caption text-text-tertiary px-inner-label uppercase tracking-wide">備註內容</span>
          <div className="bg-surface-primary rounded-card p-item border border-hairline border-border-subtle shadow-sm">
            <textarea
              value={sharedInfo.note}
              onChange={(e) => setSharedInfo(prev => ({ ...prev, note: e.target.value }))}
              placeholder="輸入備註說明..."
              style={{ minHeight: "100px" }}
              className="w-full bg-bg-base border border-hairline border-border-subtle rounded-input p-item text-body font-body text-text-primary placeholder:text-text-tertiary outline-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Advanced Settings Modal Overlay */}
      <AnimatePresence>
        {showAdvancedModal && (
          <AdvancedSettingsModal
            config={advancedConfig}
            onUpdate={setAdvancedConfig}
            totalAmount={totalAmount}
            onClose={() => setShowAdvancedModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Category Picker Overlay */}
      <AnimatePresence>
        {pickingCategoryIdx !== null && (
          <CategoryPicker
            categories={categoriesList}
            currentMain={items[pickingCategoryIdx!].main_category}
            currentSub={items[pickingCategoryIdx!].sub_category}
            currentType={items[pickingCategoryIdx!].type}
            onSelect={(main: string, sub: string, type: string) => {
              const newItems = [...items];
              const item = newItems[pickingCategoryIdx!];
              item.main_category = main;
              item.sub_category = sub;
              
              // If type changed, sync it and flip amount sign if necessary
              if (item.type !== type) {
                item.type = type as any;
                item.amount = (type === 'expense' ? -1 : 1) * Math.abs(item.amount);
              }
              
              setItems(newItems);
              setPickingCategoryIdx(null);
            }}
            onClose={() => setPickingCategoryIdx(null)}
          />
        )}
      </AnimatePresence>

      {/* Validation Error Modal */}
      <AnimatePresence>
        {validationError && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-section bg-bg-base/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-primary border border-border-subtle w-full max-w-sm p-section flex flex-col items-center gap-item text-center rounded-card shadow-dropdown ease-spring"
            >
              <h3 className="text-h2 font-h2 text-text-primary leading-tight">提示</h3>
              <p className="text-text-tertiary text-body leading-relaxed">{validationError}</p>
              <button 
                onClick={() => setValidationError(null)}
                className="w-full mt-2 py-item rounded-button bg-brand-primary text-bg-base font-h3 active:scale-95 transition-all ease-apple"
              >
                我知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupEditPrompt && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-section bg-bg-base/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-primary border border-border-subtle w-full max-w-sm p-section flex flex-col items-center gap-item text-center rounded-card shadow-dropdown ease-spring"
            >
              <h3 className="text-h2 font-h2 text-text-primary leading-tight">連動修改</h3>
              <p className="text-text-tertiary text-body leading-relaxed">
                {groupEditPrompt.hasRule 
                  ? "這是一筆具備「分期或循環規則」的交易。請問要連動修改未來的規則與尚未確認的期數嗎？"
                  : `這是一個具有 ${groupEditPrompt.relatedCount} 個項目的群組交易。請問是否要將修改套用至全部紀錄？`}
              </p>
              <div className="flex flex-col gap-inner w-full mt-2">
                <button 
                  onClick={() => executeSave(true, !!groupEditPrompt.hasRule)} 
                  className="w-full py-item rounded-button bg-brand-primary text-bg-base font-h3 active:scale-95 transition-all ease-apple"
                >
                  {groupEditPrompt.hasRule ? "修改此筆與未來全部" : `套用至全部 ${groupEditPrompt.relatedCount} 筆`}
                </button>
                <button 
                  onClick={() => executeSave(false, false)} 
                  className="w-full py-item rounded-button bg-surface-glass text-text-secondary font-h3 active:scale-95 transition-all ease-apple border border-border-subtle"
                >
                  僅修改此單筆紀錄
                </button>
                <button onClick={() => setGroupEditPrompt(null)} className="w-full py-item mt-1 text-text-tertiary text-caption font-h3 active:opacity-50 transition-all ease-apple">
                  取消儲存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CategoryPicker({ categories, currentMain, currentSub, currentType, onSelect, onClose }: any) {
  const [pickerType, setPickerType] = useState(currentType || "expense");
  const [selectedMain, setSelectedMain] = useState(currentMain);

  const filteredCategories = useMemo(() => {
    return categories.filter((c: any) => c.type === pickerType);
  }, [categories, pickerType]);

  const subCategories = useMemo(() => {
    return categories.find((c: any) => c.name === selectedMain)?.subCategories || [];
  }, [categories, selectedMain]);

  const handleTypeChange = (type: string) => {
    setPickerType(type);
    setSelectedMain("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-modal bg-bg-base/90 backdrop-blur-md flex flex-col ease-apple"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav sticky top-0 z-nav transition-all duration-normal ease-apple">
        <h3 className="text-h3 font-h3 text-text-primary tracking-tight leading-tight">選擇類別</h3>
        <button onClick={onClose} className="p-inner -ml-inner rounded-button active:bg-surface-glass-heavy transition-all duration-normal ease-apple">
          <X className="size-icon-lg text-text-secondary" />
        </button>
      </header>

      <div className="flex bg-surface-glass p-0.5 rounded-button border border-hairline border-border-subtle mx-screen mt-item mb-item shrink-0">
        <button 
          onClick={() => handleTypeChange("expense")}
          className={`flex-1 py-inner rounded-inner text-caption font-h3 uppercase tracking-wide transition-all ease-apple ${pickerType === 'expense' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
        >
          支出
        </button>
        <button 
          onClick={() => handleTypeChange("income")}
          className={`flex-1 py-inner rounded-inner text-caption font-h3 uppercase tracking-wide transition-all ease-apple ${pickerType === 'income' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
        >
          收入
        </button>
        <button 
          onClick={() => handleTypeChange("transfer")}
          className={`flex-1 py-inner rounded-inner text-caption font-h3 uppercase tracking-wide transition-all ease-apple ${pickerType === 'transfer' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
        >
          轉帳
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar px-screen py-section" style={{ gap: "40px" }}>
        {/* Main Categories Grid */}
        <div className="flex flex-col gap-section">
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide px-0.5">主類別</span>
          <div className="grid grid-cols-4 gap-x-inner gap-y-section">
            {filteredCategories.map((cat: any) => (
              <button
                key={cat.name}
                onClick={() => setSelectedMain(cat.name)}
                className={`flex flex-col items-center gap-2.5 transition-all duration-normal ease-apple group ${selectedMain === cat.name ? "scale-110" : "hover:scale-105"}`}
              >
                <div className={`rounded-inner flex items-center justify-center transition-all duration-normal relative ${
                  selectedMain === cat.name
                    ? "bg-brand-primary text-bg-base shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.3)]"
                    : "bg-surface-glass text-text-secondary group-hover:bg-surface-glass-heavy"
                }`} style={{ width: "48px", height: "48px" }}>
                  {ICON_MAP[cat.iconName] ? (
                    (() => {
                      const IconComponent = ICON_MAP[cat.iconName];
                      return <IconComponent className="size-icon-md" />;
                    })()
                  ) : <Tag className="size-icon-md" />}
                </div>
                <span className={`text-caption font-h3 tracking-tight text-center leading-tight transition-colors ${selectedMain === cat.name ? "text-brand-primary" : "text-text-secondary group-hover:text-text-secondary"}`}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub Categories Grid */}
        <div className="flex flex-col gap-section">
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide px-0.5">{selectedMain} · 次類別</span>
          <div className="grid grid-cols-4 gap-x-inner gap-y-section">
            {subCategories.map((sub: any) => {
              const isActive = currentSub === sub.name && currentMain === selectedMain && pickerType === currentType;
              return (
                <button
                  key={sub.name}
                  onClick={() => onSelect(selectedMain, sub.name, pickerType)}
                  className={`flex flex-col items-center gap-2 transition-all duration-normal ease-apple group ${isActive ? "scale-110" : "hover:scale-105"}`}
                >
                  <div className={`size-icon-container rounded-card flex shrink-0 items-center justify-center transition-all duration-normal ${
                    isActive
                      ? "bg-text-primary text-bg-base"
                      : "bg-bg-base/40 text-text-tertiary group-hover:bg-bg-base/60 group-hover:text-text-secondary border border-border-subtle"
                  }`}>
                    {ICON_MAP[sub.iconName] ? (
                      (() => {
                        const IconComponent = ICON_MAP[sub.iconName];
                        return <IconComponent className="size-icon-sm" />;
                      })()
                    ) : <Box className="size-icon-sm" />}
                  </div>
                  <span className={`font-body text-center leading-tight transition-colors ${isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-secondary"}`} style={{ fontSize: "11px" }}>
                    {sub.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AdvancedSettingsModal({ config, onUpdate, totalAmount, onClose }: any) {
  const installmentAmount = useMemo(() => {
    const principal = config.totalAmount || totalAmount;
    const rate = config.interestRate / 100;
    const n = config.totalInstallments;
    let monthly = (principal * (1 + rate)) / n;
    if (config.roundingMethod === 'ceil') return Math.ceil(monthly);
    if (config.roundingMethod === 'floor') return Math.floor(monthly);
    return Math.round(monthly);
  }, [config.totalAmount, totalAmount, config.interestRate, config.totalInstallments, config.roundingMethod]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-modal bg-bg-base/95 backdrop-blur-md flex flex-col overflow-y-auto no-scrollbar"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <h3 className="text-h3 font-h3 tracking-tight text-text-primary">進階/週期/分期設定</h3>
        <button onClick={onClose} className="p-inner -ml-inner rounded-button active:bg-surface-glass-heavy transition-all ease-apple">
          <X className="size-icon-lg text-text-tertiary" />
        </button>
      </header>

      <div className="flex-1 px-screen py-section flex flex-col gap-section pb-nav-clearance">
        
        {/* Toggle Switch Card */}
        <div className="flex items-center justify-between p-item rounded-card bg-surface-primary border border-hairline border-border-subtle shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-body font-h3 text-text-primary">啟用自動化與分期</span>
            <span className="text-caption text-text-tertiary">設定定期紀錄或分期付款排程</span>
          </div>
          <button
            onClick={() => onUpdate({ ...config, enabled: !config.enabled })}
            className={`relative shrink-0 rounded-full transition-colors duration-300 ease-in-out ${config.enabled ? 'bg-brand-primary' : 'bg-surface-glass-heavy'}`}
            style={{ width: "52px", height: "32px" }}
          >
            <div className={`absolute top-1/2 -translate-y-1/2 bg-bg-base rounded-full shadow-sm transition-all duration-300 ease-out ${config.enabled ? 'left-[22px]' : 'left-1'}`} style={{ width: "24px", height: "24px" }} />
          </button>
        </div>

        {config.enabled && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-section">

            {/* Segmented Control */}
            <div className="flex bg-surface-glass p-1 rounded-button border border-hairline border-border-subtle shrink-0">
              <button
                onClick={() => onUpdate({ ...config, type: 'recurring' })}
                className={`flex-1 py-2 rounded-inner text-caption font-h3 tracking-wide transition-all ease-apple ${config.type === 'recurring' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                定期紀錄
              </button>
              <button
                onClick={() => onUpdate({ ...config, type: 'installment' })}
                className={`flex-1 py-2 rounded-inner text-caption font-h3 tracking-wide transition-all ease-apple ${config.type === 'installment' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                分期付款
              </button>
            </div>

            {/* Recurring Options */}
            {config.type === 'recurring' && (
              <div className="flex flex-col rounded-card bg-surface-primary border border-hairline border-border-subtle overflow-hidden shadow-sm divide-y divide-hairline divide-border-subtle">
                <div className="flex items-center justify-between p-item">
                  <span className="text-body text-text-primary">循環週期</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary text-body">每</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={config.interval === 0 ? "" : config.interval}
                      onChange={(e) => onUpdate({ ...config, interval: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="w-12 bg-surface-glass text-center py-1 rounded-inner text-brand-primary font-h3 outline-none tabular-nums"
                    />
                    <select
                      value={config.frequency}
                      onChange={(e) => onUpdate({ ...config, frequency: e.target.value })}
                      className="bg-transparent text-body font-h3 text-brand-primary outline-none text-right"
                    >
                      <option value="day">天</option>
                      <option value="week">週</option>
                      <option value="month">個月</option>
                      <option value="year">年</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-item">
                  <span className="text-body text-text-primary">特定扣款日</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={config.dayOfCycle === 0 ? "" : config.dayOfCycle}
                    onChange={(e) => onUpdate({ ...config, dayOfCycle: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-24 text-right bg-transparent text-brand-primary font-h3 outline-none placeholder:text-text-tertiary/50 tabular-nums"
                    placeholder="例如: 15"
                  />
                </div>

                <div className="flex items-center justify-between p-item">
                  <span className="text-body text-text-primary">重複次數</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={config.occurrenceCount === 0 ? "" : config.occurrenceCount}
                      onChange={(e) => onUpdate({ ...config, occurrenceCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="w-24 text-right bg-transparent text-brand-primary font-h3 outline-none placeholder:text-text-tertiary/50 tabular-nums"
                      placeholder="0 表無限"
                    />
                    <span className="text-text-tertiary text-body">次</span>
                  </div>
                </div>
              </div>
            )}

            {/* Installment Options */}
            {config.type === 'installment' && (
              <div className="flex flex-col gap-section">
                <div className="flex flex-col rounded-card bg-surface-primary border border-hairline border-border-subtle overflow-hidden shadow-sm divide-y divide-hairline divide-border-subtle">
                  <div className="flex items-center justify-between p-item">
                    <span className="text-body text-text-primary">分期總金額</span>
                    <div className="flex items-center gap-2">
                      <span className="text-text-tertiary text-body">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={(config.totalAmount || totalAmount) === 0 ? "" : (config.totalAmount || totalAmount)}
                        onChange={(e) => onUpdate({ ...config, totalAmount: e.target.value === "" ? 0 : Number(e.target.value) })}
                        className="w-28 text-right bg-transparent text-brand-primary font-h3 outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-item">
                    <span className="text-body text-text-primary">總期數</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={config.totalInstallments === 0 ? "" : config.totalInstallments}
                        onChange={(e) => onUpdate({ ...config, totalInstallments: e.target.value === "" ? 0 : Number(e.target.value) })}
                        className="w-16 text-right bg-transparent text-brand-primary font-h3 outline-none tabular-nums"
                        placeholder="如: 12"
                      />
                      <span className="text-text-tertiary text-body">期</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-item">
                    <span className="text-body text-text-primary">年利率</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={config.interestRate === 0 ? "" : config.interestRate}
                        onChange={(e) => onUpdate({ ...config, interestRate: e.target.value === "" ? 0 : Number(e.target.value) })}
                        className="w-16 text-right bg-transparent text-brand-primary font-h3 outline-none tabular-nums"
                        placeholder="0.0"
                      />
                      <span className="text-text-tertiary text-body">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-item">
                    <span className="text-body text-text-primary">計算方式</span>
                    <select
                      value={config.roundingMethod}
                      onChange={(e) => onUpdate({ ...config, roundingMethod: e.target.value })}
                      className="bg-transparent text-text-secondary font-body outline-none text-right"
                    >
                      <option value="round">四捨五入</option>
                      <option value="ceil">無條件進位</option>
                      <option value="floor">無條件捨去</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-item">
                    <span className="text-body text-text-primary">除不盡餘額</span>
                    <div className="flex bg-surface-glass p-0.5 rounded-inner border border-hairline border-border-subtle">
                       <button
                         onClick={() => onUpdate({ ...config, remainderStrategy: 'first' })}
                         className={`px-3 py-1 rounded-[4px] text-caption font-body transition-all ${config.remainderStrategy === 'first' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
                       >納入首期</button>
                       <button
                         onClick={() => onUpdate({ ...config, remainderStrategy: 'last' })}
                         className={`px-3 py-1 rounded-[4px] text-caption font-body transition-all ${config.remainderStrategy === 'last' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
                       >納入末期</button>
                    </div>
                  </div>
                </div>

                {/* Preview Box */}
                <div className="p-item rounded-card bg-brand-primary/10 border border-brand-primary/20 flex justify-between items-center shadow-sm">
                  <span className="text-caption font-h3 text-brand-primary uppercase">預估每期金額</span>
                  <span className="text-h2 font-h2 text-brand-primary tabular-nums">${installmentAmount.toLocaleString()}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
        
        <div className="mt-auto pt-section">
          <button
            onClick={onClose}
            className="w-full py-item rounded-button bg-brand-primary text-bg-base font-h3 tracking-wide active:scale-95 transition-all duration-fast ease-apple shadow-dropdown"
          >
            完成設定
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EditField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="flex flex-col gap-micro py-micro group relative overflow-hidden focus-within:bg-bg-base/40 rounded-inner transition-colors">
      <div className="flex items-center gap-inner">
        <span className="text-brand-primary scale-75 origin-left">{icon}</span>
        <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide leading-none">{label}</span>
      </div>
      {type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-body font-h3 text-text-primary outline-none leading-normal w-full"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-body font-h3 text-text-primary outline-none focus:placeholder:opacity-0 transition-opacity leading-normal w-full"
        />
      )}
    </div>
  );
}
