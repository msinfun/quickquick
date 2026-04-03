import React from "react";
import { Trash2 } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";

export const SwipeableDelete = ({ 
  children, 
  onDelete, 
  isOpen, 
  className = "",
  disabled = false,
  onOpenStateChange 
}: { 
  children: React.ReactNode; 
  onDelete: () => void; 
  isOpen: boolean; 
  className?: string;
  disabled?: boolean;
  onOpenStateChange: (open: boolean) => void;
}) => {
  const x = useMotionValue(0);

  // Animate button visibility and scale based on drag distance
  const buttonOpacity = useTransform(x, [-100, -20, 0], [1, 0, 0]);
  const buttonScale = useTransform(x, [-100, -20, 0], [1, 0.5, 0.5]);

  return (
    <div className={`relative overflow-hidden rounded-card bg-bg-base ${className || ''}`}>
      {/* Background Circular Delete Button */}
      <div className="absolute inset-y-0 right-0 w-28 flex items-center justify-center px-item z-0">
        <motion.button
          style={{ opacity: buttonOpacity, scale: buttonScale }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            onOpenStateChange(false);
          }}
          className="w-14 h-14 rounded-button bg-semantic-danger text-text-primary flex items-center justify-center active:scale-90 active:opacity-active transition-all duration-fast shadow-xl shadow-semantic-danger/20"
        >
          <Trash2 className="size-icon-lg" />
        </motion.button>
      </div>

      {/* Foreground Content - Opaque Background to hide button */}
      <motion.div
        drag={disabled ? false : "x"}
        style={{ x }}
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.05}
        animate={{ x: isOpen ? -100 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onDragStart={() => {
          if (!isOpen) onOpenStateChange(true);
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -30) onOpenStateChange(true);
          else onOpenStateChange(false);
        }}
        className="relative z-10 bg-surface-primary rounded-card overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableDelete;
