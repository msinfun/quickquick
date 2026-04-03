import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { 
  Plus, ArrowLeft, Tag, AlertTriangle, ChevronRight, GripVertical, Box, Trash2, ChevronLeft, Edit2, Check, Layers
} from "lucide-react";
import { ICON_MAP, ICON_GROUPS } from "@/constants/icons";
import { db } from "@/db/db";
import { useLiveQuery } from "dexie-react-hooks";

type CategoryType = "expense" | "income" | "transfer";

interface SubCategory {
  id: string;
  name: string;
  iconName: string;
}

interface Category {
  id: string;
  name: string;
  subCategories: SubCategory[];
  type: CategoryType;
  iconName: string;
}

interface CategoryManagementViewProps {
  onBack: () => void;
}

interface DeleteConfirmState {
  type: "main" | "sub";
  id: string;
  index?: number;
  name: string;
}

interface NewItemModalState {
  type: "main" | "sub";
  parentId?: string;
  name: string;
  iconName: string;
}

interface IconPickerState {
  categoryId: string;
  subIndex?: number;
  currentType: "main" | "sub" | "create";
}

import SwipeableDelete from "@/components/SwipeableDelete";

// ---------- CategoryItem ----------
interface CategoryItemProps {
  category: Category;
  isOpen: boolean;
  onOpenStateChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onDelete: (cat: Category) => void;
  onOpenPicker: (id: string) => void;
  renderIcon: (name: string) => React.ReactNode;
  globalReordering: boolean;
  setGlobalReordering: (val: boolean) => void;
}

const CategoryItem = ({ category, isOpen, onOpenStateChange, onSelect, onDelete, onOpenPicker, renderIcon, globalReordering, setGlobalReordering }: CategoryItemProps) => {
  const controls = useDragControls();
  
  return (
    <Reorder.Item 
      value={category}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setGlobalReordering(true)}
      onDragEnd={() => setGlobalReordering(false)}
      className="mb-0 flex items-center bg-transparent border-none p-0"
      style={{ overflow: "visible" }}
    >
      <SwipeableDelete 
        isOpen={isOpen}
        disabled={globalReordering}
        onOpenStateChange={onOpenStateChange}
        onDelete={() => onDelete(category)}
        className="w-full"
      >
        <div 
          onClick={() => !globalReordering && onSelect(category.id)}
          className="w-full p-item flex items-center justify-between bg-surface-primary active:bg-surface-glass transition-all ease-apple active:opacity-active"
        >
          <div className="flex items-center gap-item">
            <div 
              className="p-inner -ml-2 cursor-grab active:cursor-grabbing text-text-tertiary active:text-brand-primary transition-colors touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                setGlobalReordering(true);
                controls.start(e);
              }}
            >
              <GripVertical className="size-icon-md" />
            </div>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onOpenPicker(category.id); 
              }}
              className="size-icon-container text-[3rem] rounded-button bg-bg-base flex items-center justify-center border-2 border-border-subtle relative text-text-primary shadow-inner"
            >
              {renderIcon(category.iconName)}
            </button>
            <div>
              <h3 className="font-body text-h3 leading-tight text-text-primary">{category.name}</h3>
              <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide mt-1">
                {category.subCategories.length} 個細項
              </p>
            </div>
          </div>
          <ChevronRight className="size-icon-md text-text-tertiary ml-1" />
        </div>
      </SwipeableDelete>
    </Reorder.Item>
  );
};

// ---------- SubCategoryItem ----------
interface SubCategoryItemProps {
  sub: SubCategory;
  isOpen: boolean;
  onOpenStateChange: (open: boolean) => void;
  idx: number;
  mainId: string;
  onUpdateName: (mainId: string, idx: number, name: string) => void;
  onDelete: (mainId: string, idx: number, name: string) => void;
  onOpenPicker: (mainId: string, idx: number) => void;
  renderIcon: (name: string) => React.ReactNode;
  globalReordering: boolean;
  setGlobalReordering: (val: boolean) => void;
}

