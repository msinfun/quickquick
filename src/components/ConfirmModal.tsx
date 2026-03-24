import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "確認",
  cancelText = "取消",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-overlay bg-bg-base/60 backdrop-blur-heavy"
          />
          <div className="fixed inset-0 z-modal flex items-center justify-center p-item pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-[320px] bg-surface-primary border border-hairline border-border-subtle p-section shadow-dropdown pointer-events-auto flex flex-col items-center text-center rounded-card ease-spring"
            >
               <h3 className="text-h3 font-h3 text-text-primary tracking-tight mb-inner leading-tight">{title}</h3>
              <p className="text-text-secondary font-body text-body mb-section leading-relaxed">
                {message}
              </p>

              <div className="flex flex-col gap-item w-full">
                <button
                  onClick={() => {
                    onConfirm();
                    onCancel(); // Close after confirming
                  }}
                   className={`w-full py-item rounded-button font-h3 text-h3 active:scale-[0.98] active:opacity-active transition-all duration-fast ease-apple shadow-lg ${
                    isDestructive 
                      ? "bg-semantic-danger/20 text-semantic-danger border border-hairline border-semantic-danger/30" 
                      : "bg-brand-primary text-bg-base font-h3 shadow-brand-primary/20"
                  }`}
                >
                  {confirmText}
                </button>
                <button
                  onClick={onCancel}
                   className="w-full py-item rounded-button font-body text-body bg-surface-glass text-text-tertiary active:bg-surface-glass-heavy active:scale-[0.98] active:opacity-active transition-all duration-fast ease-apple border border-hairline border-border-subtle"
                >
                  {cancelText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
