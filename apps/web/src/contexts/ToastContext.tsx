import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../components/icons";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

/* Errors stay longer, since they carry a reason to read. */
const DURATION: Record<ToastKind, number> = { success: 2000, error: 5000 };

/* One toast at a time, above the bottom nav; a new one replaces the old. */
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    setToast({ id: Date.now(), kind, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DURATION[toast.kind]);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed left-0 right-0 flex justify-center z-[60] px-4 pointer-events-none"
        style={{ bottom: 76 }}
      >
        {/* wait: the old toast leaves before a new one comes in */}
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={toast.id}
              role={toast.kind === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={() => setToast(null)}
              className="font-hand font-bold flex items-center gap-2 pointer-events-auto"
              style={{
                maxWidth: 448,
                padding: "7px 18px",
                borderRadius: 18,
                background: toast.kind === "error" ? "var(--red)" : "var(--ink)",
                color: toast.kind === "error" ? "var(--on-accent)" : "var(--paper)",
                fontSize: "1.1rem",
                boxShadow: "0 6px 20px var(--shadow)",
                cursor: "pointer",
              }}
            >
              <Icon name={toast.kind === "error" ? "x" : "check"} size={15} strokeWidth={2.8} />
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
