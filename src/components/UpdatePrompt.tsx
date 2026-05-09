import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl w-full max-w-[448px] pointer-events-auto"
        style={{ background: "#1a3a5c" }}
      >
        <span className="text-white text-sm flex-1">
          發現新版本，點擊更新以取得最新內容
        </span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
        >
          立即更新
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="shrink-0 text-white/50 text-base leading-none"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
