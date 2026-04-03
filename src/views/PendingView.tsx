import { useState, useMemo } from "react";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addTransaction } from "@/db/db";
import TransactionFormView from "./TransactionFormView";
import { ICON_MAP } from "@/constants/icons";
import { Tag, Box } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

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
}

export default function PendingView() {
  // Real pending transactions from DB
  const pendingTransactions = useLiveQuery(() => 
    db.transactions.where("status").equals("pending").toArray()
  ) || [];

  const categoriesSetting = useLiveQuery(() => 
    db.settings.where("key").equals("categories").first()
  );
  const categories = (categoriesSetting?.value as any[]) || [];

  const getIcon = (mainCat: string, subCat?: string) => {
    const main = categories.find(c => c.name === mainCat);
    if (!main) return <Box className="size-icon-md text-text-tertiary" />;
    const sub = main.subCategories?.find((s: any) => s.name === subCat);
    const iconName = sub?.iconName || main.iconName || "Box";
    const IconComponent = ICON_MAP[iconName] || Tag;
    return <IconComponent className="size-icon-md" />;
  };

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeletingRecurring, setIsDeletingRecurring] = useState(false);

  const handleConfirm = async (id: number) => {
    const tx = await db.transactions.get(id);
    if (tx) {
      await db.transactions.update(id, { status: "confirmed" });
      // Note: We might need to update account balance here if not already done
      // but if it's 'pending', we probably haven't updated the balance yet.
      // However, addTransaction handles balance updates. 
      // If a transaction is already in DB as 'pending', we should update the account.
      if (tx.account_id) {
        await db.transaction('rw', db.accounts, async () => {
          const account = await db.accounts.get(tx.account_id!);
          if (account) {
            await db.accounts.update(tx.account_id!, {
              current_balance: account.current_balance + tx.amount
            });
          }
        });
      }
    }
  };

  const handleDelete = async (id: number) => {
    const tx = await db.transactions.get(id);
    if (tx?.rule_id) {
      setDeleteId(id);
      setIsDeletingRecurring(true);
      return;
    }
    
    // 一般交易：直接刪除
    await db.transactions.delete(id);
  };

  const executeDelete = async () => {
    if (deleteId) {
      await db.transactions.delete(deleteId);
      setDeleteId(null);
    }
  };

  const handleSaveVerified = async () => {
    // TransactionFormView handles saving now
    setSelectedTx(null);
  };

  const groupedTransactions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    const groups: { [key: string]: Transaction[] } = {};
    
    const sorted = [...pendingTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sorted.forEach(tx => {
      const datePart = tx.date.split('T')[0];
      let displayKey = "";
      
      if (datePart === today) {
        displayKey = "今天";
      } else {
        const [y, m, d] = datePart.split('/');
        displayKey = `${parseInt(m)}月${parseInt(d)}日`;
      }
      
      if (!groups[displayKey]) groups[displayKey] = [];
      groups[displayKey].push(tx);
    });
    
    // 確保「今天」排在最前面，其餘案日期倒序
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "今天") return -1;
      if (b === "今天") return 1;
      // 這裡簡單比較字串即可，因為已經手動處理了順序且 sorted 過
      return 0; 
    });
  }, [pendingTransactions]);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base pb-nav-clearance animate-in fade-in duration-normal">
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <h3 className="text-h3 font-h3 text-text-primary leading-tight">待審核交易</h3>
      </header>

      <div className="px-screen flex flex-col gap-section">
        {pendingTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-tertiary gap-item py-20">
            <CheckCircle className="size-avatar-lg" />
            <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">目前沒有待審核項目</span>
          </div>
        ) : (
          <div className="flex flex-col gap-section">
            {groupedTransactions.map(([date, txs]) => (
              <div key={date} className="flex flex-col gap-inner">
                 <div className="flex justify-between items-center px-inner">
                  <h3 className="text-caption font-caption text-text-tertiary uppercase tracking-wide">{date}</h3>
                  <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">{txs.length} 筆</span>
                </div>
                <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle divide-y-hairline divide-border-subtle overflow-hidden relative z-10">
                  {(txs as any[]).map(tx => (
                    <PendingItem key={tx.id} tx={tx} onConfirm={handleConfirm} onEdit={setSelectedTx} onDelete={handleDelete} getIcon={getIcon} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedTx && (
          <TransactionFormView 
            initialData={selectedTx}
            onBack={() => setSelectedTx(null)}
            onSave={handleSaveVerified}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="發起刪除"
        message={isDeletingRecurring 
          ? "此筆交易屬於分期/定期項目。刪除此明細「不會」停止未來期數的自動產生，如需取消排程請至管理頁面。" 
          : "確定要刪除此筆待審核交易嗎？"}
        confirmText="刪除"
        cancelText="取消"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function PendingItem({ tx, onConfirm, onEdit, onDelete, getIcon }: { tx: Transaction, onConfirm: (id: number) => void, onEdit: (tx: Transaction) => void, onDelete: (id: number) => void, getIcon: (mainCat: string, subCat?: string) => React.ReactNode }) {
  // Map categories to emojis for a cleaner look
  // Removed hardcoded emoji map

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full p-item flex items-center justify-between active:bg-surface-glass transition-all active:opacity-active duration-fast group relative ease-apple"
    >
      <div className="flex items-center gap-item flex-1 min-w-0" onClick={() => onEdit(tx)}>
        <div className="size-icon-md flex items-center justify-center text-brand-primary bg-bg-base rounded-button shadow-inner shrink-0 group-active:scale-90 transition-all duration-fast">
          {getIcon(tx.main_category, tx.sub_category)}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-micro.5">
            <span className="font-body text-body leading-normal truncate text-text-primary">
              {tx.item_name || tx.merchant || tx.main_category}
            </span>
          </div>
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide truncate mt-0.5">
            {tx.merchant && <span className="mr-1.5 font-caption">{tx.merchant} ·</span>}
            {tx.main_category} / {tx.sub_category}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-item shrink-0">
        <span className="font-h2 text-h3 tabular-nums tracking-tight text-text-primary">
          ${Math.abs(tx.amount).toLocaleString()}
        </span>
        <div className="flex gap-inner">
          <button 
            onClick={() => onDelete(tx.id as number)}
            className="px-item py-micro.5 rounded-button bg-surface-glass border border-border-subtle text-semantic-danger text-caption font-caption active:scale-95 active:opacity-active transition-all duration-fast ease-apple hover:bg-semantic-danger/10"
          >
            刪除
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (!tx.account_id) {
                onEdit(tx); // Open form to select account
                return;
              }
              onConfirm(tx.id as number);
            }}
            className={`px-item py-micro.5 rounded-button font-h3 text-caption active:scale-95 active:opacity-active transition-all duration-fast ease-apple ${!tx.account_id ? 'bg-surface-glass text-text-tertiary border border-border-subtle' : 'bg-brand-primary text-bg-base'}`}
          >
            {tx.account_id ? "確認" : "選取帳戶"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
