"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import AccountView from "@/views/AccountView";
import PendingView from "@/views/PendingView";
import HomeView from "@/views/HomeView";
import AddView from "@/views/AddView";
import BudgetView from "@/views/BudgetView";
import EditBudgetView from "@/views/EditBudgetView";
import ReportsView from "@/views/ReportsView";
import SettingsView from "@/views/SettingsView";
import { initializeDefaultData } from "@/db/db";
import { useRecurringProcessor } from "@/hooks/useRecurringProcessor";

export default function App() {
  useRecurringProcessor();
  const [activeTab, setActiveTab] = useState("home");
  const [isAddMode, setIsAddMode] = useState(false);
  const [budgetMode, setBudgetMode] = useState<"none" | "view" | "edit">("none");

  useEffect(() => {
    initializeDefaultData();
  }, []);

  // When switching tabs, exit Add and Budget modes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsAddMode(false);
    setBudgetMode("none");
    
    // Special: click home while already on home -> Add mode
    if (tab === "home" && activeTab === "home") {
      setIsAddMode(true);
    }
  };

  const renderView = () => {
    switch (activeTab) {
      case "account":
        return <AccountView />;
      case "pending":
        return <PendingView />;
      case "home":
        if (isAddMode) return (
          <AddView 
            onBack={() => setIsAddMode(false)} 
            onSuccess={() => {
              setIsAddMode(false);
              setActiveTab("pending");
            }} 
          />
        );
        if (budgetMode === "view") return <BudgetView onBack={() => setBudgetMode("none")} onEdit={() => setBudgetMode("edit")} />;
        if (budgetMode === "edit") return <EditBudgetView onBack={() => setBudgetMode("view")} onSave={() => setBudgetMode("view")} />;
        return <HomeView onBudgetClick={() => setBudgetMode("view")} />;
      case "reports":
        return <ReportsView />;
      case "settings":
        return <SettingsView />;
      default:
        return <HomeView onBudgetClick={() => setBudgetMode("view")} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* View Content */}
      <div className="flex-1 w-full h-full animate-in fade-in zoom-in-95 duration-normal">
        {renderView()}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} isAddMode={isAddMode} />
    </div>
  );
}
