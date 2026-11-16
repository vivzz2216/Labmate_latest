export type IdeId = "codeblocks" | "vscode" | "notepad" | "eclipse" | "intellij" | "workbench" | "sqlite" | "mysql-cli" | "idle" | "jupyter";
export const IDE_LABELS: Record<IdeId, string> = {
  codeblocks: "Code::Blocks", vscode: "VS Code", notepad: "Notepad",
  eclipse: "Eclipse", intellij: "IntelliJ IDEA", workbench: "MySQL Workbench",
  sqlite: "DB Browser for SQLite", "mysql-cli": "MySQL CLI Client",
  idle: "Python IDLE", jupyter: "Jupyter Notebook",
};
type Association = { language: "c" | "cpp" | "java" | "sql" | "python"; defaultIde: IdeId; alternatives: IdeId[] };
const c: Association = { language: "c", defaultIde: "codeblocks", alternatives: ["vscode"] };
const java: Association = { language: "java", defaultIde: "notepad", alternatives: ["eclipse", "intellij", "vscode"] };
const sql: Association = { language: "sql", defaultIde: "workbench", alternatives: ["sqlite", "mysql-cli"] };
export const LAB_IDE_ASSOCIATIONS: Record<string, Association> = {
  "mu-nep-sem1-vsec102-c-programming": c,
  "mu-nep-sem2-pcl2011-data-structures": c,
  "mu-nep-sem2-vsec202-python-programming": { language: "python", defaultIde: "idle", alternatives: ["vscode", "jupyter"] },
  "mu-nep-sem3-it-ads-lab": c,
  "mu-nep-sem3-full-stack-java": java,
  "mu-nep-sem3-it-sql-lab": sql,
  "mu-nep-sem4-dbms-lab": sql,
};
export function labIdeOptions(labId: string): IdeId[] {
  const lab = LAB_IDE_ASSOCIATIONS[labId];
  return lab ? [lab.defaultIde, ...lab.alternatives] : [];
}
export function resolveLabIde(labId: string, preference?: string | null): IdeId | undefined {
  const lab = LAB_IDE_ASSOCIATIONS[labId];
  return lab ? labIdeOptions(labId).find(ide => ide === preference) || lab.defaultIde : undefined;
}
export function labIdeHref(labId: string, preference?: string | null): string | undefined {
  const lab = LAB_IDE_ASSOCIATIONS[labId], ide = resolveLabIde(labId, preference);
  if (!lab || !ide) return undefined;
  const route = ({eclipse:"/eclipse",intellij:"/intellij",sqlite:"/db-browser","mysql-cli":"/mysql-cli"} as Partial<Record<IdeId,string>>)[ide] || "/code-execution";
  return route + "?" + new URLSearchParams({muLab:labId,ide,language:lab.language}).toString();
}

// Uploading, restoring and resetting use the same context-preserving location.
export function workspaceLocation(search: string, assignment?: number | null, preference?: string): string {
  const params = new URLSearchParams(search);
  if (assignment) params.set('assignment', String(assignment));
  else params.delete('assignment');
  const labId = params.get('muLab') || '';
  const lab = LAB_IDE_ASSOCIATIONS[labId];
  const ide = resolveLabIde(labId, preference || params.get('ide'));
  if (lab && ide) {
    params.set('ide', ide);
    params.set('language', lab.language);
  }
  return '/code-execution' + (params.size ? '?' + params : '');
}
