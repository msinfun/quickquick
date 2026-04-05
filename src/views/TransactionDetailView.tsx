import { ChevronLeft, Edit2, Copy, Trash2, Calendar, Database, Box, Tag, CreditCard, Hash, Repeat, Store, CheckCircle, AlertCircle, X } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_MAP } from "@/constants/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Transaction } from "@/db/db";

interface TransactionDetailViewProps {
  transactions: Transaction | Transaction[];
  onBack: () => void;
  onEdit?: (transaction: Transaction | Transaction[]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  accountName?: string;
}

export default function TransactionDetailView({
  transactions,
  onBack,
  onEdit,
  onDelete,
  onDuplicate,
  accountName
}: TransactionDetailViewProps) {
  const txList = Array.isArray(transactions) ? transactions : [transactions];
  const isGroup = txList.length > 1;
  const mainTx = txList[0];
  const totalAmount = txList.reduce((acc, t) => acc + t.amount, 0);

  const associatedRule = useLiveQuery(async () =>
    mainTx.rule_id ? await db.recurringRules.get(mainTx.rule_id) : undefined
    , [mainTx.rule_id]);

  const categoriesSetting = useLiveQuery(() =>
    db.settings.where("key").equals("categories").first()
  );
  const categories = (categoriesSetting?.value as any[]) || [];

  const resolvedAccount = useLiveQuery(async () => 
    mainTx.account_id ? await db.accounts.get(mainTx.account_id) : undefined
  , [mainTx.account_id]);

  const displayAccountName = accountName || resolvedAccount?.name;

  const getIconName = (mainCat: string, subCat?: string) => {
    const main = categories.find(c => c.name === mainCat);
    if (!main) return "Tag";
    const sub = main.subCategories?.find((s: any) => s.name === subCat);
    return sub?.iconName || main.iconName || "Tag";
  };

  const renderIcon = (name: string, className: string = "size-icon-sm text-brand-primary") => {
    const IconComponent = ICON_MAP[name] || Box;
    return <IconComponent className={className} />;
  };

  const getDimmedClass = (text?: string) => {
    const placeholders = ["無紀錄", "未指定", "無商家資訊", "無記錄", "無"];
    return (!text || placeholders.includes(text)) 
      ? "text-text-tertiary italic font-normal" 
      : "text-text-primary font-h3";
  };

  const getAlertClass = (text?: string) => {
    const placeholders = ["未指定", "無紀錄", "無記錄", "無"];
    return (!text || placeholders.includes(text)) 
      ? "text-semantic-danger font-h3" 
      : "text-text-primary font-h3";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-modal bg-bg-base flex flex-col gap-section overflow-hidden"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg overflow-hidden flex flex-col h-full bg-bg-base"
      >
        <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item sticky top-0 bg-bg-base/80 backdrop-blur-nav z-nav transition-all duration-normal ease-apple">
          <h1 className="text-h3 font-h3 tracking-tight text-text-primary whitespace-nowrap leading-tight">交易詳情</h1>
          <div className="flex items-center gap-micro">
            <button
              onClick={onDuplicate}
              className="p-inner rounded-button bg-surface-glass text-brand-primary active:bg-brand-primary/10 transition-colors duration-normal ease-apple border border-hairline border-border-subtle"
              title="複製交易"
            >
              <Copy className="size-icon-md" />
            </button>
            <button
              onClick={() => onEdit?.(txList)}
              className="p-inner rounded-button bg-surface-glass text-brand-primary active:bg-brand-primary/10 transition-colors duration-normal ease-apple border border-hairline border-border-subtle active:opacity-active"
              title="編輯項目"
            >
              <Edit2 className="size-icon-md" />
            </button>
            <button
              onClick={onDelete}
              className="p-inner rounded-button active:bg-semantic-danger/20 text-semantic-danger transition-colors duration-normal ease-apple active:opacity-active"
              title="刪除整筆"
            >
              <Trash2 className="size-icon-md" />
            </button>
            <div className="w-px bg-border-subtle shrink-0" style={{ height: "1.5rem", margin: "0 4px" }} />
            <button onClick={onBack} className="p-inner -mr-inner rounded-button active:bg-surface-glass-heavy transition-colors duration-normal ease-apple active:opacity-active">
              <ChevronLeft className="size-icon-lg text-brand-primary" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar px-screen pb-nav-clearance flex flex-col gap-section bg-bg-base">
          {/* Top Amount: Direct on Background */}
          <div className="flex flex-col items-center py-[var(--size-icon-container)]">
            <span className={`text-h1 font-h1 tabular-nums ${ (Array.isArray(transactions) ? transactions[0].type : transactions.type) === 'expense' ? 'text-semantic-danger' : 'text-brand-primary'}`}>
              {totalAmount < 0 ? '-' : totalAmount > 0 ? '+' : ''}$ {Math.abs(totalAmount).toLocaleString()}
            </span>
            <div className="mt-item flex items-center gap-micro">
              <div className="px-item py-1.5 rounded-inner bg-surface-glass border border-hairline border-border-subtle text-caption font-caption uppercase tracking-wide text-text-tertiary">
                {isGroup ? `${txList.length} 項合併消費` : '單筆消費項目'}
              </div>
              {associatedRule && (
                <div className="px-item py-1.5 rounded-button bg-brand-primary/10 border border-brand-primary/20 text-caption font-caption uppercase tracking-wide text-brand-primary flex items-center gap-1.5 ">
                  {associatedRule.type === 'recurring' ? (
                    <>
                      <Repeat className="size-icon-sm" strokeWidth={2.5} />
                      定期項目
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-icon-sm" strokeWidth={2.5} />
                      分期 {associatedRule.installments_paid}/{associatedRule.total_installments}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Hero Field Card */}
          <div className="bg-surface-primary rounded-card p-item border border-hairline border-border-subtle grid grid-cols-2 gap-item shadow-sm">
            <HeroField 
              label="日期" 
              value={mainTx.date ? mainTx.date.replace(/\//g, ' / ') : "未指定"} 
              icon={<Calendar className="size-icon-md" />} 
              valueClassName={getAlertClass(mainTx.date)}
            />
            <HeroField 
              label="付款帳戶" 
              value={displayAccountName || "未指定"} 
              icon={<CreditCard className="size-icon-md" />} 
              valueClassName={getAlertClass(displayAccountName)}
            />
            <HeroField 
              label="商家" 
              value={mainTx.merchant || "無商家資訊"} 
              icon={<Store className="size-icon-md" />} 
              valueClassName={getDimmedClass(mainTx.merchant)}
            />
            <HeroField 
              label="發票號碼" 
              value={mainTx.invoice_number || "無紀錄"} 
              icon={<Hash className="size-icon-md" />} 
              valueClassName={`uppercase tracking-widest ${getDimmedClass(mainTx.invoice_number)}`}
            />
          </div>

          {/* Section 2: Item List Card */}
          <div className="flex flex-col gap-inner">
            <span className="text-caption font-caption text-text-tertiary px-inner-label uppercase tracking-wide leading-none mb-micro">消費明細清單</span>
            <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle divide-y-hairline divide-border-subtle overflow-hidden shadow-sm">
              {txList.map((tx, idx) => {
                const isPending = tx.status === 'pending';
                const isConfirmed = tx.status === 'confirmed' || tx.status === 'reconciled';
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-item transition-all duration-normal ease-apple ${isPending ? 'bg-semantic-danger/[0.02]' : ''}`}
                  >
                    <div className="flex items-center gap-item flex-1 min-w-0">
                      <div className="size-icon-container flex items-center justify-center text-brand-primary bg-bg-base/40 rounded-button shadow-inner shrink-0">
                        {renderIcon(getIconName(tx.main_category, tx.sub_category), isPending ? "size-icon-md text-semantic-danger" : "size-icon-md text-brand-primary")}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-body font-body text-text-primary leading-normal truncate">{tx.item_name || tx.main_category}</span>
                        <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide mt-0.5 truncate">{tx.main_category} · {tx.sub_category}</span>
                      </div>
                    </div>
                    <span className={`text-h3 font-h3 tabular-nums tracking-tighter shrink-0 pl-item whitespace-nowrap ${tx.type === 'expense' ? 'text-semantic-danger' : tx.type === 'income' ? 'text-brand-primary' : 'text-text-tertiary'}`}>
                      {tx.amount < 0 ? '-' : tx.amount > 0 ? '+' : ''}$ {Math.abs(tx.amount).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Notes */}
          {mainTx.note && (
            <div className="flex flex-col gap-inner">
              <span className="text-caption font-caption text-text-tertiary px-inner-label uppercase tracking-wide">備註內容</span>
              <div className="bg-surface-primary rounded-card p-item border border-hairline border-border-subtle text-body font-body text-text-primary leading-relaxed shadow-sm whitespace-pre-wrap">
                {mainTx.note}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function HeroField({ label, value, icon, valueClassName }: { label: string, value: string, icon: React.ReactNode, valueClassName?: string }) {
  return (
    <div className="flex flex-col gap-micro py-micro group">
      <div className="flex items-center gap-inner">
        <span className="text-brand-primary scale-75 origin-left">{icon}</span>
        <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide leading-none">{label}</span>
      </div>
      <span className={`text-body truncate ${valueClassName || 'text-text-primary font-h3'}`}>{value}</span>
    </div>
  );
}
