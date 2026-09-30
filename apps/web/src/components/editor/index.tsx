import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { circleBtn } from "../circleBtn";
import { btn } from "../btn";
import { Icon, type IconName } from "../icons";

/* ── Bottom sheet ───────────────────────────────────────────────── */

interface SheetProps {
  /** Shown in the header, after `icon`; also names the dialog. */
  title: string;
  icon: IconName;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** A sheet that slides up over the page, closed by its × or a tap outside. */
export function Sheet({ title, icon, open, onClose, children }: SheetProps) {
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
            style={{ background: "var(--scrim)", backdropFilter: "blur(3px)" }}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 mx-auto z-50 overflow-y-auto scrollbar-hide"
            style={{
              maxWidth: 480,
              maxHeight: "90vh",
              background: "var(--paper)",
              borderRadius: "22px 22px 0 0",
              borderTop: "2px dashed var(--red)",
              boxShadow: "0 -8px 40px var(--shadow)",
              padding: "14px 20px 30px",
            }}
          >
            {/* Handle */}
            <div style={{ width: 44, height: 4, background: "var(--red)", borderRadius: 2, margin: "0 auto 14px", opacity: .5 }} />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-hand font-bold flex items-center gap-2" style={{ fontSize: 26, color: "var(--red)" }}>
                <Icon name={icon} size={20} />
                {title}
              </span>
              <button
                onClick={onClose}
                aria-label="關閉"
                style={{ ...circleBtn, width: 40, height: 40, background: "var(--paper)", cursor: "pointer" }}
              >
                <Icon name="x" size={15} strokeWidth={2.5} />
              </button>
            </div>

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

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
    <Sheet title={title} icon="pencil" open={open} onClose={onClose}>
      {/* Form content */}
      <div className="flex flex-col gap-3">
        {children}
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 mt-5 font-hand font-bold">
        <button onClick={onClose} style={{ ...btn("outline", 46), flex: 1 }}>
          取消
        </button>
        <button onClick={onSave} style={{ ...btn("accent", 46), flex: 2 }}>
          確定
        </button>
      </div>
    </Sheet>
  );
}

/* ── Form fields ────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontSize: ".66rem", fontFamily: "'DM Mono', ui-monospace, monospace",
  letterSpacing: ".14em", textTransform: "uppercase",
  color: "var(--ink-soft)", marginBottom: 5, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 42, padding: "9px 12px",
  background: "var(--paper-2)",
  border: "1.5px dashed var(--rule)",
  borderRadius: 8, color: "var(--ink)",
  fontFamily: "inherit", fontSize: 15,
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
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
      />
    </div>
  );
}

/* Pick one of a few stickers (the schedule's categories): each is a round
   button showing its glyph, named by its label; the picked one's label is
   repeated after the field's. */
export interface StickerOption {
  value: string;
  label: string;
  glyph: string;
  /** The sticker's color class (.st-*). */
  cls: string;
}

interface FieldStickersProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: StickerOption[];
}

export function FieldStickers({ label, value, onChange, options }: FieldStickersProps) {
  const picked = options.find((o) => o.value === value);
  return (
    <div>
      <span style={labelStyle}>
        {label}
        {picked && <span style={{ color: "var(--ink)", marginLeft: 8 }}>· {picked.label}</span>}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5" style={{ paddingTop: 2 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.value)}
              className={o.cls}
              style={{
                width: 36, height: 36, borderRadius: "50%", border: "none", padding: 0,
                fontSize: 15, fontWeight: 600, cursor: "pointer",
                transform: on ? "rotate(-6deg)" : undefined,
                boxShadow: on ? "0 0 0 2px var(--paper), 0 0 0 3.5px var(--ink)" : undefined,
              }}
            >
              {o.glyph}
            </button>
          );
        })}
      </div>
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

