import { useState } from "react";
import { ChevronLeft, Repeat, Play, Pause, Trash2, Calendar, Clock, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, RecurringRule } from "@/db/db";
import SwipeableDelete from "@/components/SwipeableDelete";

interface RecurringManagementViewProps {
  onBack: () => void;
}

export default function RecurringManagementView({ onBack }: RecurringManagementViewProps) {
  const allRules = useLiveQuery(() => db.recurringRules.toArray()) || [];
  const [swipedId, setSwipedId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<"installment" | "recurring">("installment");

  const formatFrequency = (freq: string, interval?: number) => {
    const unit = freq === 'daily' ? '天' : freq === 'weekly' ? '週' : freq === 'monthly' ? '個月' : '年';
    return `每 ${interval || 1} ${unit}`;
  };

  const activeRules = allRules.filter(r => r.is_active && r.type === viewType).sort((a, b) => new Date(a.next_generation_date).getTime() - new Date(b.next_generation_date).getTime());
  const inactiveRules = allRules.filter(r => !r.is_active && r.type === viewType).sort((a, b) => new Date(b.next_generation_date).getTime() - new Date(a.next_generation_date).getTime());

  const toggleActive = async (id: number, currentStatus: boolean | undefined) => {
    await db.recurringRules.update(id, { is_active: !currentStatus });
  };

  const deleteRule = async (id: number) => {
    await db.recurringRules.delete(id);
  };

  const renderRuleGroup = (title: string, rules: RecurringRule[]) => {
    if (rules.length === 0) return null;
    return (
      <div className="flex flex-col gap-inner">
        <h3 className="text-caption font-caption text-text-tertiary px-inner uppercase tracking-wide">{title}</h3>
        <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle overflow-hidden shadow-sm">
          {rules.map((rule, index) => {
            const template = rule.template_transaction as any;
            const isInstallment = rule.type === 'installment';
            const iconName = template?.items?.[0]?.main_category || "定期";
            
            return (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`relative ${index !== rules.length - 1 ? 'border-b border-hairline border-border-subtle' : ''}`}
              >
                <SwipeableDelete
                  onDelete={() => deleteRule(rule.id!)}
                  isOpen={swipedId === rule.id}
                  onOpenStateChange={(open) => setSwipedId(open ? rule.id || null : null)}
                >
                  <div className="w-full p-item flex flex-col gap-inner bg-surface-primary active:bg-surface-glass transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {!rule.is_active && (
                            <span className="px-1.5 py-0.5 rounded-inner bg-semantic-danger/10 text-semantic-danger text-caption font-h3 tracking-wide uppercase">
                              已停用
                            </span>
                          )}
                        </div>
                        <span className="font-h3 text-body tracking-tight text-text-primary">
                          {template?.merchant || template?.items?.[0]?.item_name || '未命名排程'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-caption font-caption text-text-tertiary">
                            {formatFrequency(rule.frequency, rule.interval)}
                          </span>
                          <span className="text-caption font-caption text-text-tertiary">·</span>
                          <span className="text-caption font-caption text-text-tertiary">
                            下次: {rule.next_generation_date}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-h2 text-h3 tabular-nums tracking-tight text-text-primary">
                          ${Math.abs(rule.total_amount || template?.amount || (template?.items?.reduce((acc: number, item: any) => acc + (item.amount || 0), 0)) || 0).toLocaleString()}
                        </span>
                        {isInstallment && (
                          <span className="text-caption font-caption text-brand-primary">
                            進度: {rule.installments_paid || 0} / {rule.total_installments}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-start mt-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleActive(rule.id!, rule.is_active); }}
                        className={`flex items-center justify-center gap-1.5 px-section py-1.5 rounded-button font-h3 text-caption active:scale-95 transition-all outline-none ${rule.is_active ? 'bg-surface-glass text-text-secondary hover:bg-surface-glass-heavy border border-border-subtle' : 'bg-brand-primary text-bg-base shadow-sm shadow-brand-primary/20'}`}
                      >
                        {rule.is_active ? <Pause className="size-icon-sm" /> : <Play className="size-icon-sm" />}
                        {rule.is_active ? "暫停規則" : "恢復規則"}
                      </button>
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
            className={`flex-1 py-2 rounded-inner text-caption font-h3 tracking-wide transition-all ease-apple ${viewType === 'installment' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            分期付款
          </button>
          <button
            onClick={() => setViewType('recurring')}
            className={`flex-1 py-2 rounded-inner text-caption font-h3 tracking-wide transition-all ease-apple ${viewType === 'recurring' ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
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
            {renderRuleGroup("執行中的規則", activeRules)}
            {renderRuleGroup("已暫停或結束的規則", inactiveRules)}
          </div>
        )}
      </div>
    </motion.div>
  );
}
