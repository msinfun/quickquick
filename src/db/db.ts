import Dexie, { type EntityTable } from 'dexie';

export interface Account {
  id?: number;
  name: string;
  current_balance: number;
  initial_balance?: number;
  snapshot_balance?: number; // 基準快照金額
  snapshot_date?: string;    // 快照日期 (YYYY/MM/DD)
  icon?: string;
  billing_cycle?: number;
}

export interface Transaction {
  id?: number;
  date: string;
  type: "expense" | "income" | "transfer";
  main_category: string;
  sub_category: string;
  account_id?: number;
  amount: number;
  item_name?: string;
  merchant?: string;
  status?: string;
  billing_month?: string;
  invoice_number?: string;
  note?: string;
  group_id?: string;
  rule_id?: number; // Link to RecurringRule
}

export interface RecurringRule {
  id?: number;
  template_transaction: Partial<Transaction>;
  frequency: "daily" | "weekly" | "monthly" | "bi-monthly" | "quarterly" | "yearly";
  type: "recurring" | "installment";
  interval?: number; // e.g., "every 2 weeks" -> frequency: "weekly", interval: 2
  day_of_cycle?: number; // e.g., 15th of month, or 1 (Monday)
  occurrence_count?: number; // e.g., repeat for 5 years
  total_amount?: number; // for installment
  interest_rate?: number; // for installment
  rounding_method?: 'round' | 'ceil' | 'floor'; // for installment
  remainder_strategy?: 'first' | 'last'; // for installment
  total_installments?: number;
  installments_paid?: number;
  start_date: string;
  next_generation_date: string;
  last_generated_date?: string;
  is_active: boolean;
}

export interface Setting {
  id?: number;
  key: string;
  value: any;
}

class AccountingDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  settings!: EntityTable<Setting, 'id'>;
  recurringRules!: EntityTable<RecurringRule, 'id'>;

  constructor() {
    super('AccountingDB');
    this.version(4).stores({
      accounts: '++id, name, current_balance',
      transactions: '++id, date, type, main_category, sub_category, account_id, amount, status, item_name, merchant, group_id, rule_id',
      settings: '++id, key, value',
      recurringRules: '++id, type, next_generation_date, is_active'
    });
  }
}

export const db = new AccountingDB();

