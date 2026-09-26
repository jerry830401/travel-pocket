import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { INVITE_CODE_PATTERN } from "@travel-pocket/shared";
import type { Invite } from "../types";
import { loadInvite, requestJoin } from "../dataSource";
import { useToast } from "../contexts/ToastContext";
import { circleBtn } from "../components/circleBtn";

const primaryBtn: React.CSSProperties = {
  padding: "8px 26px", borderRadius: 18,
  border: "1.5px solid var(--red)",
  background: "var(--red)", color: "#fff",
  fontSize: "1.1rem", cursor: "pointer", textDecoration: "none",
};

const note: React.CSSProperties = { fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.45 };

/** Where an invite link lands (`#/join/:code`): shows the trip and asks its owner to let the user in. */
const Join = () => {
  const { code = "" } = useParams();
  // undefined while loading; null for a code that opens nothing.
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!INVITE_CODE_PATTERN.test(code)) {
      setInvite(null);
      return;
    }
    loadInvite(code).then(setInvite, () => setError(true));
  }, [code, retry]);

  const join = async () => {
    setBusy(true);
    try {
      setInvite(await requestJoin(code));
    } catch (err) {
      showToast(`申請失敗：${err instanceof Error ? err.message : err}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="shrink-0 px-4 pb-3 pt-safe z-30 flex items-center gap-3"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <Link to="/" aria-label="回首頁" className="font-hand" style={{ ...circleBtn, fontSize: 22, textDecoration: "none" }}>
          ‹
        </Link>
        <h1
          className="font-hand font-bold"
          style={{ fontSize: "1.75rem", letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}
        >
          加入旅程
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide dot-grid-bg px-6 pt-10 pb-8">
        <div className="flex flex-col items-center gap-4 text-center font-hand">
          {error && (
            <>
              <span style={{ fontSize: "2.4rem" }}>😵</span>
              <p style={note}>讀不到這個邀請，請稍後再試</p>
              <button
                onClick={() => { setError(false); setRetry((r) => r + 1); }}
                className="font-hand font-bold"
                style={primaryBtn}
              >
                重試
              </button>
            </>
          )}

          {!error && invite === undefined && <p style={note}>載入中...</p>}

          {!error && invite === null && (
            <>
              <span style={{ fontSize: "2.4rem" }}>🔗</span>
              <p style={note}>這個邀請連結無效，請向旅程的擁有者要新的連結</p>
            </>
          )}

          {!error && invite && (
            <>
              <span style={{ fontSize: "2.4rem" }}>🧳</span>
              <h2 className="font-bold" style={{ fontSize: "2rem", color: "var(--ink)", lineHeight: 1.1 }}>
                {invite.tripName}
              </h2>
              <p className="font-mono" style={{ fontSize: ".8rem", color: "var(--ink-soft)" }}>
                {invite.ownerEmail}
              </p>

              {invite.status === "none" && (
                <>
                  <p style={note}>擁有者同意後，這趟旅程會出現在你首頁的「共享旅程」，你們可以一起編輯。</p>
                  <button
                    onClick={() => void join()}
                    disabled={busy}
                    className="font-bold"
                    style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? "送出中…" : "申請加入"}
                  </button>
                </>
              )}

              {invite.status === "pending" && (
                <p role="status" style={note}>已送出申請，等擁有者同意後就能打開這趟旅程</p>
              )}

              {(invite.status === "member" || invite.status === "owner") && (
                <>
                  <p style={note}>{invite.status === "owner" ? "這是你的旅程" : "你已經是這趟旅程的成員"}</p>
                  <Link to={`/trip/${invite.tripId}`} className="font-bold" style={primaryBtn}>
                    打開旅程
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Join;
