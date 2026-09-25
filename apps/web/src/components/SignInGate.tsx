import { useEffect, useState, type ReactNode } from "react";
import { apiEnabled, goToSignIn, onSignedOut } from "../dataSource";

/**
 * Cloudflare Access sends a signed-out visitor to its login page before the
 * app ever loads. When the app opens anyway (from the service worker's cache,
 * or the session ends while it is open), the pages' API calls report that the
 * user is signed out and this swaps the app for a screen that asks them to
 * sign in; nothing redirects on its own.
 */
export function SignInGate({ children }: { children: ReactNode }) {
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    if (!apiEnabled) return;
    return onSignedOut(() => setSignedOut(true));
  }, []);

  return signedOut ? <SignInScreen /> : children;
}

function SignInScreen() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center font-hand"
      style={{ color: "var(--ink-soft)" }}
    >
      <h1
        className="font-hand font-bold leading-none"
        style={{ fontSize: "2.6rem", letterSpacing: "-0.01em", color: "var(--ink)" }}
      >
        Travel Pocket
      </h1>
      <p style={{ fontSize: "1.1rem" }}>請先登入，才能查看與編輯你的行程</p>
      <button
        onClick={goToSignIn}
        className="font-hand font-bold"
        style={{
          padding: "6px 22px", borderRadius: 18,
          border: "1.5px solid var(--ink)",
          background: "var(--ink)", color: "var(--paper)",
          fontSize: "1rem", cursor: "pointer",
        }}
      >
        前往登入
      </button>
    </div>
  );
}
