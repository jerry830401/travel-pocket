import { useRegisterSW } from "virtual:pwa-register/react";
import { btn } from "./btn";
import { Icon } from "./icons";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
      <div
        role="status"
        className="flex items-center gap-2.5 w-full max-w-[448px] pointer-events-auto"
        style={{
          padding: "8px 8px 8px 14px", borderRadius: 24,
          border: "1.5px solid var(--ink)", background: "var(--paper)",
          boxShadow: "0 6px 20px var(--shadow)",
        }}
      >
        <span style={{ color: "var(--blue)", display: "flex" }}><Icon name="refresh" size={17} /></span>
        <span className="font-hand font-bold flex-1" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>
          發現新版本，更新後就是最新內容
        </span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="font-hand font-bold"
          style={btn("primary", 34)}
        >
          立即更新
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="關閉"
          className="flex items-center justify-center shrink-0"
          style={{ width: 34, height: 34, border: "none", borderRadius: "50%", background: "transparent", color: "var(--ink-soft)", cursor: "pointer" }}
        >
          <Icon name="x" size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