export const DEFAULT_CATEGORIES = [
  { 
    id: "e1", name: "飲食", type: "expense", iconName: "Utensils", 
    subCategories: [
      { id: "e1-1", name: "食材", iconName: "ShoppingBasket" },
      { id: "e1-2", name: "外食", iconName: "UtensilsCrossed" },
      { id: "e1-3", name: "水果", iconName: "Apple" },
      { id: "e1-4", name: "烘焙材料", iconName: "Egg" },
      { id: "e1-5", name: "飲料", iconName: "Beer" },
      { id: "e1-6", name: "點心", iconName: "Cookie" },
      { id: "e1-7", name: "鮮乳", iconName: "Milk" }
    ] 
  },
  { 
    id: "e2", name: "交通", type: "expense", iconName: "Car", 
    subCategories: [
      { id: "e2-1", name: "加油費", iconName: "Fuel" },
      { id: "e2-2", name: "公共交通費", iconName: "Bus" },
      { id: "e2-3", name: "停車費", iconName: "MapPin" }
    ] 
  },
  { 
    id: "e3", name: "娛樂", type: "expense", iconName: "Gamepad2", 
    subCategories: [
      { id: "e3-1", name: "電影", iconName: "Film" },
      { id: "e3-2", name: "遊樂園", iconName: "PartyPopper" },
      { id: "e3-3", name: "展覽", iconName: "Ticket" },
      { id: "e3-4", name: "遊戲", iconName: "Gamepad2" }
    ] 
  },
  { 
    id: "e4", name: "購物", type: "expense", iconName: "ShoppingBag", 
    subCategories: [
      { id: "e4-1", name: "衣物", iconName: "Shirt" },
      { id: "e4-2", name: "配件", iconName: "Watch" },
      { id: "e4-3", name: "電子產品", iconName: "Smartphone" },
      { id: "e4-4", name: "應用軟體", iconName: "Monitor" },
      { id: "e4-5", name: "美妝保養", iconName: "Sparkles" }
    ] 
  },
  { 
    id: "e5", name: "醫療", type: "expense", iconName: "Stethoscope", 
    subCategories: [
      { id: "e5-1", name: "牙齒保健", iconName: "Activity" },
      { id: "e5-2", name: "門診", iconName: "Hospital" },
      { id: "e5-3", name: "健康檢查", iconName: "Thermometer" },
      { id: "e5-4", name: "藥品", iconName: "Pill" },
      { id: "e5-5", name: "醫療用品", iconName: "Bandage" }
    ] 
  },
  { 
    id: "e6", name: "家居", type: "expense", iconName: "Home", 
    subCategories: [
      { id: "e6-1", name: "日常用品", iconName: "Package" },
      { id: "e6-2", name: "水費", iconName: "Droplets" },
      { id: "e6-3", name: "電費", iconName: "Zap" },
      { id: "e6-4", name: "燃料費", iconName: "Fuel" },
      { id: "e6-5", name: "電話費", iconName: "Smartphone" },
      { id: "e6-6", name: "網路費", iconName: "Wifi" },
      { id: "e6-7", name: "修繕費", iconName: "Wrench" },
      { id: "e6-8", name: "家具", iconName: "Sofa" },
      { id: "e6-9", name: "家電", iconName: "Tv2" }
    ] 
  },
  { 
    id: "e7", name: "學習", type: "expense", iconName: "Book", 
    subCategories: [
      { id: "e7-1", name: "課程", iconName: "GraduationCap" },
      { id: "e7-2", name: "教材", iconName: "Library" },
      { id: "e7-3", name: "書籍", iconName: "Book" },
      { id: "e7-4", name: "文具", iconName: "Edit3" }
    ] 
  },
  { 
    id: "e8", name: "其他", type: "expense", iconName: "Box", 
    subCategories: [
      { id: "e8-1", name: "其他", iconName: "Tag" }
    ] 
  },
  { 
    id: "i1", name: "收入", type: "income", iconName: "Wallet", 
    subCategories: [
      { id: "i1-1", name: "薪水", iconName: "Banknote" },
      { id: "i1-2", name: "固定家用", iconName: "Home" },
      { id: "i1-3", name: "獎金", iconName: "Trophy" }
    ] 
  },
  { 
    id: "i2", name: "投資", type: "income", iconName: "TrendingUp", 
    subCategories: [
      { id: "i2-1", name: "利息", iconName: "TrendingUp" },
      { id: "i2-2", name: "配息", iconName: "Coins" }
    ] 
  },
  { 
    id: "t1", name: "轉帳", type: "transfer", iconName: "ArrowLeftRight", 
    subCategories: [
      { id: "t1-1", name: "提款", iconName: "Replace" },
      { id: "t1-2", name: "存款", iconName: "PiggyBank" }
    ] 
  },
];

export const initializeDefaultData = async () => {
  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    await db.accounts.bulkAdd([
      { name: "銀行", initial_balance: 0, current_balance: 0, billing_cycle: 1, icon: "CreditCard" },
      { name: "現金", initial_balance: 0, current_balance: 0, billing_cycle: 1, icon: "Wallet" },
    ]);
  }

  const settingCount = await db.settings.where('key').equals('categories').count();
  if (settingCount === 0) {
    await db.settings.add({ key: 'categories', value: DEFAULT_CATEGORIES });
  }

  const budgetCount = await db.settings.where('key').equals('budget_settings').count();
  if (budgetCount === 0) {
    // Default budgets for main categories
    const initialBudgets = {
      "飲食": 0,
      "交通": 0,
      "娛樂": 0,
      "購物": 0,
      "醫療": 0,
      "家居": 0,
      "學習": 0,
      "其他": 0
    };
    await db.settings.add({ key: 'budget_settings', value: initialBudgets });
  }
};

// CRUD Helper Functions
export const addTransaction = async (data: Transaction) => {
  return await db.transaction('rw', db.transactions, db.accounts, async () => {
    const id = await db.transactions.add(data);
    // Update account balance automatically
    const account = await db.accounts.get(data.account_id);
    if (account) {
      const newBalance = account.current_balance + data.amount;
      await db.accounts.update(data.account_id, { current_balance: newBalance });
    }
    return id;
  });
};

