import { useState, useMemo } from "react";
import { Plus, Tag } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import AccountFormView from "@/views/AccountFormView";
import AccountDetailView from "@/views/AccountDetailView";
import ReconciliationView from "@/views/ReconciliationView";
import { ICON_MAP } from "@/constants/icons";
import { db, Transaction } from "@/db/db";

export default function AccountView() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAccountInitialData, setEditingAccountInitialData] = useState<any | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [reconcilingTransactions, setReconcilingTransactions] = useState<Transaction[] | null>(null);
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const accountsWithRealBalance = useMemo(() => {
    return accounts.map(acc => {
      // 基準值：有 snapshot 使用 snapshot，否則使用 initial_balance
      const baseBalance = acc.snapshot_balance ?? acc.initial_balance ?? 0;
      // 切割點：有 snapshot_date 則過濾該日期之後的交易
      const cutoffDate = acc.snapshot_date ?? "";
      
      const relevantTxs = allTransactions.filter(tx => 
        tx.account_id === acc.id && 
        tx.status !== "pending" && 
        tx.date > cutoffDate
      );
      
      const computedBalance = baseBalance + relevantTxs.reduce((sum, tx) => sum + tx.amount, 0);
      
      return {
        ...acc,
        current_balance: computedBalance
      } as any;
    });
  }, [accounts, allTransactions]);

  const totalBalance = accountsWithRealBalance.reduce((acc: number, current: any) => acc + current.current_balance, 0);

  const handleSaveAccount = async (savedAccount: any) => {
    if (savedAccount.id) {
      await db.accounts.update(savedAccount.id, savedAccount);
      if (selectedAccount?.id === savedAccount.id) {
        setSelectedAccount(savedAccount);
      }
    } else {
      await db.accounts.add(savedAccount);
    }
    closeEditModal();
  };

  const handleDeleteAccount = async (id: number) => {
    await db.accounts.delete(id);
    setSelectedAccount(null);
  };

  const openEditModal = (account: any) => {
    setEditingAccountInitialData(account);
    setIsAddOpen(true);
  };
  
  const closeEditModal = () => {
    setIsAddOpen(false);
    setTimeout(() => setEditingAccountInitialData(null), 300);
  };

  const renderIcon = (name: string) => {
    const IconComponent = ICON_MAP[name] || Tag;
    return <IconComponent className="size-icon-md text-brand-primary" />;
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base pb-nav-clearance animate-in fade-in duration-normal">
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <h3 className="text-h3 font-h3 text-text-primary leading-tight">我的帳戶</h3>
        <button 
          onClick={() => setIsAddOpen(true)} 
          className="p-inner rounded-button active:bg-surface-glass-heavy text-brand-primary transition-colors active:opacity-active duration-fast ease-apple"
        >
          <Plus className="size-icon-lg text-brand-primary" />
        </button>
      </header>

      <div className="px-screen flex flex-col gap-section">
        <section>
          <div className="bg-surface-primary rounded-card p-item border border-hairline border-border-subtle flex flex-col gap-item relative overflow-hidden group">
            <p className="text-text-tertiary font-caption uppercase tracking-wide text-caption leading-normal">總資產</p>
            <span className="text-h2 font-h2 tabular-nums tracking-tight leading-none text-text-primary">
              {totalBalance < 0 ? '-' : ''}${Math.abs(totalBalance).toLocaleString()}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-item">
          <div className="bg-surface-primary rounded-card border border-hairline border-border-subtle divide-y-hairline divide-border-subtle overflow-hidden">
            {accountsWithRealBalance.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className="w-full px-screen py-item flex items-center justify-between active:bg-surface-glass active:opacity-active transition-colors duration-fast ease-apple text-left"
              >
                <div className="flex items-center gap-item">
                  <div className="size-icon-container rounded-button bg-bg-base flex items-center justify-center shadow-inner shrink-0">
                    {renderIcon(acc.icon || "Tag")}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-h3 text-body leading-normal text-text-primary">{acc.name}</span>
                  </div>
                </div>
                <span className={`font-h2 text-h3 tabular-nums tracking-tight ${acc.current_balance < 0 ? 'text-text-primary' : 'text-brand-primary'}`}>
                  {acc.current_balance < 0 ? '-' : ''}${Math.abs(acc.current_balance).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {selectedAccount !== null && (
          <AccountDetailView 
            account={accountsWithRealBalance.find(a => a.id === selectedAccount.id) || selectedAccount} 
            onBack={() => setSelectedAccount(null)} 
            onEditAccount={() => openEditModal(selectedAccount)}
            onDeleteAccount={() => handleDeleteAccount(selectedAccount.id as number)}
            onStartReconciliation={(txs) => setReconcilingTransactions(txs)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reconcilingTransactions !== null && (
          <ReconciliationView 
            account={selectedAccount}
            transactions={reconcilingTransactions}
            onBack={() => setReconcilingTransactions(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddOpen && (
          <AccountFormView 
            onBack={closeEditModal} 
            onSave={handleSaveAccount} 
            initialData={editingAccountInitialData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
