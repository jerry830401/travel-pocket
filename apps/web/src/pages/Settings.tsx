import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Me } from "../types";
import { useTheme, type ThemePreference } from "../contexts/ThemeContext";
import { loadMe, signOut } from "../dataSource";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "淺色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟隨系統" },
];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="font-hand font-bold flex items-center gap-2.5 mb-4 mx-1"
    style={{ fontSize: "1.15rem", color: "var(--red)" }}
  >
    <span style={{ display: "inline-block", width: 22, height: 2, background: "var(--red)", borderRadius: 1 }} />
    {children}
  </h2>
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
          className="shrink-0 flex items-center justify-center font-hand transition-all duration-150"
          style={{
            width: 34, height: 34, borderRadius: "50%",
            border: "1.5px solid var(--ink)",
            background: "transparent", color: "var(--ink)", fontSize: 22,
            textDecoration: "none",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
        >
          ‹
        </Link>
        <h1
          className="font-hand font-bold"
          style={{ fontSize: "1.75rem", letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}
        >
          設定
        </h1>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto scrollbar-hide dot-grid-bg px-4 pb-8 pt-5">
        <section className="mb-8">
          <SectionTitle>外觀</SectionTitle>
          <fieldset className="flex flex-wrap gap-2 mx-1">
            <legend className="sr-only">主題</legend>
            {THEME_OPTIONS.map((option) => {
              const checked = preference === option.value;
              return (
                <label
                  key={option.value}
                  className="font-hand font-bold cursor-pointer transition-all duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--red)]"
                  style={{
                    background: checked ? "var(--ink)" : "transparent",
                    color: checked ? "var(--paper)" : "var(--ink)",
                    border: "1.5px solid var(--ink)",
                    padding: "5px 16px",
                    borderRadius: 16,
                    fontSize: "1.1rem",
                    transform: checked ? "rotate(-1.5deg)" : "none",
                    boxShadow: checked ? "2px 2px 0 var(--rule)" : "none",
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
                  {option.label}
                </label>
              );
            })}
          </fieldset>
        </section>

        {me && (
          <section>
            <SectionTitle>帳號</SectionTitle>
            <div className="flex items-center justify-between gap-3 mx-1">
              <span
                className="font-mono truncate"
                style={{ fontSize: ".8rem", letterSpacing: ".04em", color: "var(--ink-soft)" }}
              >
                {me.email}
              </span>
              {/* Cloudflare Access handles sign-out; the dev server has no Access. */}
              {!import.meta.env.DEV && (
                <button
                  onClick={() => void signOut()}
                  className="shrink-0 font-hand font-bold"
                  style={{
                    padding: "4px 14px", borderRadius: 14,
                    border: "1.5px solid var(--red)",
                    background: "transparent", color: "var(--red)",
                    fontSize: "1rem", cursor: "pointer",
                  }}
                >
                  登出
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Settings;
