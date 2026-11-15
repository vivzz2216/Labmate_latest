"use client";

import React, { useEffect, useState } from "react";
import type { PragmaState } from "@/lib/ide/sqliteEngine";
import styles from "./db-browser.module.css";

interface EditPragmasTabProps {
  pragmas: PragmaState;
  onApplyAllPragmas: (next: PragmaState) => void;
}

export function EditPragmasTab({ pragmas, onApplyAllPragmas }: EditPragmasTabProps) {
  const [draft, setDraft] = useState<PragmaState>(pragmas);

  useEffect(() => {
    setDraft(pragmas);
  }, [pragmas]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(pragmas);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", background: "#ffffff", margin: "4px", border: "1px solid #a0a0a0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={{ padding: "5px 8px", width: "45%" }}>Auto Vacuum</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.auto_vacuum}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      auto_vacuum: e.target.value as PragmaState["auto_vacuum"],
                    })
                  }
                >
                  <option value="NONE">NONE</option>
                  <option value="FULL">FULL</option>
                  <option value="INCREMENTAL">INCREMENTAL</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Cache Size (pages / KiB)</td>
              <td style={{ padding: "5px 8px" }}>
                <input
                  type="number"
                  className={styles.winInput}
                  style={{ width: "100%" }}
                  value={draft.cache_size}
                  onChange={(e) =>
                    setDraft({ ...draft, cache_size: parseInt(e.target.value || "0", 10) })
                  }
                />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Encoding</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.encoding}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      encoding: e.target.value as PragmaState["encoding"],
                    })
                  }
                >
                  <option value="UTF-8">UTF-8</option>
                  <option value="UTF-16">UTF-16</option>
                  <option value="UTF-16le">UTF-16le</option>
                  <option value="UTF-16be">UTF-16be</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Foreign Keys</td>
              <td style={{ padding: "5px 8px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={draft.foreign_keys}
                    onChange={(e) => setDraft({ ...draft, foreign_keys: e.target.checked })}
                  />
                  <span>{draft.foreign_keys ? "Enabled (1)" : "Disabled (0)"}</span>
                </label>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Journal Mode</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.journal_mode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      journal_mode: e.target.value as PragmaState["journal_mode"],
                    })
                  }
                >
                  <option value="delete">delete</option>
                  <option value="truncate">truncate</option>
                  <option value="persist">persist</option>
                  <option value="memory">memory</option>
                  <option value="wal">wal</option>
                  <option value="off">off</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Locking Mode</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.locking_mode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      locking_mode: e.target.value as PragmaState["locking_mode"],
                    })
                  }
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="EXCLUSIVE">EXCLUSIVE</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Page Size</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.page_size}
                  onChange={(e) =>
                    setDraft({ ...draft, page_size: parseInt(e.target.value, 10) })
                  }
                >
                  {[512, 1024, 2048, 4096, 8192, 16384, 32768, 65536].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Recursive Triggers</td>
              <td style={{ padding: "5px 8px" }}>
                <input
                  type="checkbox"
                  checked={draft.recursive_triggers}
                  onChange={(e) =>
                    setDraft({ ...draft, recursive_triggers: e.target.checked })
                  }
                />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Synchronous</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.synchronous}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      synchronous: e.target.value as PragmaState["synchronous"],
                    })
                  }
                >
                  <option value="OFF">OFF</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="FULL">FULL</option>
                  <option value="EXTRA">EXTRA</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Temp Store</td>
              <td style={{ padding: "5px 8px" }}>
                <select
                  className={styles.winSelect}
                  style={{ width: "100%" }}
                  value={draft.temp_store}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      temp_store: e.target.value as PragmaState["temp_store"],
                    })
                  }
                >
                  <option value="DEFAULT">DEFAULT</option>
                  <option value="FILE">FILE</option>
                  <option value="MEMORY">MEMORY</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>User Version</td>
              <td style={{ padding: "5px 8px" }}>
                <input
                  type="number"
                  className={styles.winInput}
                  style={{ width: "100%" }}
                  value={draft.user_version}
                  onChange={(e) =>
                    setDraft({ ...draft, user_version: parseInt(e.target.value || "0", 10) })
                  }
                />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "5px 8px" }}>Schema Version</td>
              <td style={{ padding: "5px 8px" }}>
                <input
                  type="number"
                  className={styles.winInput}
                  style={{ width: "100%", background: "#f4f4f4" }}
                  value={draft.schema_version}
                  readOnly
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ padding: "6px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          className={styles.winButton}
          disabled={!isDirty}
          onClick={() => setDraft(pragmas)}
        >
          Revert
        </button>
        <button
          type="button"
          className={styles.winButton}
          disabled={!isDirty}
          onClick={() => onApplyAllPragmas(draft)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
