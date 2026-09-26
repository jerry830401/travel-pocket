import { useCallback, useEffect, useState } from "react";
import type { TripEntry, TripMember, TripMembers } from "../types";
import {
  approveMember,
  createInvite,
  inviteLink,
  loadMe,
  loadMembers,
  removeMember,
} from "../dataSource";
import { useToast } from "../contexts/ToastContext";
import { Sheet } from "./editor";

const sectionTitle: React.CSSProperties = {
  fontSize: ".7rem", fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: ".14em", textTransform: "uppercase",
  color: "var(--ink-soft)", margin: "18px 0 8px",
};

const pill = (color: string, filled = false): React.CSSProperties => ({
  padding: "3px 12px", borderRadius: 14, flexShrink: 0,
  border: `1.5px solid ${color}`,
  background: filled ? color : "transparent", color: filled ? "var(--paper)" : color,
  fontSize: ".95rem", cursor: "pointer",
});

const emailStyle: React.CSSProperties = {
  fontSize: ".8rem", letterSpacing: ".04em", color: "var(--ink)",
};

function Row({ email, tag, children }: { email: string; tag?: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: "1.5px dashed var(--rule)" }}>
      <span className="font-mono truncate" style={emailStyle}>
        {email}
        {tag && <span className="font-hand" style={{ color: "var(--ink-soft)", marginLeft: 6 }}>{tag}</span>}
      </span>
      {children && <span className="flex gap-1.5 font-hand font-bold">{children}</span>}
    </li>
  );
}

interface ShareSheetProps {
  trip: TripEntry;
  open: boolean;
  onClose: () => void;
  /** Called once the user has left the trip, which they can no longer see. */
  onLeft: () => void;
}

/**
 * Who shares a trip. The owner hands out the invite link, approves or turns
 * down requests to join and removes members; a member sees who else is in
 * and can leave. Every action takes effect at once (no draft).
 */
export function ShareSheet({ trip, open, onClose, onLeft }: ShareSheetProps) {
  const { showToast } = useToast();
  const [members, setMembers] = useState<TripMembers | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOwner = trip.role === "owner";

  const reload = useCallback(() => {
    setError(false);
    return loadMembers(trip.id).then(setMembers, () => setError(true));
  }, [trip.id]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      showToast(done);
    } catch (err) {
      showToast(`操作失敗：${err instanceof Error ? err.message : err}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const createLink = () =>
    run(async () => {
      const inviteCode = await createInvite(trip.id);
      setMembers((m) => m && { ...m, inviteCode });
    }, "已建立邀請連結");

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("已複製邀請連結");
    } catch {
      showToast("無法複製，請直接選取連結", "error");
    }
  };

  const shareLink = async (url: string) => {
    try {
      await navigator.share({ title: trip.name, text: `一起編輯「${trip.name}」的行程`, url });
    } catch {
      // Closed without sharing.
    }
  };

  const approve = (email: string) =>
    run(async () => {
      await approveMember(trip.id, email);
      await reload();
    }, `${email} 已加入`);

  const remove = ({ email, status }: TripMember) => {
    const question = status === "pending"
      ? `拒絕 ${email} 的加入申請？`
      : `把 ${email} 移出這趟旅程？對方就看不到它了。`;
    if (!confirm(question)) return;
    void run(async () => {
      await removeMember(trip.id, email);
      await reload();
    }, status === "pending" ? "已拒絕申請" : `已移除 ${email}`);
  };

  const leave = () => {
    if (!confirm(`確定退出「${trip.name}」？退出後就看不到這趟旅程，要再加入得重新申請。`)) return;
    void run(async () => {
      const me = await loadMe();
      if (!me) throw new Error("讀不到目前的帳號");
      await removeMember(trip.id, me.email);
      onLeft();
    }, "已退出旅程");
  };

  const pending = members?.members.filter((m) => m.status === "pending") ?? [];
  const approved = members?.members.filter((m) => m.status === "member") ?? [];
  const link = members?.inviteCode ? inviteLink(members.inviteCode) : null;

  return (
    <Sheet title="成員" icon="👥" open={open} onClose={onClose}>
      {error && (
        <div className="flex flex-col items-center gap-3 py-6 font-hand" style={{ color: "var(--ink-soft)" }}>
          <p style={{ fontSize: "1.05rem" }}>成員載入失敗</p>
          <button onClick={() => void reload()} className="font-hand font-bold" style={pill("var(--ink)", true)}>
            重試
          </button>
        </div>
      )}

      {!error && !members && (
        <p className="font-hand py-6 text-center" style={{ color: "var(--ink-soft)" }}>載入中...</p>
      )}

      {!error && members && (
        <div style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : undefined }}>
          {isOwner && (
            <section>
              <h3 style={{ ...sectionTitle, marginTop: 0 }}>邀請連結</h3>
              <p className="font-hand" style={{ fontSize: ".98rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>
                拿到連結的人用 Google 登入後可以申請加入，你同意後對方才看得到、也能一起編輯這趟旅程。
              </p>
              {link ? (
                <div className="flex flex-col gap-2 mt-2.5">
                  <input
                    readOnly
                    aria-label="邀請連結"
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono"
                    style={{
                      width: "100%", padding: "7px 10px", fontSize: ".75rem",
                      background: "var(--paper-2)", border: "1.5px dashed var(--rule)",
                      borderRadius: 8, color: "var(--ink)", outline: "none",
                    }}
                  />
                  <div className="flex gap-2 font-hand font-bold">
                    <button onClick={() => void copyLink(link)} style={pill("var(--ink)", true)}>
                      複製連結
                    </button>
                    {typeof navigator.share === "function" && (
                      <button onClick={() => void shareLink(link)} style={pill("var(--ink)")}>
                        分享
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => void createLink()}
                  className="font-hand font-bold mt-2.5"
                  style={pill("var(--red)", true)}
                >
                  建立邀請連結
                </button>
              )}
            </section>
          )}

          {isOwner && pending.length > 0 && (
            <section>
              <h3 style={sectionTitle}>申請加入</h3>
              <ul>
                {pending.map((member) => (
                  <Row key={member.email} email={member.email}>
                    <button onClick={() => void approve(member.email)} style={pill("var(--green)", true)}>
                      同意
                    </button>
                    <button onClick={() => remove(member)} style={pill("var(--ink-soft)")}>
                      拒絕
                    </button>
                  </Row>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 style={isOwner ? sectionTitle : { ...sectionTitle, marginTop: 0 }}>成員</h3>
            <ul>
              <Row email={members.ownerEmail} tag={isOwner ? "擁有者（你）" : "擁有者"} />
              {approved.map((member) => (
                <Row key={member.email} email={member.email}>
                  {isOwner && (
                    <button onClick={() => remove(member)} style={pill("var(--red)")}>
                      移除
                    </button>
                  )}
                </Row>
              ))}
            </ul>
            {approved.length === 0 && (
              <p className="font-hand mt-2" style={{ fontSize: ".95rem", color: "var(--ink-soft)" }}>
                還沒有其他成員
              </p>
            )}
          </section>

          {!isOwner && (
            <button
              onClick={leave}
              className="font-hand font-bold mt-6 w-full"
              style={{ ...pill("var(--red)"), padding: "8px 0" }}
            >
              退出旅程
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
