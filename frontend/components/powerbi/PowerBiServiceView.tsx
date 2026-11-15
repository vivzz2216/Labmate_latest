"use client";

import React, { useState } from "react";
import {
  Award,
  Bell,
  HelpCircle,
  Download,
  Folder,
  Home,
  LayoutGrid,
  Layers,
  MoreHorizontal,
  Paintbrush,
  Plus,
  PlusCircle,
  Search,
  Settings,
  SlidersHorizontal,
  Table2,
  User,
  UserCircle2,
  X,
  Zap,
} from "lucide-react";
import type { DatasetModel } from "@/lib/powerbi/types";
import {
  CopilotRibbonIcon,
  EnterDataRibbonIcon,
  GetDataRibbonIcon,
  OneLakeCatalogIcon,
  PowerBiLogoMark,
  SemanticModelBadge,
  ServiceCsvBadge,
  TileExcelBadge,
} from "./PowerBiDesktopIcons";
import styles from "./powerbi.module.css";

interface PowerBiServiceViewProps {
  mode: "home" | "create";
  onChangeMode: (mode: "home" | "create") => void;
  onSwitchToDesktop: () => void;
  onUploadCsv: () => void;
  onLoadSocialSample: () => void;
  onLoadRetailSample: () => void;
  onOpenEnterData: () => void;
  onOpenGetDataModal: () => void;
  currentDataset: DatasetModel | null;
}

const RECOMMENDED_ITEMS = [
  {
    id: "basics",
    title: "Explore basic Power BI conce...",
    subtitle: "Getting started with Power BI",
    dataset: "social" as const,
  },
  {
    id: "intro",
    title: "Intro—What is Power BI?",
    subtitle: "Getting started with Power BI",
    dataset: "social" as const,
  },
  {
    id: "quickstart",
    title: "Quick start—Getting around i...",
    subtitle: "Getting started with Power BI",
    dataset: "retail" as const,
  },
  {
    id: "understand",
    title: "View and understand a Powe...",
    subtitle: "Getting started with Power BI",
    dataset: "social" as const,
  },
  {
    id: "know-content",
    title: "How to: Know your content is...",
    subtitle: "Getting started with Power BI",
    dataset: "retail" as const,
  },
];

