import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { INVITE_CODE_PATTERN } from "@travel-pocket/shared";
import type { Invite } from "../types";
import { loadInvite, requestJoin } from "../dataSource";
import { useToast } from "../contexts/ToastContext";
import { circleBtn } from "../components/circleBtn";
import { btn } from "../components/btn";
import { Icon, type IconName } from "../components/icons";

const primaryBtn: React.CSSProperties = {
  ...btn("accent", 48), width: "100%", fontSize: 21, textDecoration: "none",
  boxShadow: "2px 2px 0 var(--ink)",
};

const note: React.CSSProperties = { fontSize: ".92rem", color: "var(--ink-soft)", lineHeight: 1.7 };

/* The ticket the page is printed on: a head (what it is about), a perforation, and a stub (what to do). */
function Ticket({ icon, iconClass, children, stub }: {
  icon: IconName;
  iconClass: string;
  children: React.ReactNode;
  stub: React.ReactNode;
}) {
  return (
    <article
      className="relative text-center"
      style={{ borderRadius: 14, background: "var(--paper)", boxShadow: "0 6px 20px var(--shadow), 0 1px 3px var(--shadow)", transform: "rotate(-1deg)" }}
    >
      <div aria-hidden style={{
        position: "absolute", top: -11, left: "50%", width: 96, height: 22, marginLeft: -48,
        background: "repeating-linear-gradient(45deg, var(--red) 0 6px, color-mix(in srgb, var(--red) 60%, transparent) 6px 12px)",
        transform: "rotate(-3deg)", boxShadow: "0 2px 4px var(--shadow)",
      }} />
      <div className="flex flex-col items-center" style={{ padding: "34px 22px 22px" }}>
        <span className="font-mono" style={{ fontSize: ".66rem", letterSpacing: ".24em", color: "var(--ink-soft)" }}>INVITATION · 旅の招待</span>
        <span className={`${iconClass} flex items-center justify-center`} style={{ width: 58, height: 58, marginTop: 18, borderRadius: "50%", transform: "rotate(-4deg)" }}>
          <Icon name={icon} size={26} strokeWidth={1.8} />
        </span>
        {children}
      </div>
      <div aria-hidden className="relative" style={{ height: 0, margin: "0 16px", borderTop: "2px dashed var(--rule)" }}>
        <span style={{ position: "absolute", left: -28, top: -13, width: 24, height: 24, borderRadius: "50%", background: "var(--bg)" }} />
        <span style={{ position: "absolute", right: -28, top: -13, width: 24, height: 24, borderRadius: "50%", background: "var(--bg)" }} />
      </div>
      <div className="flex flex-col items-center gap-4" style={{ padding: "20px 24px 26px" }}>
        {stub}
      </div>
    </article>
  );
}

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
        <Link to="/" aria-label="回首頁" style={circleBtn}>
          <Icon name="back" size={20} strokeWidth={2.4} />
        </Link>
        <h1
          className="font-hand font-bold"
          style={{ fontSize: "1.8rem", letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}
        >
          加入旅程
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide dot-grid-bg px-[26px] pt-14 pb-8">
        {error && (
          <Ticket
            icon="cloudOff"
            iconClass="st-fd"
            stub={
              <button
                onClick={() => { setError(false); setRetry((r) => r + 1); }}
                className="font-hand font-bold"
                style={primaryBtn}
              >
                重試
              </button>
            }
          >
            <p className="font-hand" style={{ ...note, fontSize: "1.2rem", color: "var(--ink)", marginTop: 12 }}>讀不到這個邀請，請稍後再試</p>
          </Ticket>
        )}

        {!error && invite === undefined && (
          <p className="font-hand text-center" style={{ ...note, fontSize: "1.1rem" }}>載入中...</p>
        )}

        {!error && invite === null && (
          <Ticket icon="link" iconClass="st-xx" stub={<p style={note}>請向旅程的擁有者要新的連結</p>}>
            <p className="font-hand" style={{ fontSize: "1.3rem", color: "var(--ink)", marginTop: 12, lineHeight: 1.4 }}>這個邀請連結無效</p>
          </Ticket>
        )}

        {!error && invite && (
          <Ticket
            icon="briefcase"
            iconClass="st-in"
            stub={
              <>
                {invite.status === "none" && (
                  <>
                    <p style={note}>擁有者同意後，這趟旅程會出現在你的首頁，你們可以一起編輯。</p>
                    <button
                      onClick={() => void join()}
                      disabled={busy}
                      className="font-hand font-bold"
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
                    <Link to={`/trip/${invite.tripId}`} className="font-hand font-bold" style={primaryBtn}>
                      打開旅程
                    </Link>
                  </>
                )}
              </>
            }
          >
            <h2 className="font-hand font-bold" style={{ marginTop: 12, fontSize: "2.7rem", color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.01em" }}>
              {invite.tripName}
            </h2>
            <p style={{ marginTop: 10, fontSize: ".85rem", color: "var(--ink-soft)" }}>
              <span className="font-mono" style={{ fontSize: ".8rem", color: "var(--ink)" }}>{invite.ownerEmail}</span> 邀請你一起規劃
            </p>
          </Ticket>
        )}
      </main>
    </div>
  );
};

export default Join;