const SubCategoryItem = ({ sub, isOpen, onOpenStateChange, idx, mainId, onUpdateName, onDelete, onOpenPicker, renderIcon, globalReordering, setGlobalReordering }: SubCategoryItemProps) => {
  const controls = useDragControls();
  
  return (
    <Reorder.Item 
      value={sub}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setGlobalReordering(true)}
      onDragEnd={() => setGlobalReordering(false)}
      className="mb-0 flex items-center bg-transparent border-none p-0"
      style={{ overflow: "visible" }}
    >
      <SwipeableDelete 
        isOpen={isOpen}
        disabled={globalReordering}
        onOpenStateChange={onOpenStateChange}
        onDelete={() => onDelete(mainId, idx, sub.name)}
        className="w-full"
      >
        <div className="flex items-center justify-between p-item rounded-card bg-surface-primary border border-hairline border-border-subtle transition-all ease-apple">
          <div className="flex items-center gap-item flex-1">
            <div 
              className="p-inner -ml-2 cursor-grab active:cursor-grabbing text-text-tertiary active:text-brand-primary transition-colors touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                setGlobalReordering(true);
                controls.start(e);
              }}
            >
              <GripVertical className="size-icon-md" />
            </div>
            <button 
              onClick={() => onOpenPicker(mainId, idx)}
              className="size-icon-container text-[3rem] rounded-button bg-bg-base flex items-center justify-center text-text-primary transition-all border-2 border-border-subtle shadow-inner"
            >
              {renderIcon(sub.iconName)}
            </button>
            <div className="flex-1">
              <input 
                type="text" 
                value={sub.name}
                onChange={(e) => onUpdateName(mainId, idx, e.target.value)}
                className="bg-transparent border-none outline-none font-body text-h3 text-text-primary focus:text-text-primary transition-colors w-full"
              />
              <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide mt-0.5">次分類項</p>
            </div>
          </div>
        </div>
      </SwipeableDelete>
    </Reorder.Item>
  );
};

