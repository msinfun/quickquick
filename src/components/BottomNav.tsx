import { CreditCard, Clock, Plus, BarChart2, Settings, Home } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAddMode: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, isAddMode }: BottomNavProps) {
  const tabs = [
    { id: "account", label: "帳戶", icon: CreditCard },
    { id: "pending", label: "待審核", icon: Clock },
    { id: "home", label: "記帳", icon: Plus, isProminent: true },
    { id: "reports", label: "報表", icon: BarChart2 },
    { id: "settings", label: "設定", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-sm z-nav bg-surface-glass backdrop-blur-standard border border-border-subtle rounded-button shadow-floating transition-all duration-normal ease-apple flex items-center justify-between px-section py-item">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        if (tab.isProminent) {
          let DynamicIcon = Icon;
          if (activeTab === "home") {
            DynamicIcon = Plus;
          } else {
            DynamicIcon = Home;
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center gap-micro group outline-none"
            >
              <div className="size-icon-container text-[3rem] rounded-button bg-brand-primary p-[1.5px] shadow-[0_8px_20px_rgba(16,185,129,0.2)] transition-transform duration-normal group-active:scale-95 active:opacity-active shrink-0 flex items-center justify-center">
                <div className="w-full h-full rounded-button bg-bg-base flex items-center justify-center">
                  <div className="w-full h-full rounded-button bg-brand-primary/10 flex items-center justify-center">
                    <DynamicIcon className="size-icon-lg text-brand-primary" strokeWidth={2.5} />
                  </div>
                </div>
              </div>
              <span className={`text-micro font-micro tracking-wide transition-colors duration-normal ease-apple ${isActive ? "text-brand-primary" : "text-text-secondary"}`}>
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center gap-micro w-14 outline-none transition-all duration-normal group"
          >
            <div
              className={`flex items-center justify-center p-inner rounded-button transition-all duration-fast ${
                isActive 
                  ? "bg-brand-primary/10 shadow-[inset_0_1px_rgba(255,255,255,0.1)] active:opacity-active" 
                  : "bg-transparent group-active:bg-surface-glass group-active:scale-90 active:opacity-active"
              }`}
            >
              <Icon 
                className={`size-icon-lg transition-all duration-fast ${
                  isActive ? "text-brand-primary scale-110" : "text-text-tertiary"
                }`} 
                strokeWidth={isActive ? 2.5 : 2}
              />
            </div>
            <span
              className={`text-micro font-micro tracking-wide transition-all duration-normal ease-apple ${
                isActive ? "text-brand-primary" : "text-text-secondary"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