export function FieldImage({ label, value, onPick, onRemove, busy }: FieldImageProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div
        className={`flex flex-col items-center justify-center gap-1.5 overflow-hidden ${value ? "" : "hatch-bg"}`}
        style={{ height: 170, borderRadius: 8, background: value ? "var(--paper-2)" : undefined, border: "1.5px dashed var(--rule)", color: "var(--ink-faint)" }}
      >
        {value ? (
          <img src={value} alt={`${label}預覽`} className="w-full h-full object-cover" />
        ) : (
          <>
            <Icon name="briefcase" size={30} strokeWidth={1.6} />
            <span className="font-hand" style={{ fontSize: "1rem", color: "var(--ink-soft)" }}>還沒有圖片</span>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-2 font-hand font-bold">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          style={{ ...btn("outline", 36), opacity: busy ? .5 : 1 }}
        >
          {busy ? "處理中…" : value ? "更換圖片" : "選擇圖片"}
        </button>
        {value && !busy && (
          <button type="button" onClick={onRemove} style={btn("danger", 36)}>
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
  width: 32, height: 34, padding: 0, borderRadius: 8, lineHeight: 1,
  transition: "opacity .15s",
};

export function EditBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title="編輯" style={{ ...actionBtn, color: "var(--blue)" }}>
      <Icon name="edit" size={16} strokeWidth={2.2} />
    </button>
  );
}

export function DeleteBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title="刪除" style={{ ...actionBtn, color: "var(--red)" }}>
      <Icon name="trash" size={16} strokeWidth={2.2} />
    </button>
  );
}

interface AddBtnProps {
  onClick: () => void;
  label?: string;
  /** The bigger one for the bottom bar (see BottomBar), sharing the row with the others. */
  bar?: boolean;
}

export function AddBtn({ onClick, label, bar }: AddBtnProps) {
  return (
    <button
      onClick={onClick}
      className="font-hand font-bold"
      style={{
        ...btn("add", bar ? 42 : 34),
        transition: "opacity .15s",
        ...(bar && { flex: 1, maxWidth: 200, fontSize: 19 }),
      }}
    >
      <Icon name="plus" size={bar ? 15 : 13} strokeWidth={2.6} />
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
        <Icon name="pencil" size={17} strokeWidth={2.2} />
      </button>
    );
  }
  const busy: React.CSSProperties = { cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .5 : 1 };
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={onCancel} disabled={saving} aria-label="取消" style={{ ...circleBtn, ...busy }}>
        <Icon name="x" size={16} strokeWidth={2.5} />
      </button>
      <button
        onClick={onFinish}
        disabled={saving}
        aria-label={saving ? "儲存中…" : "完成"}
        style={{ ...circleBtn, background: "var(--ink)", color: "var(--paper)", ...busy }}
      >
        <Icon name="check" size={18} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/* Under the header while a page is in edit mode: nothing is saved until 完成. */
export function EditingBanner() {
  return (
    <div
      className="font-mono shrink-0 flex items-center gap-2"
      style={{
        padding: "6px 16px", fontSize: ".7rem", letterSpacing: ".08em",
        background: "var(--yel-soft)", color: "var(--yel-ink)",
        borderBottom: "1.5px dashed var(--rule)",
      }}
    >
      <Icon name="pencil" size={12} strokeWidth={2.4} />
      編輯中 · 按右上角的勾勾才會儲存
    </div>
  );
}

/* Read-only banner: the data on screen is a fallback or cached copy, so the
   edit controls are hidden (see Loaded.editable in dataSource.ts). */
export function ReadOnlyBanner() {
  return (
    <div
      role="status"
      className="font-mono flex items-center justify-center gap-2"
      style={{
        fontSize: ".68rem", letterSpacing: ".14em",
        padding: "5px 0 7px",
        background: "repeating-linear-gradient(90deg, var(--red) 0 6px, transparent 6px 12px) 0 100% / 12px 2px repeat-x",
        color: "var(--red)",
      }}
    >
      <Icon name="wifiOff" size={13} />
      離線資料 · 暫時無法編輯
    </div>
  );
}