/** Authentic replica of Power BI Service Home & Create views matching Screenshots 2 & 3. */
export function PowerBiServiceView({
  mode,
  onChangeMode,
  onSwitchToDesktop,
  onUploadCsv,
  onLoadSocialSample,
  onLoadRetailSample,
  onOpenEnterData,
  onOpenGetDataModal,
  currentDataset,
}: PowerBiServiceViewProps) {
  const [showTeamsBanner, setShowTeamsBanner] = useState(true);
  const [showHeroBanner, setShowHeroBanner] = useState(true);
  const [activePill, setActivePill] = useState<"recent" | "favorites" | "apps" | "external">("recent");
  const [keyword, setKeyword] = useState("");

  return (
    <div className={styles.serviceRoot}>
      {/* Service Header */}
      <header className={styles.serviceHeader}>
        <div className={styles.serviceHeaderLeft}>
          <button
            type="button"
            className={styles.qatBtn}
            title="Switch to Power BI Desktop"
            aria-label="Switch to Power BI Desktop"
            onClick={onSwitchToDesktop}
          >
            <LayoutGrid size={16} />
          </button>
          <span className={styles.serviceBrand}>Power BI</span>
          <span className={styles.serviceBreadcrumb}>{mode === "home" ? "Home" : "My workspace"}</span>
        </div>

        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            aria-label="Search Power BI Service"
            placeholder="Search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={styles.topSearchInput}
          />
        </div>

        <div className={styles.serviceHeaderRight}>
          <button
            type="button"
            className={styles.desktopReturnPill}
            onClick={onSwitchToDesktop}
            title="Open Power BI Desktop Authoring Studio"
          >
            Open Desktop UI
          </button>
          <button type="button" className={styles.qatBtn} aria-label="Notifications" onClick={() => onChangeMode("home")}>
            <Bell size={15} />
          </button>
          <button type="button" className={styles.qatBtn} aria-label="Settings" onClick={onOpenGetDataModal}>
            <Settings size={15} />
          </button>
          <button type="button" className={styles.qatBtn} aria-label="Open Desktop app" title="Open Desktop UI" onClick={onSwitchToDesktop}>
            <Download size={15} />
          </button>
          <button type="button" className={styles.qatBtn} aria-label="Help" onClick={onSwitchToDesktop}>
            <HelpCircle size={15} />
          </button>
          <UserCircle2 size={22} color="#8a8886" />
        </div>
      </header>

      <div className={styles.serviceBody}>
        {/* Left Navigation Rail */}
        <aside className={styles.serviceLeftRail} aria-label="Power BI Service Navigation">
          <button
            type="button"
            onClick={() => onChangeMode("home")}
            className={`${styles.serviceRailBtn} ${mode === "home" ? styles.serviceRailActive : ""}`}
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={onLoadSocialSample}
            className={styles.serviceRailBtn}
          >
            <CopilotRibbonIcon size={17} />
            <span>Power BI Copilot</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode("create")}
            className={`${styles.serviceRailBtn} ${mode === "create" ? styles.serviceRailActive : ""}`}
          >
            <PlusCircle size={16} color={mode === "create" ? "#117865" : undefined} />
            <span>Create</span>
          </button>
          <button type="button" onClick={onOpenGetDataModal} className={styles.serviceRailBtn}>
            <OneLakeCatalogIcon size={17} />
            <span>OneLake catalog</span>
          </button>
          <button type="button" onClick={onSwitchToDesktop} className={styles.serviceRailBtn}>
            <LayoutGrid size={16} />
            <span>Apps</span>
          </button>
          <button type="button" onClick={onLoadSocialSample} className={styles.serviceRailBtn}>
            <Award size={16} />
            <span>Scorecards</span>
          </button>
          <button type="button" onClick={onOpenGetDataModal} className={styles.serviceRailBtn}>
            <Folder size={16} />
            <span>Browse</span>
          </button>
          <button type="button" onClick={onSwitchToDesktop} className={styles.serviceRailBtn}>
            <Layers size={16} />
            <span>Workspaces</span>
          </button>
          <button type="button" onClick={() => onChangeMode("create")} className={styles.serviceRailBtn}>
            <User size={16} />
            <span>My workspace</span>
          </button>
          <button type="button" onClick={onSwitchToDesktop} className={styles.serviceRailBtn}>
            <MoreHorizontal size={16} />
          </button>

          <button
            type="button"
            onClick={onSwitchToDesktop}
            className={styles.serviceBottomBadge}
            title="Switch to Power BI Desktop"
          >
            <PowerBiLogoMark size={20} />
            <span>Power BI</span>
          </button>
        </aside>

        {/* Main Scroll Workspace */}
        <main className={styles.serviceMain}>
          {mode === "home" ? (
            <div className={styles.serviceContainer}>
              {showTeamsBanner ? (
                <div className={styles.teamsBanner}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PowerBiLogoMark size={18} />
                    <span>
                      <strong>Introducing the Power BI app in Teams</strong>
                      {"  "}Collaborate with your team members on data and take action. Select Open in Teams to get started.
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button type="button" className={styles.servicePrimaryBtn} onClick={onSwitchToDesktop}>
                      Open in Teams
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss Teams banner"
                      onClick={() => setShowTeamsBanner(false)}
                      style={{ border: 0, background: "transparent", cursor: "pointer", color: "#605e5c" }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={styles.serviceActionRow}>
                <button type="button" className={styles.servicePrimaryBtn} onClick={() => onChangeMode("create")}>
                  <Plus size={14} />
                  <span>New report</span>
                </button>
                <span style={{ fontSize: 12, color: "#605e5c" }}>
                  New items saved to: <strong style={{ color: "#252423" }}>My workspace</strong>
                </span>
              </div>

              <h2 className={styles.serviceSectionTitle}>Recommended</h2>
              <div className={styles.recommendedGrid}>
                {RECOMMENDED_ITEMS.map((item, idx) => (
                  <div key={item.id} className={styles.recommendedCard}>
                    <div className={styles.recommendedTitle}>{item.title}</div>
                    <div className={styles.recommendedSub}>{item.subtitle}</div>
                    <div className={styles.recommendedArt}>
                      {idx < 2 ? (
                        <div className={styles.recommendedConceptArt}>
                          <PowerBiLogoMark size={28} />
                        </div>
                      ) : (
                        <div className={styles.recommendedChartArt}>
                          <div style={{ width: "36%", height: 10, background: "#f2c811" }} />
                          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 42 }}>
                            <span style={{ flex: 1, height: "55%", background: "#117865" }} />
                            <span style={{ flex: 1, height: "90%", background: "#118dff" }} />
                            <span style={{ flex: 1, height: "42%", background: "#e66c37" }} />
                            <span style={{ flex: 1, height: "75%", background: "#117865" }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.recommendedOpenBtn}
                      onClick={() => (item.dataset === "social" ? onLoadSocialSample() : onLoadRetailSample())}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.serviceFilterBar}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {(
                    [
                      ["recent", "Recent"],
                      ["favorites", "Favorites"],
                      ["apps", "My apps"],
                      ["external", "From external orgs"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActivePill(id)}
                      className={`${styles.serviceFilterPill} ${activePill === id ? styles.serviceFilterPillActive : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Filter by keyword"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className={styles.serviceKeywordInput}
                  />
                  <span className={styles.serviceOptionChip}>
                    <SlidersHorizontal size={12} /> Filter
                  </span>
                </div>
              </div>

              {currentDataset ? (
                <div className={styles.recentReportRow} onClick={onSwitchToDesktop} role="button" tabIndex={0}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PowerBiLogoMark size={18} />
                    <div>
                      <strong>{currentDataset.name}</strong>
                      <div style={{ fontSize: 11.5, color: "#605e5c" }}>
                        Report · My workspace · {currentDataset.rows.length} rows
                      </div>
                    </div>
                  </div>
                  <button type="button" className={styles.recommendedOpenBtn} onClick={onSwitchToDesktop}>
                    Open Desktop Report
                  </button>
                </div>
              ) : (
                <div className={styles.emptyFolderShowcase}>
                  <div className={styles.goldCircleIcon}>
                    <Folder size={52} fill="#f2c811" color="#c99b00" />
                  </div>
                  <p style={{ marginTop: 10, fontSize: 13, color: "#605e5c" }}>
                    Select <strong>+ New report</strong> or open any Recommended report above to launch Power BI Desktop.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Service Create Screen matching Screenshot 3 */
            <div className={styles.serviceContainer}>
              {showHeroBanner ? (
                <div className={styles.createHeroCard}>
                  <div>
                    <h1 className={styles.createHeroTitle}>Build your first report</h1>
                    <ul className={styles.createHeroList}>
                      <li>
                        <Table2 size={14} color="#605e5c" />
                        <span>Add and prepare your data</span>
                      </li>
                      <li>
                        <Zap size={14} color="#605e5c" />
                        <span>Generate a premade report</span>
                      </li>
                      <li>
                        <Paintbrush size={14} color="#605e5c" />
                        <span>Customize to your needs</span>
                      </li>
                    </ul>
                  </div>

                  <svg width="310" height="120" viewBox="0 0 310 120" aria-hidden="true">
                    <rect x="8" y="22" width="110" height="78" rx="4" fill="#d7efe9" stroke="#117865" strokeWidth="1" />
                    <polygon points="18,86 48,48 76,66 108,38 108,86" fill="#5aa897" opacity="0.65" />
                    <rect x="78" y="8" width="136" height="98" rx="5" fill="#ffffff" stroke="#117865" strokeWidth="1.2" />
                    <rect x="92" y="34" width="12" height="36" fill="#117865" />
                    <rect x="110" y="24" width="12" height="46" fill="#4aa391" />
                    <rect x="128" y="42" width="12" height="28" fill="#88c7ba" />
                    <circle cx="176" cy="52" r="21" fill="#4aa391" />
                    <path d="M176 52V31A21 21 0 0 1 196 58z" fill="#117865" />
                    <rect x="206" y="26" width="84" height="72" rx="4" fill="#ffffff" stroke="#a6d5ca" strokeWidth="1" />
                    <rect x="216" y="50" width="9" height="26" fill="#88c7ba" />
                    <rect x="230" y="38" width="9" height="38" fill="#4aa391" />
                    <circle cx="264" cy="58" r="14" fill="#117865" opacity="0.85" />
                  </svg>

                  <button
                    type="button"
                    aria-label="Dismiss Create hero"
                    onClick={() => setShowHeroBanner(false)}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      border: 0,
                      background: "transparent",
                      color: "#605e5c",
                      cursor: "pointer",
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}

              <h2 className={styles.createAddTitle}>Add data to start building a report</h2>

              <div className={styles.createSixCardGrid}>
                <button type="button" className={styles.createSourceCard} onClick={onOpenGetDataModal}>
                  <div className={styles.createSourceCardTop} style={{ background: "#f2f1f0" }}>
                    <GetDataRibbonIcon size={34} />
                  </div>
                  <div className={styles.createSourceCardLabel}>Get Data</div>
                </button>

                <button type="button" className={styles.createSourceCard} onClick={onLoadSocialSample}>
                  <div className={styles.createSourceCardTop} style={{ background: "#e6f2fb" }}>
                    <OneLakeCatalogIcon size={36} />
                  </div>
                  <div className={styles.createSourceCardLabel}>OneLake catalog</div>
                </button>

                <button type="button" className={styles.createSourceCard} onClick={onUploadCsv}>
                  <div className={styles.createSourceCardTop} style={{ background: "#eaf4ee" }}>
                    <TileExcelBadge size={34} />
                  </div>
                  <div className={styles.createSourceCardLabel}>Excel</div>
                </button>

                <button type="button" className={styles.createSourceCard} onClick={onUploadCsv}>
                  <div className={styles.createSourceCardTop} style={{ background: "#eaf4ee" }}>
                    <ServiceCsvBadge size={36} />
                  </div>
                  <div className={styles.createSourceCardLabel}>CSV</div>
                </button>

                <button type="button" className={styles.createSourceCard} onClick={onOpenEnterData}>
                  <div className={styles.createSourceCardTop} style={{ background: "#fbf6e8" }}>
                    <EnterDataRibbonIcon size={34} />
                  </div>
                  <div className={styles.createSourceCardLabel}>Paste or manually enter data</div>
                </button>

                <button type="button" className={styles.createSourceCard} onClick={onLoadRetailSample}>
                  <div className={styles.createSourceCardTop} style={{ background: "#faf5ea" }}>
                    <SemanticModelBadge size={36} />
                  </div>
                  <div className={styles.createSourceCardLabel}>Pick a published semantic model</div>
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "#605e5c" }}>
                Don&apos;t see the source you&apos;re looking for?{" "}
                <button
                  type="button"
                  onClick={onSwitchToDesktop}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#117865",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                >
                  Open the desktop app
                </button>
                .
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
