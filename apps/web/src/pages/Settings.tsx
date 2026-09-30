import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Me } from "../types";
import { useTheme, type ThemePreference } from "../contexts/ThemeContext";
import { loadMe, signOut } from "../dataSource";
import { circleBtn } from "../components/circleBtn";
import { btn } from "../components/btn";
import { Icon, type IconName } from "../components/icons";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "light", label: "淺色", icon: "sun" },
  { value: "dark", label: "深色", icon: "moon" },
  { value: "system", label: "跟隨系統", icon: "phone" },
];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="font-hand font-bold flex items-center gap-2.5 mb-4"
    style={{ fontSize: "1.3rem", color: "var(--red)" }}
  >
    <span style={{ display: "inline-block", width: 22, height: 2, background: "var(--red)", borderRadius: 1 }} />
    {children}
  </h2>
);

/* A section on its own taped paper card. */
const Card = ({ tape, tilt, children }: { tape: string; tilt: string; children: React.ReactNode }) => (
  <section
    className="relative"
    style={{
      padding: "20px 18px", borderRadius: 10, background: "var(--paper)",
      boxShadow: "0 4px 14px var(--shadow), 0 1px 3px var(--shadow)", transform: tilt,
    }}
  >
    <div aria-hidden style={{
      position: "absolute", top: -9, left: 26, width: 70, height: 20,
      background: `repeating-linear-gradient(45deg, ${tape} 0 6px, color-mix(in srgb, ${tape} 60%, transparent) 6px 12px)`,
      transform: "rotate(-6deg)", boxShadow: "0 2px 4px var(--shadow)",
    }} />
    {children}
  </section>
);

const Settings = () => {
  const { preference, setPreference } = useTheme();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    loadMe().then(setMe);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="shrink-0 px-4 pb-3 pt-safe z-30 flex items-center gap-3"
        style={{ background: "var(--paper)", borderBottom: "1.5px dashed var(--rule)" }}
      >
        <Link
          to="/"
          aria-label="回首頁"
          className="transition-all duration-150"
          style={circleBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
        >
          <Icon name="back" size={20} strokeWidth={2.4} />
        </Link>
        <h1
          className="font-hand font-bold"
          style={{ fontSize: "1.8rem", letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}
        >
          設定
        </h1>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto scrollbar-hide dot-grid-bg px-[18px] pb-8 pt-7 flex flex-col gap-8">
        <Card tape="var(--blue)" tilt="rotate(-.5deg)">
          <SectionTitle>外觀</SectionTitle>
          <fieldset>
            <legend className="font-mono mb-2.5" style={{ fontSize: ".66rem", letterSpacing: ".16em", color: "var(--ink-soft)" }}>主題</legend>
            <div className="grid grid-cols-3 gap-2.5">
              {THEME_OPTIONS.map((option) => {
                const checked = preference === option.value;
                return (
                  <label
                    key={option.value}
                    className="font-hand font-bold cursor-pointer flex flex-col items-center gap-1.5 transition-all duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--red)]"
                    style={{
                      background: checked ? "var(--ink)" : "transparent",
                      color: checked ? "var(--paper)" : "var(--ink)",
                      border: "1.5px solid var(--ink)",
                      padding: "12px 4px 10px",
                      borderRadius: 12,
                      fontSize: "1.15rem",
                      transform: checked ? "rotate(-1.5deg)" : "none",
                      boxShadow: checked ? "2px 2px 0 var(--red)" : "none",
                    }}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={checked}
                      onChange={() => setPreference(option.value)}
                      className="sr-only"
                    />
                    <Icon name={option.icon} size={22} />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        {me && (
          <Card tape="var(--yel)" tilt="rotate(.5deg)">
            <SectionTitle>帳號</SectionTitle>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="st-tr font-hand font-bold flex items-center justify-center shrink-0"
                style={{ width: 44, height: 44, borderRadius: "50%", fontSize: 24 }}
              >
                {me.email.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", color: "var(--ink-soft)" }}>GOOGLE 帳號</div>
                <div className="font-mono truncate" style={{ fontSize: ".82rem", color: "var(--ink)", marginTop: 2 }}>
                  {me.email}
                </div>
              </div>
              {/* Cloudflare Access handles sign-out; the dev server has no Access. */}
              {!import.meta.env.DEV && (
                <button
                  onClick={() => void signOut()}
                  className="font-hand font-bold"
                  style={btn("danger")}
                >
                  <Icon name="logout" size={15} />
                  登出
                </button>
              )}
            </div>
          </Card>
        )}

        <p className="font-mono text-center mt-auto" style={{ fontSize: ".66rem", letterSpacing: ".2em", color: "var(--ink-faint)" }}>
          TRAVEL POCKET · 旅の記録
        </p>
      </main>
    </div>
  );
};

export default Settings;
