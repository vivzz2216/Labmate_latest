"use client";

import React from "react";
import type { IntellijProjectPreset } from "@/lib/ide/intellijRunner";
import { HideMinimizeIcon } from "./ExpUiIcons";
import styles from "./intellij.module.css";
import type { NotificationItem, RightToolId } from "./types";

interface RightDrawerPaneProps {
  activeRight: RightToolId;
  preset: IntellijProjectPreset;
  notifications: NotificationItem[];
  onClearNotifications: () => void;
  onRunActiveConfig: () => void;
  onHide: () => void;
}

export function RightDrawerPane({
  activeRight,
  preset,
  notifications,
  onClearNotifications,
  onRunActiveConfig,
  onHide,
}: RightDrawerPaneProps) {
  const title =
    activeRight === "notifications" ? "Notifications" : activeRight === "database" ? "Database" : "Maven";

  return (
    <aside className={styles.rightDrawer} aria-label={`${title} tool window`}>
      <div className={styles.paneHeader}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        <div className={styles.paneActionRow}>
          {activeRight === "notifications" && notifications.length > 0 && (
            <button
              type="button"
              className={styles.dialogBtnSecondary}
              style={{ height: 22, padding: "0 8px", fontSize: 11 }}
              onClick={onClearNotifications}
            >
              Clear
            </button>
          )}
          <button type="button" className={styles.smallActionBtn} title="Hide" aria-label={`Hide ${title}`} onClick={onHide}>
            <HideMinimizeIcon size={15} color="#9DA0A8" />
          </button>
        </div>
      </div>

      <div className={styles.rightDrawerBody}>
        {activeRight === "notifications" && (
          <>
            {notifications.length === 0 ? (
              <div style={{ color: "#7A7E85", fontSize: 12, paddingTop: 12 }}>No new notifications.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={styles.drawerCard}>
                  <div className={styles.drawerCardTitle}>{n.title}</div>
                  <div className={styles.drawerCardMeta}>{n.detail}</div>
                  <div style={{ fontSize: 11, color: "#7A7E85", marginTop: 4 }}>{n.time}</div>
                </div>
              ))
            )}
          </>
        )}

        {activeRight === "database" && (
          <>
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>Local PostgreSQL (LabDS)</div>
              <div className={styles.drawerCardMeta}>
                Host: localhost:5432 · Schema: public
                <br />
                Status: Ready (JDBC 42.7.3)
              </div>
            </div>
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>Embedded H2 In-Memory</div>
              <div className={styles.drawerCardMeta}>jdbc:h2:mem:labmate · 4 tables indexed</div>
            </div>
          </>
        )}

        {activeRight === "maven" && (
          <>
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>{preset.moduleName}</div>
              <div className={styles.drawerCardMeta}>
                JDK: openjdk-21 (21.0.4)
                <br />
                Lifecycle: clean · compile · test · package
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" className={styles.dialogBtnPrimary} onClick={onRunActiveConfig}>
                  Compile &amp; Run
                </button>
              </div>
            </div>
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>Dependencies</div>
              <div className={styles.drawerCardMeta}>
                org.jetbrains:annotations:24.1.0
                <br />
                junit:junit-jupiter:5.10.2
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
