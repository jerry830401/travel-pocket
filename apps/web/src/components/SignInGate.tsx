import { useEffect, useState, type ReactNode } from "react";
import { apiEnabled, goToSignIn, onSignedOut } from "../dataSource";
import { btn } from "./btn";
import { Icon } from "./icons";

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
      className="dot-grid-bg flex flex-col items-center justify-center h-full gap-4 px-8 text-center font-hand"
      style={{ color: "var(--ink-soft)" }}
    >
      <h1
        className="font-hand font-bold leading-none"
        style={{ fontSize: "2.6rem", letterSpacing: "-0.01em", color: "var(--ink)" }}
      >
        Travel Pocket
      </h1>
      <span className="st-tr flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%" }}>
        <Icon name="lock" size={24} strokeWidth={1.8} />
      </span>
      <p style={{ fontSize: "1.15rem" }}>請先登入，才能查看與編輯你的行程</p>
      <button onClick={goToSignIn} className="font-hand font-bold" style={btn("primary")}>
        前往登入
      </button>
    </div>
  );
}