export const deleteTransaction = async (idOrGroupId: number | string) => {
  if (typeof idOrGroupId === 'string') {
    const txs = await db.transactions.where('group_id').equals(idOrGroupId).toArray();
    if (txs.length === 0) return;

    return await db.transaction('rw', db.transactions, db.accounts, async () => {
      // Revert account balances for each item in group
      for (const tx of txs) {
        const account = await db.accounts.get(tx.account_id);
        if (account) {
          const newBalance = account.current_balance - tx.amount;
          await db.accounts.update(tx.account_id, { current_balance: newBalance });
        }
      }
      // Bulk delete the group
      const ids = txs.map(t => t.id).filter((id): id is number => id !== undefined);
      await db.transactions.bulkDelete(ids);
    });
  } else {
    const tx = await db.transactions.get(idOrGroupId);
    if (!tx) return;
    
    return await db.transaction('rw', db.transactions, db.accounts, async () => {
      await db.transactions.delete(idOrGroupId);
      // Revert account balance
      const account = await db.accounts.get(tx.account_id);
      if (account) {
        const newBalance = account.current_balance - tx.amount;
        await db.accounts.update(tx.account_id, { current_balance: newBalance });
      }
    });
  }
};

export const getTransactionsByMonth = async (yearMonth: string) => {
  // yearMonth expected as "YYYY-MM"
  return await db.transactions
    .filter(tx => tx.date.startsWith(yearMonth.replace('-', '/')))
    .toArray();
};

export const updateAccountBalance = async (accountId: number, amount: number) => {
  return await db.accounts.update(accountId, { current_balance: amount });
};

export const addAccount = async (data: Account) => {
  return await db.accounts.add(data);
};

export const updateAccount = async (id: number, data: Partial<Account>) => {
  return await db.accounts.update(id, data);
};

export const deleteAccount = async (id: number) => {
  return await db.accounts.delete(id);
};

export const getHistoryForAI = async () => {
  const transactions = await db.transactions
    .orderBy('date')
    .reverse()
    .limit(100)
    .toArray();
  
  // Create unique pairs of merchant-category
  const historyMap = new Map();
  transactions.forEach(tx => {
    if (tx.merchant) {
      const key = `${tx.merchant}-${tx.main_category}-${tx.sub_category}`;
      if (!historyMap.has(key)) {
        historyMap.set(key, {
          merchant: tx.merchant,
          main_category: tx.main_category,
          sub_category: tx.sub_category
        });
      }
    }
  });

  return Array.from(historyMap.values()).slice(0, 20); // Limit to top 20 distinct recent patterns
};
// Default Models for Forward Compatibility
const DEFAULT_ACCOUNT_MODEL: Account = {
  name: "",
  current_balance: 0,
  initial_balance: 0,
  icon: "CreditCard",
  billing_cycle: 1,
};

const DEFAULT_TRANSACTION_MODEL: Transaction = {
  date: "",
  type: "expense",
  main_category: "",
  sub_category: "",
  account_id: 0,
  amount: 0,
  item_name: "",
  merchant: "",
  status: "confirmed",
  billing_month: "",
  invoice_number: "",
  note: "",
};

export const exportDatabaseToJSON = async () => {
  const accounts = await db.accounts.toArray();
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.toArray();

  const backupData = {
    app_version: "1.0.0",
    export_timestamp: new Date().toISOString(),
    data: {
      accounts,
      transactions,
      settings
    }
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:T]/g, '').slice(0, 12);
  a.href = url;
  a.download = `Accounting_Backup_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importDatabaseFromJSON = async (file: File) => {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.data || !Array.isArray(backup.data.accounts) || !Array.isArray(backup.data.transactions)) {
      throw new Error("無效的備份檔案規格或遺失核心數據");
    }

  return await db.transaction('rw', db.accounts, db.transactions, db.settings, async () => {
    // Clear existing data
    await db.accounts.clear();
    await db.transactions.clear();
    await db.settings.clear();

    // Import and merge with default models
    const mergedAccounts = backup.data.accounts.map((acc: any) => ({
      ...DEFAULT_ACCOUNT_MODEL,
      ...acc
    }));

    const mergedTransactions = backup.data.transactions.map((tx: any) => ({
      ...DEFAULT_TRANSACTION_MODEL,
      ...tx
    }));

    const settings = backup.data.settings || [];

    await db.accounts.bulkAdd(mergedAccounts);
    await db.transactions.bulkAdd(mergedTransactions);
    if (settings.length > 0) {
      await db.settings.bulkAdd(settings);
    }
  });
  } catch (err) {
    console.error("Database import error:", err);
    throw err;
  }
};

/**
 * Factory Reset: Clears all user data and restores default settings/accounts.
 */
export const clearAllData = async () => {
  return await db.transaction('rw', db.accounts, db.transactions, db.settings, async () => {
    // 1. Clear everything
    await db.accounts.clear();
    await db.transactions.clear();
    await db.settings.clear();

    // 2. Re-initialize defaults
    await initializeDefaultData();
  });
};