// ---------- Main View ----------
export default function CategoryManagementView({ onBack }: CategoryManagementViewProps) {
  // Use DB data instead of local hardcoded constant
  const categoriesSetting = useLiveQuery(() => 
    db.settings.where("key").equals("categories").first()
  );
  
  const categories: Category[] = categoriesSetting?.value || [];
  
  const updateDatabase = async (next: Category[]) => {
    const setting = await db.settings.where("key").equals("categories").first();
    if (setting?.id) {
       await db.settings.update(setting.id, { value: next });
    }
  };

  const [activeTab, setActiveTab] = useState<CategoryType>("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [newItemModal, setNewItemModal] = useState<NewItemModalState | null>(null);
  const [iconPicker, setIconPicker] = useState<IconPickerState | null>(null);
  const [activeIconGroup, setActiveIconGroup] = useState(ICON_GROUPS[0].group);

  useEffect(() => {
    setSwipedItemId(null);
    setIsReordering(false);
  }, [activeTab, selectedCategoryId]);

  const filteredCategories = useMemo(() => categories.filter(c => c.type === activeTab), [categories, activeTab]);
  const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCategoryId), [categories, selectedCategoryId]);

  const handleSelectIcon = (iconName: string) => {
    if (!iconPicker) return;
    if (iconPicker.currentType === "create") {
      setNewItemModal(prev => prev ? { ...prev, iconName } : null);
      setIconPicker(null);
      return;
    }
    const next = categories.map(c => {
      if (c.id === iconPicker.categoryId) {
        if (iconPicker.currentType === "main") {
          return { ...c, iconName };
        } else {
          const newSubs = [...c.subCategories];
          newSubs[iconPicker.subIndex!] = { ...newSubs[iconPicker.subIndex!], iconName };
          return { ...c, subCategories: newSubs };
        }
      }
      return c;
    });
    updateDatabase(next);
    setIconPicker(null);
  };

  const handleReorderMain = (newOrder: Category[]) => {
     const otherTabCategories = categories.filter(c => c.type !== activeTab);
     const next = [...otherTabCategories, ...newOrder];
     updateDatabase(next);
  };

  const handleReorderSub = (newOrder: SubCategory[]) => {
    if (!selectedCategoryId) return;
    const next = categories.map(c => {
      if (c.id === selectedCategoryId) return { ...c, subCategories: newOrder };
      return c;
    });
    updateDatabase(next);
  };

  const requestDeleteMain = (category: Category) => {
    setDeleteConfirm({ type: "main", id: category.id, name: category.name });
  };

  const executeDeleteMain = (id: string) => {
    const next = categories.filter(c => c.id !== id);
    updateDatabase(next);
    setDeleteConfirm(null);
  };

  const handleUpdateSubCategoryName = (mainId: string, subIdx: number, newName: string) => {
    const next = categories.map(c => {
      if (c.id === mainId) {
        const newSubs = [...c.subCategories];
        newSubs[subIdx] = { ...newSubs[subIdx], name: newName };
        return { ...c, subCategories: newSubs };
      }
      return c;
    });
    updateDatabase(next);
  };

  const requestDeleteSub = (mainId: string, subIdx: number, name: string) => {
    setDeleteConfirm({ type: "sub", id: mainId, index: subIdx, name });
  };

  const executeDeleteSub = (mainId: string, subIdx: number) => {
    const next = categories.map(c => {
      if (c.id === mainId) {
        return { ...c, subCategories: c.subCategories.filter((_, i) => i !== subIdx) };
      }
      return c;
    });
    updateDatabase(next);
    setDeleteConfirm(null);
  };

  const handleHeaderPlus = () => {
    if (selectedCategoryId) {
      setNewItemModal({ type: "sub", parentId: selectedCategoryId, name: "", iconName: "Tag" });
    } else {
      setNewItemModal({
        type: "main", name: "",
        iconName: activeTab === "income" ? "Wallet" : activeTab === "transfer" ? "ArrowLeftRight" : "Utensils"
      });
    }
  };

  const executeCreateItem = () => {
    if (!newItemModal || !newItemModal.name.trim()) return;
    let next: Category[] = [];
    if (newItemModal.type === "main") {
      const newCat: Category = {
        id: Math.random().toString(36).substr(2, 9),
        name: newItemModal.name,
        type: activeTab,
        iconName: newItemModal.iconName,
        subCategories: []
      };
      next = [...categories, newCat];
    } else {
      next = categories.map(c => {
        if (c.id === newItemModal.parentId) {
          return {
            ...c,
            subCategories: [
              ...c.subCategories, 
              { 
                id: Math.random().toString(36).substr(2, 9),
                name: newItemModal.name, 
                iconName: newItemModal.iconName 
              }
            ]
          };
        }
        return c;
      });
    }
    updateDatabase(next);
    setNewItemModal(null);
  };
  const renderIcon = (iconName: string, className: string = "size-icon-lg") => {
    const IconComponent = ICON_MAP[iconName] || Tag;
    return <IconComponent className={className} />;
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-modal bg-bg-base text-text-primary flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between px-screen pt-safe-top pb-item bg-bg-base/80 backdrop-blur-nav border-b border-hairline border-border-subtle sticky top-0 z-nav transition-all duration-normal ease-apple">
        <div className="flex items-center gap-item overflow-hidden">
          <button 
            onClick={() => selectedCategoryId ? setSelectedCategoryId(null) : onBack()} 
            className="p-inner -ml-2 rounded-inner hover:bg-surface-glass-heavy transition-all ease-apple shrink-0 active:opacity-active duration-fast"
          >
            <ChevronLeft className="size-icon-lg text-brand-primary" />
          </button>
          <h1 className="text-h3 font-h3 tracking-tight text-text-primary whitespace-nowrap truncate leading-tight">
            {selectedCategory ? `${selectedCategory.name}` : "分類管理"}
          </h1>
        </div>
        <button 
          onClick={handleHeaderPlus}
          className="p-inner.5 rounded-inner bg-brand-primary text-bg-base active:scale-95 transition-all ease-apple"
        >
          <Plus className="size-icon-lg" />
        </button>
      </header>

      <motion.div layoutScroll className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-section bg-bg-base px-screen pb-nav-clearance py-section">
        <AnimatePresence mode="wait">
          {!selectedCategoryId ? (
            <motion.div 
              key="main-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-item"
            >
              <div className="bg-surface-primary rounded-card overflow-hidden border border-hairline border-border-subtle divide-y-hairline divide-border-subtle flex">
                {(["expense", "income", "transfer"] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-item rounded-inner text-caption font-caption uppercase tracking-wide transition-all ease-apple ${
                      activeTab === tab ? "bg-brand-primary text-bg-base" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {tab === "expense" ? "支出" : tab === "income" ? "收入" : "轉帳"}
                  </button>
                ))}
              </div>

              {filteredCategories.length > 0 ? (
                <Reorder.Group 
                  axis="y" 
                  values={filteredCategories} 
                  onReorder={handleReorderMain}
                  className="flex flex-col gap-item"
                  style={{ overflow: "visible" }}
                >
                  {filteredCategories.map((category) => (
                    <CategoryItem 
                      key={category.id}
                      category={category}
                      isOpen={swipedItemId === category.id}
                      onOpenStateChange={(open) => setSwipedItemId(open ? category.id : null)}
                      onSelect={(id) => setSelectedCategoryId(id)}
                      onDelete={requestDeleteMain}
                      onOpenPicker={(id) => setIconPicker({ categoryId: id, currentType: "main" })}
                      renderIcon={(name) => renderIcon(name)}
                      globalReordering={isReordering}
                      setGlobalReordering={setIsReordering}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <div className="py-20 text-center flex flex-col items-center gap-item text-text-tertiary">
                  <Box className="size-avatar-lg stroke-[1] text-text-tertiary" />
                  <p className="text-body font-body text-text-tertiary leading-normal">目前沒有分類，點擊右上角 + 新增</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="sub-list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-item"
            >
              <Reorder.Group 
                axis="y" 
                values={selectedCategory?.subCategories || []} 
                onReorder={handleReorderSub}
                className="flex flex-col gap-item"
                style={{ overflow: "visible" }}
              >
                {selectedCategory?.subCategories.map((sub, idx) => (
                  <SubCategoryItem 
                    key={sub.id}
                    sub={sub}
                    isOpen={swipedItemId === sub.id}
                    onOpenStateChange={(open) => setSwipedItemId(open ? sub.id : null)}
                    idx={idx}
                    mainId={selectedCategoryId!}
                    onUpdateName={handleUpdateSubCategoryName}
                    onDelete={requestDeleteSub}
                    onOpenPicker={(mid, sidx) => setIconPicker({ categoryId: mid, subIndex: sidx, currentType: "sub" })}
                    renderIcon={(name) => renderIcon(name)}
                    globalReordering={isReordering}
                    setGlobalReordering={setIsReordering}
                  />
                ))}
              </Reorder.Group>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {newItemModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-section bg-bg-base/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-surface-primary border border-border-subtle w-full max-w-sm p-section flex flex-col gap-section rounded-card shadow-dropdown"
            >
              <div className="text-center">
                <h3 className="text-h2 font-h2 tracking-tight mb-1 text-text-primary leading-tight">
                  新增{newItemModal.type === "main" ? "主分類" : "次分類"}
                </h3>
                <p className="text-caption font-caption text-text-tertiary uppercase tracking-wide leading-normal">
                  {newItemModal.type === "main" ? activeTab : "Sub Category"}
                </p>
              </div>

              <div className="flex flex-col items-center gap-section">
                <button 
                  onClick={() => setIconPicker({ categoryId: "create", currentType: "create" })}
                  className="w-20 h-20 rounded-button bg-bg-base flex items-center justify-center border-2 border-brand-primary text-brand-primary ease-apple active:scale-90 transition-all"
                >
                  {renderIcon(newItemModal.iconName, "size-icon-container text-h1")}
                </button>
                <div className="w-full">
                  <input 
                    autoFocus
                    type="text" 
                    value={newItemModal.name}
                    onChange={(e) => setNewItemModal({ ...newItemModal, name: e.target.value })}
                    placeholder="輸入類別名稱..."
                    className="w-full bg-bg-base border border-border-subtle rounded-inner py-item px-section text-h2 font-body text-center outline-none focus:border-brand-primary/50 transition-all placeholder:text-text-tertiary leading-tight"
                    onKeyDown={(e) => e.key === "Enter" && executeCreateItem()}
                  />
                  <p className="text-center text-text-tertiary text-caption mt-3 font-caption">點擊圖示可切換</p>
                </div>
              </div>

              <div className="flex flex-col w-full gap-item">
                <button 
                  onClick={executeCreateItem}
                  disabled={!newItemModal.name.trim()}
                   className="w-full py-item rounded-button bg-brand-primary text-bg-base font-h3 active:scale-95 transition-all ease-apple disabled:opacity-20"
                >
                  確認建立
                </button>
                <button 
                  onClick={() => setNewItemModal(null)}
                  className="w-full py-item rounded-button bg-surface-glass text-text-secondary font-body active:scale-95 transition-all ease-apple"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {iconPicker && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-section bg-bg-base/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-surface-primary border border-border-subtle w-full max-w-sm h-[80vh] flex flex-col rounded-card shadow-dropdown overflow-hidden"
            >
              <div className="p-section pb-4 flex flex-col gap-section flex-shrink-0">
                <div className="flex flex-col gap-inner text-center">
                  <h3 className="text-h2 font-h2 tracking-tight text-text-primary leading-tight">選擇圖示</h3>
                  <div className="flex gap-inner overflow-x-auto no-scrollbar pb-1 -mx-2 px-inner mask-linear-r min-h-[44px] items-center">
                    {ICON_GROUPS.map(group => (
                      <button
                        key={group.group}
                        onClick={() => setActiveIconGroup(group.group)}
                        className={`whitespace-nowrap px-item py-inner rounded-inner text-caption font-h3 uppercase tracking-wide transition-all ease-apple flex-shrink-0 ${
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

              <div className="flex-1 overflow-y-auto no-scrollbar px-screen pb-32 grid grid-cols-4 gap-section auto-rows-min">
                {ICON_GROUPS.find(g => g.group === activeIconGroup)?.icons.map(iconName => (
                  <button
                    key={iconName}
                    onClick={() => handleSelectIcon(iconName)}
                    className={`aspect-square w-full rounded-input flex items-center justify-center transition-all bg-bg-base hover:bg-surface-glass border-2 ${
                      (iconPicker.currentType === "create" ? newItemModal?.iconName : 
                       iconPicker.currentType === "main" ? categories.find(c => c.id === iconPicker.categoryId)?.iconName :
                       categories.find(c => c.id === iconPicker.categoryId)?.subCategories[iconPicker.subIndex!]?.iconName
                      ) === iconName 
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary" 
                        : "border-transparent text-text-tertiary"
                    }`}
                  >
                    {renderIcon(iconName, "size-icon-lg")}
                  </button>
                ))}
              </div>

              <div className="p-section border-t border-border-subtle bg-bg-base">
                <button 
                  onClick={() => setIconPicker(null)}
                  className="w-full py-item rounded-button bg-surface-glass text-text-secondary font-body active:scale-95 transition-all ease-apple"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-section bg-bg-base/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-primary border border-border-subtle w-full max-w-sm p-section flex flex-col items-center gap-section text-center rounded-card shadow-dropdown"
            >
              <div className="size-avatar-lg rounded-button bg-semantic-danger/20 flex items-center justify-center border border-semantic-danger/30">
                <AlertTriangle className="size-icon-container text-h1 text-semantic-danger" />
              </div>
              <section className="flex flex-col gap-item">
                <h3 className="text-h2 font-h2 tracking-tight text-semantic-danger leading-tight">刪除分類</h3>
                <p className="text-text-tertiary text-body font-caption leading-normal">
                  確定要刪除「<span className="text-text-primary font-body">{deleteConfirm.name}</span>」？<br/>
                  這將會連帶刪除所有關聯的次分類。
                </p>
              </section>
              <div className="flex flex-col w-full gap-item mt-inner">
                <button 
                  onClick={() => deleteConfirm.type === "main" ? executeDeleteMain(deleteConfirm.id) : executeDeleteSub(deleteConfirm.id, deleteConfirm.index!)}
                   className="w-full py-item rounded-button bg-semantic-danger text-text-primary font-h3 active:scale-95 transition-all ease-apple"
                >
                  確認刪除
                </button>
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full py-item rounded-button bg-surface-glass text-text-secondary font-body active:scale-95 transition-all ease-apple"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
