import { useState, useMemo } from "react";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
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
  group_id?: string;
}

export default function PendingView() {
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

  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);

  const handleConfirm = async (id: number) => {
    const tx = await db.transactions.get(id);
    if (!tx || !tx.account_id) return;

    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      await db.transactions.update(id, { status: "confirmed" });
      const account = await db.accounts.get(tx.account_id!);
      if (account) {
        await db.accounts.update(tx.account_id!, {
          current_balance: account.current_balance + tx.amount
        });
      }
    });
  };

  const handleConfirmGroup = async (groupId: string) => {
    const txs = await db.transactions.where("group_id").equals(groupId).toArray();
    if (txs.some(t => !t.account_id)) {
      // If any item missing account, open form to select
      setSelectedTx(txs);
      return;
    }

    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      for (const tx of txs) {
        await db.transactions.update(tx.id!, { status: "confirmed" });
        const account = await db.accounts.get(tx.account_id!);
        if (account) {
          await db.accounts.update(tx.account_id!, {
            current_balance: account.current_balance + tx.amount
          });
        }
      }
    });
  };

  const handleDelete = async (idOrGroupId: number | string) => {
    setDeleteId(idOrGroupId);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    if (typeof deleteId === 'string') {
      const txs = await db.transactions.where("group_id").equals(deleteId).toArray();
      await db.transactions.bulkDelete(txs.map(t => t.id!).filter(Boolean));
    } else {
      await db.transactions.delete(deleteId);
    }
    setDeleteId(null);
  };

  const groupedTransactions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    const dayGroups: { [key: string]: any[] } = {};
    
    // 1. First Pass: Group by Date
    const sorted = [...pendingTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // 2. Second Pass: Sub-group items with same group_id
    sorted.forEach(tx => {
      const datePart = tx.date.split('T')[0];
      let displayKey = "";
      if (datePart === today) displayKey = "今天";
      else {
        const [y, m, d] = datePart.split('/');
        displayKey = `${parseInt(m)}月${parseInt(d)}日`;
      }
      if (!dayGroups[displayKey]) dayGroups[displayKey] = [];
      dayGroups[displayKey].push(tx);
    });

    // 3. Process sub-groups within each day
    return Object.entries(dayGroups).map(([date, items]) => {
      const subGroups: any[] = [];
      const handledGroups = new Set();

      items.forEach(tx => {
        if (tx.group_id) {
          if (!handledGroups.has(tx.group_id)) {
            const groupItems = items.filter(i => i.group_id === tx.group_id);
            subGroups.push({
              type: 'group',
              id: tx.group_id,
              data: groupItems,
              totalAmount: groupItems.reduce((acc, i) => acc + i.amount, 0),
              merchant: groupItems[0].merchant || "多項交易項目",
              date: groupItems[0].date
            });
            handledGroups.add(tx.group_id);
          }
        } else {
          subGroups.push({ type: 'single', data: tx, id: tx.id });
        }
      });

      return [date, subGroups];
    }).sort(([a], [b]) => {
      if (a === "今天") return -1;
      if (b === "今天") return 1;
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
            {(groupedTransactions as any[]).map(([date, items]) => (
              <div key={date} className="flex flex-col gap-inner">
                 <div className="flex justify-between items-center px-inner">
                  <h3 className="text-caption font-caption text-text-tertiary uppercase tracking-wide">{date}</h3>
                  <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide">{items.length} 批</span>
                </div>
                <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle overflow-hidden relative z-10 flex flex-col">
                  {items.map((entry: any) => (
                    entry.type === 'group' ? (
                      <PendingGroup 
                        key={entry.id} 
                        entry={entry} 
                        onConfirm={handleConfirmGroup} 
                        onEdit={setSelectedTx} 
                        onDelete={handleDelete} 
                      />
                    ) : (
                      <PendingItem 
                        key={entry.id} 
                        tx={entry.data} 
                        onConfirm={handleConfirm} 
                        onEdit={setSelectedTx} 
                        onDelete={handleDelete} 
                        getIcon={getIcon} 
                      />
                    )
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
            onSave={() => setSelectedTx(null)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="發起刪除"
        message={typeof deleteId === 'string' ? "確定要刪除這組多品項待審核紀錄嗎？" : "確定要刪除這筆待審核交易嗎？"}
        confirmText="刪除"
        cancelText="取消"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function PendingGroup({ entry, onConfirm, onEdit, onDelete }: any) {
  return (
    <motion.div 
      layout
      className="w-full p-item flex items-center justify-between active:bg-surface-glass transition-all border-b border-hairline border-border-subtle last:border-0"
    >
      <div className="flex items-center gap-item flex-1 min-w-0" onClick={() => onEdit(entry.data)}>
        <div className="size-icon-md flex items-center justify-center text-brand-primary bg-bg-base rounded-inner shadow-inner shrink-0 relative">
          <Box className="size-icon-md" />
          <div className="absolute -top-1 -right-1 bg-brand-primary text-bg-base text-[10px] font-body w-4 h-4 rounded-full flex items-center justify-center border-2 border-surface-primary">
            {entry.data.length}
          </div>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-body text-body leading-normal truncate text-text-primary">
            {entry.merchant} (共 {entry.data.length} 筆)
          </span>
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide truncate mt-0.5">
            {Array.from(new Set(entry.data.map((t: any) => t.main_category))).join(' · ')}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-item shrink-0">
        <span className="font-body text-h3 tabular-nums text-text-primary">
          ${Math.abs(entry.totalAmount).toLocaleString()}
        </span>
        <div className="flex gap-inner">
          <button onClick={() => onDelete(entry.id)} className="px-item py-micro.5 rounded-button bg-surface-glass border border-border-subtle text-semantic-danger text-caption font-caption active:scale-95 transition-all">刪除</button>
          <button onClick={() => onConfirm(entry.id)} className="px-item py-micro.5 rounded-button bg-brand-primary text-bg-base text-caption font-h3 active:scale-95 transition-all">全部確認</button>
        </div>
      </div>
    </motion.div>
  );
}

function PendingItem({ tx, onConfirm, onEdit, onDelete, getIcon }: any) {
  return (
    <motion.div 
      layout
      className="w-full p-item flex items-center justify-between active:bg-surface-glass transition-all border-b border-hairline border-border-subtle last:border-0"
    >
      <div className="flex items-center gap-item flex-1 min-w-0" onClick={() => onEdit(tx)}>
        <div className="size-icon-md flex items-center justify-center text-brand-primary bg-bg-base rounded-inner shadow-inner shrink-0">
          {getIcon(tx.main_category, tx.sub_category)}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-body text-body leading-normal truncate text-text-primary">
            {tx.item_name || tx.merchant || tx.main_category}
          </span>
          <span className="text-caption font-caption text-text-tertiary uppercase tracking-wide truncate mt-0.5">
            {tx.merchant && <span className="mr-1">{tx.merchant} ·</span>}{tx.main_category} / {tx.sub_category}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-item shrink-0">
        <span className="font-body text-h3 tabular-nums text-text-primary">
          ${Math.abs(tx.amount).toLocaleString()}
        </span>
        <div className="flex gap-inner">
          <button onClick={() => onDelete(tx.id)} className="px-item py-micro.5 rounded-button bg-surface-glass border border-border-subtle text-semantic-danger text-caption font-caption active:scale-95 transition-all">刪除</button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (!tx.account_id) { onEdit(tx); return; }
              onConfirm(tx.id);
            }} 
            className={`px-item py-micro.5 rounded-button text-caption font-h3 active:scale-95 transition-all ${!tx.account_id ? 'bg-surface-glass text-text-tertiary' : 'bg-brand-primary text-bg-base'}`}
          >
            {tx.account_id ? "確認" : "選取帳戶"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
