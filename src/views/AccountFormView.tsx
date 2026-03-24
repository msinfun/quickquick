import { useState, useEffect } from "react";
import { ChevronLeft, Wallet, DollarSign, Calendar, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ICON_MAP, ICON_GROUPS } from "@/constants/icons";

interface Account {
  id?: number;
  name: string;
  initial_balance?: number;
  current_balance: number;
  billing_cycle?: number;
  icon?: string;
}

interface AccountFormViewProps {
  initialData?: Account | null;
  onSave: (account: any) => void;
  onBack: () => void;
}

export default function AccountFormView({ initialData, onSave, onBack }: AccountFormViewProps) {
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [billingCycle, setBillingCycle] = useState("1");
  const [iconName, setIconName] = useState("CreditCard");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [activeIconGroup, setActiveIconGroup] = useState(ICON_GROUPS[0].group);

  // Load existing data if editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setInitialBalance(initialData.initial_balance ? initialData.initial_balance.toString() : "");
      setBillingCycle(initialData.billing_cycle ? initialData.billing_cycle.toString() : "");
      setIconName(initialData.icon || "CreditCard");
    } else {
      setName("");
      setInitialBalance("");
      setBillingCycle("");
      setIconName("CreditCard");
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !initialBalance) return;
    
    // Auto calculate current_balance same as initial_balance for new items
    const parsedInitial = parseInt(initialBalance.replace(/,/g, ""), 10) || 0;
    
    const accountData: any = {
      name,
      initial_balance: parsedInitial,
      current_balance: initialData ? initialData.current_balance : parsedInitial,
      billing_cycle: parseInt(billingCycle, 10) || 1,
      icon: iconName
    };

    if (initialData?.id) {
      accountData.id = initialData.id;
    }
    
    onSave(accountData);
  };

  const renderIcon = (name: string, className: string = "size-icon-lg") => {
    const IconComponent = ICON_MAP[name] || Tag;
    return <IconComponent className={className} />;
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex items-center gap-3 overflow-hidden">
          <button onClick={onBack} className="p-inner -ml-inner rounded-button active:bg-surface-glass-heavy transition-all duration-normal ease-apple active:opacity-active shrink-0">
            <ChevronLeft className="size-icon-lg text-brand-primary" />
          </button>
          <h1 className="text-h3 font-h3 tracking-tight text-text-primary leading-tight whitespace-nowrap truncate">{initialData ? "編輯帳戶" : "新增帳戶"}</h1>
        </div>
      </header>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-screen pb-nav-clearance flex flex-col gap-section bg-bg-base">
        <form onSubmit={handleSubmit} className="flex flex-col gap-section py-section">
          
          {/* Icon Selector */}
          <div className="flex flex-col items-center gap-item mb-item">
            <button 
              type="button"
              onClick={() => setShowIconPicker(true)}
              className="size-avatar-lg rounded-button bg-bg-base flex items-center justify-center border-thick border-brand-primary text-brand-primary transition-all duration-normal ease-apple active:scale-90 active:opacity-active"
            >
              {renderIcon(iconName, "size-icon-container")}
            </button>
            <p className="text-text-tertiary text-caption font-caption uppercase tracking-wide">點擊更換圖示</p>
          </div>

          <div className="flex flex-col gap-item">
            <label className="text-caption font-caption text-text-tertiary px-inner-label uppercase tracking-wide">
              帳戶名稱
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的薪資帳戶"
              className="w-full bg-bg-base border border-hairline border-border-subtle rounded-input p-item text-body font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary/50 transition-all duration-normal ease-apple leading-normal"
              required
            />
          </div>

          <div className="flex flex-col gap-item">
            <label className="text-caption font-caption text-text-tertiary px-inner-label uppercase tracking-wide">
              初始設定金額
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-item flex items-center pointer-events-none">
                <DollarSign className="size-icon-md text-text-tertiary" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9]*"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bg-base border border-hairline border-border-subtle rounded-input py-item pl-input-pl pr-item text-body font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary/50 transition-all duration-normal ease-apple tabular-nums"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-item">
            <label className="text-caption font-caption text-text-tertiary px-inner-label uppercase tracking-wide">
              帳單週期日
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-item flex items-center pointer-events-none">
                <Calendar className="size-icon-md text-text-tertiary" />
              </div>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                max="31"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                placeholder="1"
                className="w-full bg-bg-base border border-hairline border-border-subtle rounded-input py-item pl-input-pl pr-item text-body font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary/50 transition-all duration-normal ease-apple tabular-nums"
                required
              />
            </div>
          </div>

          <div className="mt-section">
            <button 
              type="submit"
              className="w-full py-item rounded-button bg-brand-primary text-bg-base font-h3 hover:scale-[1.02] active:scale-95 transition-all duration-normal mt-item active:opacity-active ease-apple"
            >
              完成設定
            </button>
          </div>
        </form>
      </div>

      {/* Shared Icon Picker Overlay */}
      <AnimatePresence>
        {showIconPicker && (
          <div className="fixed inset-0 z-modal bg-bg-base/95 backdrop-blur-md flex flex-col items-center justify-center p-section overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-primary rounded-card border border-hairline border-border-subtle w-full max-w-sm flex flex-col shadow-dropdown overflow-hidden"
            >
              <div className="p-item pb-inner flex flex-col gap-section flex-shrink-0">
                <div className="flex flex-col gap-1 text-center">
                  <h3 className="text-h2 font-h2 tracking-tight text-text-primary">選擇圖示</h3>
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pb-micro -mx-inner px-inner mask-linear-r min-h-[44px] items-center">
                    {ICON_GROUPS.map(group => (
                      <button
                        key={group.group}
                        type="button"
                        onClick={() => setActiveIconGroup(group.group)}
                        className={`whitespace-nowrap px-item py-inner rounded-button text-caption font-h3 uppercase tracking-wide transition-all duration-normal ease-apple flex-shrink-0 ${
                          activeIconGroup === group.group 
                          ? "bg-brand-primary text-bg-base" 
                          : "text-text-secondary hover:text-text-primary bg-surface-glass"
                        }`}
                      >
                        {group.group}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-scroll no-scrollbar p-item grid grid-cols-4 gap-item auto-rows-min">
                {ICON_GROUPS.find(g => g.group === activeIconGroup)?.icons.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setIconName(name);
                      setShowIconPicker(false);
                    }}
                    className={`aspect-square w-full rounded-inner flex items-center justify-center transition-all duration-normal ease-apple bg-surface-primary hover:bg-surface-glass border-thick ${
                      iconName === name 
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary" 
                        : "border-border-subtle text-text-tertiary"
                    }`}
                  >
                    {renderIcon(name, "size-icon-lg")}
                  </button>
                ))}
              </div>

              <div className="p-item border-t border-border-subtle bg-bg-base">
                <button 
                  type="button"
                  onClick={() => setShowIconPicker(false)}
                  className="w-full py-item rounded-button bg-surface-glass text-text-secondary font-body active:scale-95 transition-all duration-normal ease-apple"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
