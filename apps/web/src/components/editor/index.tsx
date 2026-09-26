import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { circleBtn } from "../circleBtn";

/* ── Modal wrapper ──────────────────────────────────────────────── */

/* 確定 only updates the page's draft; the page's 完成 saves it (see
   useEditSession). */
interface EditModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

export function EditModal({ title, open, onClose, onSave, children }: EditModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(40,30,20,.45)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 mx-auto z-50 overflow-y-auto scrollbar-hide"
            style={{
              maxWidth: 480,
              maxHeight: "90vh",
              background: "var(--paper)",
              borderRadius: "20px 20px 0 0",
              borderTop: "2px dashed var(--red)",
              boxShadow: "0 -8px 40px rgba(40,30,20,.2)",
              padding: "20px 20px 32px",
            }}
          >
            {/* Handle */}
            <div style={{ width: 44, height: 4, background: "var(--red)", borderRadius: 2, margin: "0 auto 16px", opacity: .5 }} />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-hand font-bold" style={{ fontSize: "1.4rem", color: "var(--red)" }}>
                ✏ {title}
              </span>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  border: "1.5px solid var(--ink)",
                  background: "var(--paper)", color: "var(--ink)",
                  fontSize: 16, cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* Form content */}
            <div className="flex flex-col gap-3">
              {children}
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  border: "1.5px solid var(--ink)",
                  background: "transparent", color: "var(--ink)",
                  fontFamily: "inherit", fontSize: ".95rem", cursor: "pointer",
                }}
              >
                取消
              </button>
              <button
                onClick={onSave}
                style={{
                  flex: 2, padding: "10px 0", borderRadius: 12,
                  border: "1.5px solid var(--red)",
                  background: "var(--red)", color: "#fff",
                  fontFamily: "inherit", fontSize: ".95rem", fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                確定
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Form fields ────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontSize: ".7rem", fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: ".14em", textTransform: "uppercase",
  color: "var(--ink-soft)", marginBottom: 4, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  background: "var(--paper-2)",
  border: "1.5px dashed var(--rule)",
  borderRadius: 8, color: "var(--ink)",
  fontFamily: "inherit", fontSize: ".92rem",
  outline: "none", boxSizing: "border-box",
};

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

export function FieldInput({ label, value, onChange, placeholder, type = "text" }: FieldInputProps) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

interface FieldTextareaProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export function FieldTextarea({ label, value, onChange, placeholder, rows = 3 }: FieldTextareaProps) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    </div>
  );
}

interface FieldSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

export function FieldSelect({ label, value, onChange, options }: FieldSelectProps) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* Tags input: comma-separated string → string[] */
interface FieldTagsProps {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

export function FieldTags({ label, value, onChange, placeholder }: FieldTagsProps) {
  return (
    <div>
      <span style={labelStyle}>{label}（逗號分隔）</span>
      <input
        type="text"
        value={value.join(", ")}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
        style={inputStyle}
      />
    </div>
  );
}

/* Image picker: previews `value` (an image URL, "" for none) and hands the
   picked file to `onPick`; the page decides what to do with it. */
interface FieldImageProps {
  label: string;
  value: string;
  onPick: (file: File) => void;
  onRemove: () => void;
  /** The picked file is still being prepared. */
  busy?: boolean;
}

const imageBtn: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 14,
  border: "1.5px solid var(--ink)",
  background: "transparent", color: "var(--ink)",
  fontFamily: "inherit", fontSize: ".85rem", cursor: "pointer",
};

export function FieldImage({ label, value, onPick, onRemove, busy }: FieldImageProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: 170, borderRadius: 8, background: "var(--paper-2)", border: "1.5px dashed var(--rule)" }}
      >
        {value ? (
          <img src={value} alt={`${label}預覽`} className="w-full h-full object-cover" />
        ) : (
          <span className="font-hand" style={{ fontSize: "1rem", color: "var(--ink-soft)" }}>還沒有圖片</span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          style={{ ...imageBtn, opacity: busy ? .5 : 1 }}
        >
          {busy ? "處理中…" : value ? "更換圖片" : "選擇圖片"}
        </button>
        {value && !busy && (
          <button type="button" onClick={onRemove} style={{ ...imageBtn, borderColor: "var(--red)", color: "var(--red)" }}>
            移除
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so picking the same file again still fires
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

/* ── Action buttons ─────────────────────────────────────────────── */

const actionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  border: "none", background: "transparent", cursor: "pointer",
  padding: 4, borderRadius: 6, lineHeight: 1,
  transition: "opacity .15s",
};

export function EditBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title="編輯"
      style={{ ...actionBtn, color: "var(--blue)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  );
}

export function DeleteBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title="刪除"
      style={{ ...actionBtn, color: "var(--red)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>
  );
}

interface AddBtnProps {
  onClick: () => void;
  label?: string;
  /** The bigger one for the bottom bar (see BottomBar), sharing the row with the others. */
  bar?: boolean;
}

const addBtnBar: React.CSSProperties = {
  flex: 1, maxWidth: 200, height: 38, borderRadius: 19, fontSize: "1.1rem",
};

export function AddBtn({ onClick, label, bar }: AddBtnProps) {
  return (
    <button
      onClick={onClick}
      className="font-hand font-bold flex items-center justify-center gap-1.5"
      style={{
        padding: "5px 14px", borderRadius: 14,
        border: "1.5px dashed var(--ink)",
        background: "transparent", color: "var(--ink)",
        fontSize: ".9rem", cursor: "pointer",
        transition: "opacity .15s",
        ...(bar && addBtnBar),
      }}
    >
      <svg width={bar ? 15 : 13} height={bar ? 15 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      {label ?? "新增"}
    </button>
  );
}

/* Edit-mode controls at the right of the header, round like the header's
   other buttons: 編輯 in view mode; 取消 and 完成 while editing (see
   useEditSession). The names are aria-labels, not titles: the cards'
   EditBtn is found by its title "編輯". */
interface EditControlsProps {
  editing: boolean;
  saving: boolean;
  onStart: () => void;
  onCancel: () => void;
  onFinish: () => void;
}

export function EditControls({ editing, saving, onStart, onCancel, onFinish }: EditControlsProps) {
  if (!editing) {
    return (
      <button onClick={onStart} aria-label="編輯" style={{ ...circleBtn, cursor: "pointer" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    );
  }
  const busy: React.CSSProperties = { cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .5 : 1 };
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={onCancel} disabled={saving} aria-label="取消" style={{ ...circleBtn, ...busy }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
      <button
        onClick={onFinish}
        disabled={saving}
        aria-label={saving ? "儲存中…" : "完成"}
        style={{ ...circleBtn, background: "var(--ink)", color: "var(--paper)", ...busy }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
    </div>
  );
}

/* Read-only banner: the data on screen is a fallback or cached copy, so the
   edit controls are hidden (see Loaded.editable in dataSource.ts). */
export function ReadOnlyBanner() {
  return (
    <div
      role="status"
      className="font-mono text-center"
      style={{
        fontSize: ".65rem", letterSpacing: ".14em",
        padding: "3px 0",
        background: "repeating-linear-gradient(90deg, var(--red) 0, var(--red) 6px, transparent 6px, transparent 12px)",
        backgroundSize: "12px 3px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "0 100%",
        borderBottom: "none",
        color: "var(--red)",
      }}
    >
      ⚠ 離線資料・暫時無法編輯
    </div>
  );
}
