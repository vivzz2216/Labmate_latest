"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronUp, HelpCircle, LogOut, Settings, Sparkles, Star } from "lucide-react";
import { getSummary, lastSeenUpdate } from "@/lib/community";
import styles from "./AccountMenu.module.css";

interface AccountMenuProps {
  displayName: string;
  email?: string | null;
  collapsed: boolean;
  go: (href: string) => void;
  onSignOut: () => void;
}

/** The account card at the bottom of the sidebar. Clicking it opens a menu: Settings, Ratings & reviews, What's new, Help, Sign out. */
export default function AccountMenu({ displayName, email, collapsed, go, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({ left: 12, bottom: 70 });
  const [newUpdates, setNewUpdates] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const refreshBadges = useCallback(async () => {
    try {
      const s = await getSummary();
      setNewUpdates(s.latest_update_id > lastSeenUpdate());
    } catch {
      /* badges are optional */
    }
  }, []);

  useEffect(() => {
    refreshBadges();
    const onSeen = () => refreshBadges();
    window.addEventListener("labmate-updates-seen", onSeen);
    return () => {
      window.removeEventListener("labmate-updates-seen", onSeen);
    };
  }, [refreshBadges]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const first = menuRef.current?.querySelector<HTMLElement>("[role=menuitem]");
    first?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ left: Math.max(8, r.left), bottom: Math.max(8, window.innerHeight - r.top + 8) });
      refreshBadges();
    }
    setOpen((v) => !v);
  };

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") || []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const badge = newUpdates ? 1 : 0;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.account} ${collapsed ? styles.accountCollapsed : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        title={collapsed ? `${displayName} (${email || "Account"})` : undefined}
        onClick={toggle}
      >
        <span className={styles.avatar}>
          {initial}
          {badge > 0 && <span className={styles.dot} aria-hidden="true" />}
        </span>
        {!collapsed && (
          <>
            <span className={styles.text}>
              <strong>{displayName}</strong>
              <small>{email || "Student Account"}</small>
            </span>
            <ChevronUp size={14} strokeWidth={2} className={open ? styles.chevOpen : styles.chev} aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <div ref={menuRef} role="menu" aria-label="Account" className={styles.menu} style={{ left: pos.left, bottom: pos.bottom }} onKeyDown={onMenuKey}>
          <div className={styles.menuEmail}>{email || displayName}</div>
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose(() => go("/user-dashboard?tab=settings"))}>
            <Settings size={17} /> <span>Settings</span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose(() => go("/feedback"))}>
            <Star size={17} /> <span>Ratings &amp; reviews</span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose(() => go("/updates"))}>
            <Sparkles size={17} /> <span>What&apos;s new</span>
            {newUpdates && <em className={styles.count}>New</em>}
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose(() => go("/contact"))}>
            <HelpCircle size={17} /> <span>Get help</span>
          </button>
          <div className={styles.sep} />
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose(onSignOut)}>
            <LogOut size={17} /> <span>Sign out</span>
          </button>
        </div>
      )}
    </>
  );
}
