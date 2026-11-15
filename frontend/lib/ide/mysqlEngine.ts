/**
 * Pure TypeScript MySQL 8.0 Command Line Client execution engine.
 * Zero external or `@/` imports; compatible with TypeScript `target: "es5"`, `strict: true`,
 * and Node `--experimental-strip-types`.
 */

export type MysqlValue = string | number | boolean | null;

export type MysqlPromptType =
  | "main"
  | "continue"
  | "singleQuote"
  | "doubleQuote"
  | "backtick"
  | "comment";

export interface MysqlColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  key: "PRI" | "UNI" | "MUL" | "";
  defaultValue: MysqlValue;
  extra: string;
  autoIncrement?: boolean;
}

export interface MysqlTable {
  name: string;
  columns: MysqlColumnDef[];
  rows: Record<string, MysqlValue>[];
  nextAutoIncrement: number;
  engine: string;
  charset: string;
}

export interface MysqlDatabase {
  name: string;
  tables: Record<string, MysqlTable>;
}

export interface MysqlOutputBlock {
  kind: "text" | "error" | "table" | "vertical" | "status" | "help" | "bye";
  text: string;
}

export interface MysqlSession {
  databases: Record<string, MysqlDatabase>;
  currentDb: string | null;
  delimiter: string;
  promptPattern: string;
  connectionId: number;
  questions: number;
  serverVersion: string;
  user: string;
  warningsEnabled: boolean;
  lastWarnings: Array<{ level: string; code: number; message: string }>;
  buffer: string;
  exited: boolean;
  startedAt: number;
}

export interface MysqlExecutionResult {
  outputs: MysqlOutputBlock[];
  clearScreen: boolean;
  exited: boolean;
  reconnected: boolean;
  prompt: string;
  promptType: MysqlPromptType;
  currentDb: string | null;
}

export const MYSQL_SERVER_VERSION = "8.0.35";

export const MYSQL_WELCOME_BANNER = [
  "Welcome to the MySQL monitor.  Commands end with ; or \\g.",
  "Your MySQL connection id is 12",
  "Server version: 8.0.35 MySQL Community Server - GPL",
  "",
  "Copyright (c) 2000, 2024, Oracle and/or its affiliates.",
  "",
  "Oracle is a registered trademark of Oracle Corporation and/or its",
  "affiliates. Other names may be trademarks of their respective",
  "owners.",
  "",
  "Type 'help;' or '\\h' for help. Type '\\c' to clear the current input statement.",
].join("\n");

export const MYSQL_HELP_TEXT = [
  "For information about MySQL products and services, visit:",
  "   http://www.mysql.com/",
  "For developer information, including the MySQL Reference Manual, visit:",
  "   http://dev.mysql.com/",
  "To buy MySQL Enterprise support, training, or other products, visit:",
  "   https://shop.mysql.com/",
  "",
  "List of all MySQL commands:",
  "Note that all text commands must be first on line and end with ';'",
  "?         (\\?) Synonym for `help'.",
  "clear     (\\c) Clear the current input statement.",
  "connect   (\\r) Reconnect to the server. Optional arguments are db and host.",
  "delimiter (\\d) Set statement delimiter.",
  "ego       (\\G) Send command to mysql server, display result vertically.",
  "exit      (\\q) Exit mysql. Same as quit.",
  "go        (\\g) Send command to mysql server.",
  "help      (\\h) Display this help.",
  "notee     (\\t) Don't write into outfile.",
  "print     (\\p) Print current command.",
  "prompt    (\\R) Change your mysql prompt.",
  "quit      (\\q) Quit mysql.",
  "rehash    (\\#) Rebuild completion hash.",
  "source    (\\.) Execute an SQL script file. Takes a file name as an argument.",
  "status    (\\s) Get status information from the server.",
  "system    (\\!) Execute a system shell command.",
  "tee       (\\T) Set outfile [to_be_used]. Append everything into outfile.",
  "use       (\\u) Use another database. Takes database name as an argument.",
  "charset   (\\C) Switch to another charset. Might be needed for processing binlog with multi-byte charsets.",
  "warnings  (\\W) Show warnings after every statement.",
  "nowarning (\\w) Don't show warnings after every statement.",
  "resetconnection(\\x) Clean session context.",
  "",
  "For server side help, type 'help contents'",
].join("\n");

const SYSTEM_DATABASES = ["information_schema", "mysql", "performance_schema", "sys"];

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "DATABASE",
  "DATABASES",
  "TABLE",
  "TABLES",
  "DROP",
  "ALTER",
  "ADD",
  "COLUMN",
  "MODIFY",
  "CHANGE",
  "RENAME",
  "TRUNCATE",
  "SHOW",
  "USE",
  "DESCRIBE",
  "DESC",
  "EXPLAIN",
  "COLUMNS",
  "INDEX",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "OUTER",
  "CROSS",
  "ON",
  "USING",
  "GROUP",
  "BY",
  "HAVING",
  "ORDER",
  "ASC",
  "DESC",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IS",
  "NULL",
  "IN",
  "BETWEEN",
  "LIKE",
  "EXISTS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "PRIMARY",
  "KEY",
  "AUTO_INCREMENT",
  "UNIQUE",
  "DEFAULT",
  "FOREIGN",
  "REFERENCES",
  "CONSTRAINT",
  "IF",
  "UNION",
  "ALL",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "IFNULL",
  "CONCAT",
  "UPPER",
  "LOWER",
  "LENGTH",
  "SUBSTRING",
  "ROUND",
  "NOW",
  "CURDATE",
  "VERSION",
  "DATABASE",
  "USER",
  "WARNINGS",
  "STATUS",
  "HELP",
  "EXIT",
  "QUIT",
];

function padRight(str: string, width: number): string {
  if (str.length >= width) return str;
  return str + new Array(width - str.length + 1).join(" ");
}

function padLeft(str: string, width: number): string {
  if (str.length >= width) return str;
  return new Array(width - str.length + 1).join(" ") + str;
}

function repeatChar(ch: string, count: number): string {
  if (count <= 0) return "";
  return new Array(count + 1).join(ch);
}

function isNumericTypeName(typeName: string): boolean {
  const lower = typeName.toLowerCase();
  return (
    lower.indexOf("int") !== -1 ||
    lower.indexOf("decimal") !== -1 ||
    lower.indexOf("numeric") !== -1 ||
    lower.indexOf("float") !== -1 ||
    lower.indexOf("double") !== -1 ||
    lower.indexOf("real") !== -1 ||
    lower.indexOf("bit") !== -1 ||
    lower.indexOf("bool") !== -1
  );
}

function formatCellValue(val: MysqlValue): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  return String(val);
}

function formatTiming(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  return "(" + sec.toFixed(2) + " sec)";
}

function formatRowCountLabel(n: number): string {
  return n === 1 ? "1 row" : n + " rows";
}

export function formatAsciiTable(
  columns: string[],
  rows: MysqlValue[][],
  numericCols?: boolean[],
  nullableCols?: boolean[]
): string {
  if (rows.length === 0) {
    return "Empty set (0.00 sec)";
  }
  const widths: number[] = [];
  const inferredNumeric: boolean[] = [];
  const splitRows: string[][][] = [];
  for (let c = 0; c < columns.length; c++) {
    let minWidth = columns[c].length;
    if (nullableCols && nullableCols[c] && minWidth < 4) {
      minWidth = 4;
    }
    widths.push(minWidth);
    if (numericCols) {
      inferredNumeric.push(Boolean(numericCols[c]));
    } else {
      let sawNum = false;
      let sawStr = false;
      for (let r = 0; r < rows.length; r++) {
        const v = rows[r][c];
        if (typeof v === "number" || typeof v === "boolean") sawNum = true;
        else if (typeof v === "string") sawStr = true;
      }
      inferredNumeric.push(sawNum && !sawStr);
    }
  }

  for (let r = 0; r < rows.length; r++) {
    const rowLineArrays: string[][] = [];
    for (let c = 0; c < columns.length; c++) {
      const cellStr = formatCellValue(rows[r][c] !== undefined ? rows[r][c] : null);
      const cellLines = cellStr.split(/\r?\n/);
      rowLineArrays.push(cellLines);
      for (let l = 0; l < cellLines.length; l++) {
        if (cellLines[l].length > widths[c]) widths[c] = cellLines[l].length;
      }
    }
    splitRows.push(rowLineArrays);
  }

  const sepParts: string[] = [];
  for (let c = 0; c < widths.length; c++) {
    sepParts.push(repeatChar("-", widths[c] + 2));
  }
  const border = "+" + sepParts.join("+") + "+";

  const headerParts: string[] = [];
  for (let c = 0; c < columns.length; c++) {
    headerParts.push(" " + padRight(columns[c], widths[c]) + " ");
  }
  const headerLine = "|" + headerParts.join("|") + "|";

  const lines: string[] = [border, headerLine, border];
  for (let r = 0; r < rows.length; r++) {
    const cellArrays = splitRows[r];
    let maxLines = 1;
    for (let c = 0; c < columns.length; c++) {
      if (cellArrays[c].length > maxLines) maxLines = cellArrays[c].length;
    }
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const rowParts: string[] = [];
      for (let c = 0; c < columns.length; c++) {
        const cellLine = lineIdx < cellArrays[c].length ? cellArrays[c][lineIdx] : "";
        const isNum = inferredNumeric[c];
        const aligned =
          isNum && lineIdx === 0 && cellArrays[c].length === 1
            ? padLeft(cellLine, widths[c])
            : padRight(cellLine, widths[c]);
        rowParts.push(" " + aligned + " ");
      }
      lines.push("|" + rowParts.join("|") + "|");
    }
  }
  lines.push(border);
  return lines.join("\n");
}

export function formatVerticalRows(columns: string[], rows: MysqlValue[][]): string {
  if (rows.length === 0) {
    return "Empty set (0.00 sec)";
  }
  let maxKeyLen = 0;
  for (let c = 0; c < columns.length; c++) {
    if (columns[c].length > maxKeyLen) maxKeyLen = columns[c].length;
  }
  const blocks: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    blocks.push("*************************** " + (r + 1) + ". row ***************************");
    for (let c = 0; c < columns.length; c++) {
      const raw = rows[r][c] !== undefined ? rows[r][c] : null;
      blocks.push(padLeft(columns[c], maxKeyLen) + ": " + formatCellValue(raw));
    }
  }
  return blocks.join("\n");
}

function makeCol(
  name: string,
  type: string,
  opts?: Partial<MysqlColumnDef>
): MysqlColumnDef {
  return {
    name: name,
    type: type,
    nullable: opts && opts.nullable !== undefined ? opts.nullable : true,
    key: opts && opts.key ? opts.key : "",
    defaultValue: opts && opts.defaultValue !== undefined ? opts.defaultValue : null,
    extra: opts && opts.extra ? opts.extra : "",
    autoIncrement: opts && opts.autoIncrement ? opts.autoIncrement : false,
  };
}

function cloneTable(tbl: MysqlTable): MysqlTable {
  const cols: MysqlColumnDef[] = [];
  for (let i = 0; i < tbl.columns.length; i++) {
    const c = tbl.columns[i];
    cols.push({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      key: c.key,
      defaultValue: c.defaultValue,
      extra: c.extra,
      autoIncrement: c.autoIncrement,
    });
  }
  const rows: Record<string, MysqlValue>[] = [];
  for (let i = 0; i < tbl.rows.length; i++) {
    const src = tbl.rows[i];
    const copy: Record<string, MysqlValue> = {};
    const keys = Object.keys(src);
    for (let k = 0; k < keys.length; k++) {
      copy[keys[k]] = src[keys[k]];
    }
    rows.push(copy);
  }
  return {
    name: tbl.name,
    columns: cols,
    rows: rows,
    nextAutoIncrement: tbl.nextAutoIncrement,
    engine: tbl.engine,
    charset: tbl.charset,
  };
}

function createSeedDatabases(): Record<string, MysqlDatabase> {
  const dbs: Record<string, MysqlDatabase> = {};

  dbs["information_schema"] = {
    name: "information_schema",
    tables: {
      SCHEMATA: {
        name: "SCHEMATA",
        columns: [
          makeCol("CATALOG_NAME", "varchar(64)", { nullable: false }),
          makeCol("SCHEMA_NAME", "varchar(64)", { nullable: false }),
          makeCol("DEFAULT_CHARACTER_SET_NAME", "varchar(64)", { nullable: false }),
          makeCol("DEFAULT_COLLATION_NAME", "varchar(64)", { nullable: false }),
        ],
        rows: [],
        nextAutoIncrement: 1,
        engine: "MEMORY",
        charset: "utf8mb3",
      },
      TABLES: {
        name: "TABLES",
        columns: [
          makeCol("TABLE_SCHEMA", "varchar(64)", { nullable: false }),
          makeCol("TABLE_NAME", "varchar(64)", { nullable: false }),
          makeCol("TABLE_TYPE", "varchar(64)", { nullable: false }),
          makeCol("ENGINE", "varchar(64)"),
          makeCol("TABLE_ROWS", "bigint unsigned"),
        ],
        rows: [],
        nextAutoIncrement: 1,
        engine: "MEMORY",
        charset: "utf8mb3",
      },
      COLUMNS: {
        name: "COLUMNS",
        columns: [
          makeCol("TABLE_SCHEMA", "varchar(64)", { nullable: false }),
          makeCol("TABLE_NAME", "varchar(64)", { nullable: false }),
          makeCol("COLUMN_NAME", "varchar(64)", { nullable: false }),
          makeCol("DATA_TYPE", "varchar(64)"),
          makeCol("IS_NULLABLE", "varchar(3)", { nullable: false }),
          makeCol("COLUMN_KEY", "varchar(3)"),
        ],
        rows: [],
        nextAutoIncrement: 1,
        engine: "MEMORY",
        charset: "utf8mb3",
      },
    },
  };

  dbs["mysql"] = {
    name: "mysql",
    tables: {
      user: {
        name: "user",
        columns: [
          makeCol("Host", "char(255)", { nullable: false, key: "PRI", defaultValue: "" }),
          makeCol("User", "char(32)", { nullable: false, key: "PRI", defaultValue: "" }),
          makeCol("plugin", "char(64)", { nullable: false, defaultValue: "caching_sha2_password" }),
          makeCol("account_locked", "enum('N','Y')", { nullable: false, defaultValue: "N" }),
        ],
        rows: [
          { Host: "localhost", User: "root", plugin: "caching_sha2_password", account_locked: "N" },
          { Host: "localhost", User: "mysql.sys", plugin: "caching_sha2_password", account_locked: "Y" },
          { Host: "localhost", User: "mysql.session", plugin: "caching_sha2_password", account_locked: "Y" },
          { Host: "%", User: "lab_user", plugin: "caching_sha2_password", account_locked: "N" },
        ],
        nextAutoIncrement: 1,
        engine: "InnoDB",
        charset: "utf8mb3",
      },
      db: {
        name: "db",
        columns: [
          makeCol("Host", "char(255)", { nullable: false, key: "PRI" }),
          makeCol("Db", "char(64)", { nullable: false, key: "PRI" }),
          makeCol("User", "char(32)", { nullable: false, key: "PRI" }),
          makeCol("Select_priv", "enum('N','Y')", { nullable: false, defaultValue: "N" }),
        ],
        rows: [
          { Host: "localhost", Db: "university", User: "root", Select_priv: "Y" },
          { Host: "localhost", Db: "company", User: "root", Select_priv: "Y" },
        ],
        nextAutoIncrement: 1,
        engine: "InnoDB",
        charset: "utf8mb3",
      },
    },
  };

  dbs["performance_schema"] = {
    name: "performance_schema",
    tables: {
      threads: {
        name: "threads",
        columns: [
          makeCol("THREAD_ID", "bigint unsigned", { nullable: false, key: "PRI" }),
          makeCol("NAME", "varchar(128)", { nullable: false }),
          makeCol("TYPE", "varchar(10)", { nullable: false }),
          makeCol("PROCESSLIST_USER", "varchar(32)"),
          makeCol("PROCESSLIST_DB", "varchar(64)"),
        ],
        rows: [
          { THREAD_ID: 1, NAME: "thread/sql/main", TYPE: "BACKGROUND", PROCESSLIST_USER: null, PROCESSLIST_DB: null },
          { THREAD_ID: 48, NAME: "thread/sql/one_connection", TYPE: "FOREGROUND", PROCESSLIST_USER: "root", PROCESSLIST_DB: "university" },
        ],
        nextAutoIncrement: 49,
        engine: "PERFORMANCE_SCHEMA",
        charset: "utf8mb4",
      },
      accounts: {
        name: "accounts",
        columns: [
          makeCol("USER", "char(32)"),
          makeCol("HOST", "char(255)"),
          makeCol("CURRENT_CONNECTIONS", "bigint", { nullable: false }),
          makeCol("TOTAL_CONNECTIONS", "bigint", { nullable: false }),
        ],
        rows: [
          { USER: "root", HOST: "localhost", CURRENT_CONNECTIONS: 1, TOTAL_CONNECTIONS: 12 },
        ],
        nextAutoIncrement: 1,
        engine: "PERFORMANCE_SCHEMA",
        charset: "utf8mb4",
      },
    },
  };

  dbs["sys"] = {
    name: "sys",
    tables: {
      version: {
        name: "version",
        columns: [
          makeCol("sys_version", "varchar(64)"),
          makeCol("mysql_version", "varchar(64)"),
        ],
        rows: [{ sys_version: "2.1.2", mysql_version: MYSQL_SERVER_VERSION }],
        nextAutoIncrement: 1,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
    },
  };

  dbs["university"] = {
    name: "university",
    tables: {
      departments: {
        name: "departments",
        columns: [
          makeCol("dept_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("dept_name", "varchar(80)", { nullable: false, key: "UNI" }),
          makeCol("building", "varchar(40)", { nullable: true }),
          makeCol("budget", "decimal(12,2)", { nullable: true, defaultValue: 0 }),
          makeCol("hod_name", "varchar(60)", { nullable: true }),
        ],
        rows: [
          { dept_id: 1, dept_name: "Computer Science", building: "Block A", budget: 4500000, hod_name: "Dr. S. Kulkarni" },
          { dept_id: 2, dept_name: "Information Technology", building: "Block B", budget: 3800000, hod_name: "Dr. M. Deshmukh" },
          { dept_id: 3, dept_name: "Electronics & Comm", building: "Block C", budget: 3200000, hod_name: "Dr. R. Subramanian" },
          { dept_id: 4, dept_name: "Data Science", building: "Block A", budget: 4100000, hod_name: "Dr. A. Chatterjee" },
          { dept_id: 5, dept_name: "Mechanical Engg", building: "Block E", budget: 2900000, hod_name: "Dr. V. Joshi" },
        ],
        nextAutoIncrement: 6,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      faculty: {
        name: "faculty",
        columns: [
          makeCol("faculty_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("name", "varchar(80)", { nullable: false }),
          makeCol("dept_id", "int", { nullable: true, key: "MUL" }),
          makeCol("designation", "varchar(50)", { nullable: true }),
          makeCol("salary", "decimal(10,2)", { nullable: true }),
          makeCol("email", "varchar(100)", { nullable: true, key: "UNI" }),
        ],
        rows: [
          { faculty_id: 101, name: "Dr. S. Kulkarni", dept_id: 1, designation: "Professor", salary: 145000, email: "skulkarni@univ.edu" },
          { faculty_id: 102, name: "Prof. Neha Verma", dept_id: 1, designation: "Assistant Professor", salary: 88000, email: "nverma@univ.edu" },
          { faculty_id: 103, name: "Dr. M. Deshmukh", dept_id: 2, designation: "Professor", salary: 138000, email: "mdeshmukh@univ.edu" },
          { faculty_id: 104, name: "Dr. A. Chatterjee", dept_id: 4, designation: "Associate Professor", salary: 118000, email: "achatterjee@univ.edu" },
          { faculty_id: 105, name: "Prof. Arjun Nair", dept_id: 3, designation: "Assistant Professor", salary: 84000, email: "anair@univ.edu" },
          { faculty_id: 106, name: "Dr. V. Joshi", dept_id: 5, designation: "Professor", salary: 132000, email: "vjoshi@univ.edu" },
        ],
        nextAutoIncrement: 107,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      students: {
        name: "students",
        columns: [
          makeCol("student_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("roll_no", "varchar(20)", { nullable: false, key: "UNI" }),
          makeCol("name", "varchar(80)", { nullable: false }),
          makeCol("dept_id", "int", { nullable: true, key: "MUL" }),
          makeCol("semester", "int", { nullable: true, defaultValue: 1 }),
          makeCol("cgpa", "decimal(3,2)", { nullable: true }),
          makeCol("city", "varchar(50)", { nullable: true }),
          makeCol("email", "varchar(100)", { nullable: true }),
        ],
        rows: [
          { student_id: 1, roll_no: "CS2023001", name: "Aarav Sharma", dept_id: 1, semester: 5, cgpa: 9.12, city: "Mumbai", email: "aarav.sharma@univ.edu" },
          { student_id: 2, roll_no: "CS2023002", name: "Priya Nair", dept_id: 1, semester: 5, cgpa: 9.45, city: "Pune", email: "priya.nair@univ.edu" },
          { student_id: 3, roll_no: "IT2023014", name: "Rohan Kulkarni", dept_id: 2, semester: 5, cgpa: 8.34, city: "Thane", email: "rohan.k@univ.edu" },
          { student_id: 4, roll_no: "DS2023007", name: "Ananya Iyer", dept_id: 4, semester: 7, cgpa: 9.28, city: "Bengaluru", email: "ananya.iyer@univ.edu" },
          { student_id: 5, roll_no: "EC2023019", name: "Kabir Verma", dept_id: 3, semester: 3, cgpa: 7.85, city: "Delhi", email: "kabir.verma@univ.edu" },
          { student_id: 6, roll_no: "CS2023022", name: "Sneha Joshi", dept_id: 1, semester: 5, cgpa: 8.76, city: "Mumbai", email: "sneha.joshi@univ.edu" },
          { student_id: 7, roll_no: "IT2023031", name: "Vikram Patel", dept_id: 2, semester: 7, cgpa: 8.1, city: "Ahmedabad", email: "vikram.patel@univ.edu" },
          { student_id: 8, roll_no: "DS2023012", name: "Meera Menon", dept_id: 4, semester: 3, cgpa: 8.95, city: "Kochi", email: "meera.menon@univ.edu" },
        ],
        nextAutoIncrement: 9,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      courses: {
        name: "courses",
        columns: [
          makeCol("course_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("course_code", "varchar(16)", { nullable: false, key: "UNI" }),
          makeCol("title", "varchar(100)", { nullable: false }),
          makeCol("dept_id", "int", { nullable: true, key: "MUL" }),
          makeCol("credits", "int", { nullable: false, defaultValue: 4 }),
          makeCol("faculty_id", "int", { nullable: true, key: "MUL" }),
        ],
        rows: [
          { course_id: 1, course_code: "CS301", title: "Database Management Systems", dept_id: 1, credits: 4, faculty_id: 101 },
          { course_id: 2, course_code: "CS302", title: "Operating Systems", dept_id: 1, credits: 4, faculty_id: 102 },
          { course_id: 3, course_code: "IT304", title: "Web Engineering", dept_id: 2, credits: 3, faculty_id: 103 },
          { course_id: 4, course_code: "DS401", title: "Machine Learning", dept_id: 4, credits: 4, faculty_id: 104 },
          { course_id: 5, course_code: "EC205", title: "Digital Signal Processing", dept_id: 3, credits: 3, faculty_id: 105 },
          { course_id: 6, course_code: "CS305", title: "Computer Networks", dept_id: 1, credits: 4, faculty_id: 102 },
        ],
        nextAutoIncrement: 7,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      enrollments: {
        name: "enrollments",
        columns: [
          makeCol("enrollment_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("student_id", "int", { nullable: false, key: "MUL" }),
          makeCol("course_id", "int", { nullable: false, key: "MUL" }),
          makeCol("semester", "varchar(16)", { nullable: false }),
          makeCol("grade", "varchar(4)", { nullable: true }),
          makeCol("marks", "int", { nullable: true }),
        ],
        rows: [
          { enrollment_id: 1, student_id: 1, course_id: 1, semester: "Fall-2025", grade: "A+", marks: 94 },
          { enrollment_id: 2, student_id: 1, course_id: 2, semester: "Fall-2025", grade: "A", marks: 88 },
          { enrollment_id: 3, student_id: 2, course_id: 1, semester: "Fall-2025", grade: "O", marks: 97 },
          { enrollment_id: 4, student_id: 2, course_id: 4, semester: "Fall-2025", grade: "A+", marks: 92 },
          { enrollment_id: 5, student_id: 3, course_id: 3, semester: "Fall-2025", grade: "A", marks: 85 },
          { enrollment_id: 6, student_id: 4, course_id: 4, semester: "Fall-2025", grade: "O", marks: 96 },
          { enrollment_id: 7, student_id: 5, course_id: 5, semester: "Fall-2025", grade: "B+", marks: 79 },
          { enrollment_id: 8, student_id: 6, course_id: 1, semester: "Fall-2025", grade: "A", marks: 89 },
          { enrollment_id: 9, student_id: 7, course_id: 3, semester: "Fall-2025", grade: "B+", marks: 81 },
          { enrollment_id: 10, student_id: 8, course_id: 4, semester: "Fall-2025", grade: "A+", marks: 91 },
        ],
        nextAutoIncrement: 11,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
    },
  };

  dbs["company"] = {
    name: "company",
    tables: {
      departments: {
        name: "departments",
        columns: [
          makeCol("dept_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("dept_name", "varchar(60)", { nullable: false, key: "UNI" }),
          makeCol("location", "varchar(60)", { nullable: true }),
        ],
        rows: [
          { dept_id: 10, dept_name: "Engineering", location: "Bengaluru" },
          { dept_id: 20, dept_name: "Sales", location: "Mumbai" },
          { dept_id: 30, dept_name: "Marketing", location: "Delhi" },
          { dept_id: 40, dept_name: "Human Resources", location: "Hyderabad" },
        ],
        nextAutoIncrement: 50,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      employees: {
        name: "employees",
        columns: [
          makeCol("emp_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("emp_name", "varchar(80)", { nullable: false }),
          makeCol("job_title", "varchar(60)", { nullable: true }),
          makeCol("dept_id", "int", { nullable: true, key: "MUL" }),
          makeCol("manager_id", "int", { nullable: true }),
          makeCol("salary", "decimal(10,2)", { nullable: true }),
          makeCol("hire_date", "date", { nullable: true }),
        ],
        rows: [
          { emp_id: 1001, emp_name: "Rajesh Mehta", job_title: "VP Engineering", dept_id: 10, manager_id: null, salary: 185000, hire_date: "2020-03-15" },
          { emp_id: 1002, emp_name: "Divya Krishnan", job_title: "Senior Engineer", dept_id: 10, manager_id: 1001, salary: 125000, hire_date: "2021-07-01" },
          { emp_id: 1003, emp_name: "Siddharth Rao", job_title: "Software Engineer", dept_id: 10, manager_id: 1002, salary: 92000, hire_date: "2023-01-10" },
          { emp_id: 1004, emp_name: "Neha Kapoor", job_title: "Sales Director", dept_id: 20, manager_id: null, salary: 155000, hire_date: "2020-08-22" },
          { emp_id: 1005, emp_name: "Amitabh Bansal", job_title: "Account Executive", dept_id: 20, manager_id: 1004, salary: 82000, hire_date: "2022-11-05" },
          { emp_id: 1006, emp_name: "Pooja Malhotra", job_title: "Marketing Lead", dept_id: 30, manager_id: null, salary: 112000, hire_date: "2021-04-18" },
          { emp_id: 1007, emp_name: "Karan Gill", job_title: "HR Specialist", dept_id: 40, manager_id: null, salary: 76000, hire_date: "2022-09-12" },
        ],
        nextAutoIncrement: 1008,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      customers: {
        name: "customers",
        columns: [
          makeCol("customer_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("customer_name", "varchar(80)", { nullable: false }),
          makeCol("city", "varchar(50)"),
          makeCol("country", "varchar(50)"),
          makeCol("phone", "varchar(30)"),
        ],
        rows: [
          { customer_id: 1, customer_name: "Apex Retail Pvt Ltd", city: "Mumbai", country: "India", phone: "+91-22-40192831" },
          { customer_id: 2, customer_name: "Orion Systems Inc", city: "Austin", country: "USA", phone: "+1-512-555-0142" },
          { customer_id: 3, customer_name: "Nordic Cloud AB", city: "Stockholm", country: "Sweden", phone: "+46-8-5012-4410" },
          { customer_id: 4, customer_name: "Vega Logistics", city: "Pune", country: "India", phone: "+91-20-66128940" },
          { customer_id: 5, customer_name: "BrightPath Health", city: "London", country: "UK", phone: "+44-20-7946-0821" },
        ],
        nextAutoIncrement: 6,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      products: {
        name: "products",
        columns: [
          makeCol("product_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("product_name", "varchar(80)", { nullable: false }),
          makeCol("category", "varchar(50)"),
          makeCol("unit_price", "decimal(10,2)", { nullable: false }),
          makeCol("stock_qty", "int", { nullable: false, defaultValue: 0 }),
        ],
        rows: [
          { product_id: 1, product_name: "LabMate Pro License", category: "Software", unit_price: 2499, stock_qty: 150 },
          { product_id: 2, product_name: "ThinkPad WorkStation", category: "Hardware", unit_price: 89500, stock_qty: 18 },
          { product_id: 3, product_name: "Ergonomic Desk Monitor", category: "Hardware", unit_price: 24990, stock_qty: 42 },
          { product_id: 4, product_name: "Cloud Backup 1TB", category: "Cloud", unit_price: 4999, stock_qty: 500 },
          { product_id: 5, product_name: "Mechanical Keyboard", category: "Accessories", unit_price: 4299, stock_qty: 75 },
        ],
        nextAutoIncrement: 6,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      orders: {
        name: "orders",
        columns: [
          makeCol("order_id", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("customer_id", "int", { nullable: false, key: "MUL" }),
          makeCol("emp_id", "int", { nullable: true, key: "MUL" }),
          makeCol("order_date", "date", { nullable: false }),
          makeCol("total_amount", "decimal(10,2)", { nullable: false }),
          makeCol("status", "varchar(24)", { nullable: false, defaultValue: "PENDING" }),
        ],
        rows: [
          { order_id: 501, customer_id: 1, emp_id: 1005, order_date: "2026-01-12", total_amount: 114490, status: "SHIPPED" },
          { order_id: 502, customer_id: 2, emp_id: 1004, order_date: "2026-01-19", total_amount: 24990, status: "DELIVERED" },
          { order_id: 503, customer_id: 3, emp_id: 1005, order_date: "2026-02-02", total_amount: 9998, status: "DELIVERED" },
          { order_id: 504, customer_id: 1, emp_id: 1005, order_date: "2026-02-14", total_amount: 4299, status: "PROCESSING" },
          { order_id: 505, customer_id: 4, emp_id: 1004, order_date: "2026-02-20", total_amount: 89500, status: "SHIPPED" },
        ],
        nextAutoIncrement: 506,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
    },
  };

  dbs["northwind"] = {
    name: "northwind",
    tables: {
      categories: {
        name: "categories",
        columns: [
          makeCol("CategoryID", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("CategoryName", "varchar(50)", { nullable: false }),
          makeCol("Description", "varchar(255)"),
        ],
        rows: [
          { CategoryID: 1, CategoryName: "Beverages", Description: "Soft drinks, coffees, teas, beers, and ales" },
          { CategoryID: 2, CategoryName: "Condiments", Description: "Sweet and savory sauces, relishes, spreads" },
          { CategoryID: 3, CategoryName: "Confections", Description: "Desserts, candies, and sweet breads" },
          { CategoryID: 4, CategoryName: "Dairy Products", Description: "Cheeses and creameries" },
        ],
        nextAutoIncrement: 5,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      customers: {
        name: "customers",
        columns: [
          makeCol("CustomerID", "varchar(10)", { nullable: false, key: "PRI" }),
          makeCol("CompanyName", "varchar(80)", { nullable: false }),
          makeCol("ContactName", "varchar(60)"),
          makeCol("City", "varchar(40)"),
          makeCol("Country", "varchar(40)"),
        ],
        rows: [
          { CustomerID: "ALFKI", CompanyName: "Alfreds Futterkiste", ContactName: "Maria Anders", City: "Berlin", Country: "Germany" },
          { CustomerID: "ANATR", CompanyName: "Ana Trujillo Emparedados", ContactName: "Ana Trujillo", City: "Mexico D.F.", Country: "Mexico" },
          { CustomerID: "ANTON", CompanyName: "Antonio Moreno Taqueria", ContactName: "Antonio Moreno", City: "Mexico D.F.", Country: "Mexico" },
          { CustomerID: "AROUT", CompanyName: "Around the Horn", ContactName: "Thomas Hardy", City: "London", Country: "UK" },
          { CustomerID: "BERGS", CompanyName: "Berglunds snabbkop", ContactName: "Christina Berglund", City: "Lulea", Country: "Sweden" },
        ],
        nextAutoIncrement: 1,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      shippers: {
        name: "shippers",
        columns: [
          makeCol("ShipperID", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("CompanyName", "varchar(60)", { nullable: false }),
          makeCol("Phone", "varchar(30)"),
        ],
        rows: [
          { ShipperID: 1, CompanyName: "Speedy Express", Phone: "(503) 555-9831" },
          { ShipperID: 2, CompanyName: "United Package", Phone: "(503) 555-3199" },
          { ShipperID: 3, CompanyName: "Federal Shipping", Phone: "(503) 555-9931" },
        ],
        nextAutoIncrement: 4,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      products: {
        name: "products",
        columns: [
          makeCol("ProductID", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("ProductName", "varchar(80)", { nullable: false }),
          makeCol("CategoryID", "int", { key: "MUL" }),
          makeCol("UnitPrice", "decimal(10,2)"),
          makeCol("UnitsInStock", "int"),
        ],
        rows: [
          { ProductID: 1, ProductName: "Chai", CategoryID: 1, UnitPrice: 18.0, UnitsInStock: 39 },
          { ProductID: 2, ProductName: "Chang", CategoryID: 1, UnitPrice: 19.0, UnitsInStock: 17 },
          { ProductID: 3, ProductName: "Aniseed Syrup", CategoryID: 2, UnitPrice: 10.0, UnitsInStock: 13 },
          { ProductID: 4, ProductName: "Chef Anton's Cajun Seasoning", CategoryID: 2, UnitPrice: 22.0, UnitsInStock: 53 },
          { ProductID: 5, ProductName: "Pavlova", CategoryID: 3, UnitPrice: 17.45, UnitsInStock: 29 },
          { ProductID: 6, ProductName: "Queso Cabrales", CategoryID: 4, UnitPrice: 21.0, UnitsInStock: 22 },
        ],
        nextAutoIncrement: 7,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
      orders: {
        name: "orders",
        columns: [
          makeCol("OrderID", "int", { nullable: false, key: "PRI", extra: "auto_increment", autoIncrement: true }),
          makeCol("CustomerID", "varchar(10)", { key: "MUL" }),
          makeCol("OrderDate", "date"),
          makeCol("ShipVia", "int", { key: "MUL" }),
          makeCol("Freight", "decimal(10,2)"),
        ],
        rows: [
          { OrderID: 10248, CustomerID: "ALFKI", OrderDate: "2025-07-04", ShipVia: 3, Freight: 32.38 },
          { OrderID: 10249, CustomerID: "ANATR", OrderDate: "2025-07-05", ShipVia: 1, Freight: 11.61 },
          { OrderID: 10250, CustomerID: "AROUT", OrderDate: "2025-07-08", ShipVia: 2, Freight: 65.83 },
          { OrderID: 10251, CustomerID: "BERGS", OrderDate: "2025-07-08", ShipVia: 1, Freight: 41.34 },
        ],
        nextAutoIncrement: 10252,
        engine: "InnoDB",
        charset: "utf8mb4",
      },
    },
  };

  return dbs;
}

export function createMysqlSession(initialDb: string | null = null): MysqlSession {
  const databases = createSeedDatabases();
  const db = initialDb && findDatabaseKey(databases, initialDb) ? findDatabaseKey(databases, initialDb) : null;
  return {
    databases: databases,
    currentDb: db,
    delimiter: ";",
    promptPattern: "mysql> ",
    connectionId: 12,
    questions: 0,
    serverVersion: MYSQL_SERVER_VERSION,
    user: "root@localhost",
    warningsEnabled: false,
    lastWarnings: [],
    buffer: "",
    exited: false,
    startedAt: Date.now(),
  };
}

export function formatMysqlPrompt(
  promptType: MysqlPromptType,
  customPrompt?: string
): string {
  switch (promptType) {
    case "main":
      return customPrompt || "mysql> ";
    case "continue":
      return "    -> ";
    case "singleQuote":
      return "    '> ";
    case "doubleQuote":
      return '    "> ';
    case "backtick":
      return "    `> ";
    case "comment":
      return "   /*> ";
  }
}

export function detectPromptType(buffer: string): MysqlPromptType {
  if (!buffer.trim()) return "main";
  let quote: "'" | '"' | "`" | null = null;
  let inBlockComment = false;
  let inLineComment = false;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    const next = i + 1 < buffer.length ? buffer[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (quote !== null) {
      if (ch === "\\" && (quote === "'" || quote === '"')) {
        i++;
        continue;
      }
      if (ch === quote) {
        if (next === quote) {
          i++;
          continue;
        }
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
    } else if (ch === "-" && next === "-" && (i + 2 >= buffer.length || /\s/.test(buffer[i + 2]))) {
      inLineComment = true;
      i++;
    } else if (ch === "#") {
      inLineComment = true;
    } else if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
    }
  }

  if (quote === "'") return "singleQuote";
  if (quote === '"') return "doubleQuote";
  if (quote === "`") return "backtick";
  if (inBlockComment) return "comment";
  return "continue";
}

function findDatabaseKey(databases: Record<string, MysqlDatabase>, name: string): string | null {
  const lower = name.toLowerCase();
  const keys = Object.keys(databases);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) return keys[i];
  }
  return null;
}

function findTableKey(db: MysqlDatabase, name: string): string | null {
  const lower = name.toLowerCase();
  const keys = Object.keys(db.tables);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) return keys[i];
  }
  return null;
}

function findColumnDef(table: MysqlTable, colName: string): MysqlColumnDef | null {
  const lower = colName.toLowerCase();
  for (let i = 0; i < table.columns.length; i++) {
    if (table.columns[i].name.toLowerCase() === lower) return table.columns[i];
  }
  return null;
}

function resolveRowValue(row: Record<string, MysqlValue>, colName: string): MysqlValue {
  if (Object.prototype.hasOwnProperty.call(row, colName)) return row[colName];
  const lower = colName.toLowerCase();
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) return row[keys[i]];
  }
  return null;
}

function refreshInformationSchema(session: MysqlSession): void {
  const infoDb = session.databases["information_schema"];
  if (!infoDb) return;
  const schemataRows: Record<string, MysqlValue>[] = [];
  const tableRows: Record<string, MysqlValue>[] = [];
  const columnRows: Record<string, MysqlValue>[] = [];

  const dbNames = Object.keys(session.databases).sort();
  for (let i = 0; i < dbNames.length; i++) {
    const dbName = dbNames[i];
    const db = session.databases[dbName];
    schemataRows.push({
      CATALOG_NAME: "def",
      SCHEMA_NAME: db.name,
      DEFAULT_CHARACTER_SET_NAME: dbName === "information_schema" ? "utf8mb3" : "utf8mb4",
      DEFAULT_COLLATION_NAME: dbName === "information_schema" ? "utf8mb3_general_ci" : "utf8mb4_0900_ai_ci",
    });

    const tNames = Object.keys(db.tables).sort();
    for (let j = 0; j < tNames.length; j++) {
      const tbl = db.tables[tNames[j]];
      tableRows.push({
        TABLE_SCHEMA: db.name,
        TABLE_NAME: tbl.name,
        TABLE_TYPE: dbName === "information_schema" ? "SYSTEM VIEW" : "BASE TABLE",
        ENGINE: tbl.engine,
        TABLE_ROWS: tbl.rows.length,
      });

      for (let c = 0; c < tbl.columns.length; c++) {
        const col = tbl.columns[c];
        columnRows.push({
          TABLE_SCHEMA: db.name,
          TABLE_NAME: tbl.name,
          COLUMN_NAME: col.name,
          DATA_TYPE: col.type.replace(/\(.*$/, ""),
          IS_NULLABLE: col.nullable ? "YES" : "NO",
          COLUMN_KEY: col.key,
        });
      }
    }
  }

  infoDb.tables["SCHEMATA"].rows = schemataRows;
  infoDb.tables["TABLES"].rows = tableRows;
  infoDb.tables["COLUMNS"].rows = columnRows;
}

// ============================================================
// SQL TOKENIZER
// ============================================================

type TokenKind = "word" | "number" | "string" | "ident" | "op" | "punct";

interface Token {
  kind: TokenKind;
  value: string;
  upper: string;
  pos: number;
}

class SqlSyntaxError extends Error {
  near: string;
  constructor(near: string, message?: string) {
    super(
      message ||
        "ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '" +
          near +
          "' at line 1"
    );
    this.near = near;
  }
}

class MysqlError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Comments
    if (ch === "-" && i + 1 < len && sql[i + 1] === "-" && (i + 2 >= len || /\s/.test(sql[i + 2]))) {
      i += 2;
      while (i < len && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "#") {
      i++;
      while (i < len && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && i + 1 < len && sql[i + 1] === "*") {
      i += 2;
      while (i < len && !(sql[i] === "*" && i + 1 < len && sql[i + 1] === "/")) {
        i++;
      }
      i += 2;
      continue;
    }

    // Quoted strings ('...' or "...")
    if (ch === "'" || ch === '"') {
      const q = ch;
      const start = i;
      i++;
      let val = "";
      let closed = false;
      while (i < len) {
        const c = sql[i];
        if (c === "\\" && i + 1 < len) {
          const esc = sql[i + 1];
          if (esc === "n") val += "\n";
          else if (esc === "t") val += "\t";
          else if (esc === "r") val += "\r";
          else val += esc;
          i += 2;
          continue;
        }
        if (c === q) {
          if (i + 1 < len && sql[i + 1] === q) {
            val += q;
            i += 2;
            continue;
          }
          closed = true;
          i++;
          break;
        }
        val += c;
        i++;
      }
      if (!closed) {
        throw new SqlSyntaxError(sql.slice(start, start + 20));
      }
      tokens.push({ kind: "string", value: val, upper: val, pos: start });
      continue;
    }

    // Backtick identifier
    if (ch === "`") {
      const start = i;
      i++;
      let val = "";
      let closed = false;
      while (i < len) {
        if (sql[i] === "`") {
          if (i + 1 < len && sql[i + 1] === "`") {
            val += "`";
            i += 2;
            continue;
          }
          closed = true;
          i++;
          break;
        }
        val += sql[i];
        i++;
      }
      if (!closed) {
        throw new SqlSyntaxError(sql.slice(start, start + 20));
      }
      tokens.push({ kind: "ident", value: val, upper: val.toUpperCase(), pos: start });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < len && /[0-9]/.test(sql[i + 1]))) {
      const start = i;
      while (i < len && /[0-9]/.test(sql[i])) i++;
      if (i < len && sql[i] === ".") {
        i++;
        while (i < len && /[0-9]/.test(sql[i])) i++;
      }
      const rawNum = sql.slice(start, i);
      tokens.push({ kind: "number", value: rawNum, upper: rawNum, pos: start });
      continue;
    }

    // Words / identifiers
    if (/[A-Za-z_@$]/.test(ch)) {
      const start = i;
      i++;
      while (i < len && /[A-Za-z0-9_@$]/.test(sql[i])) i++;
      const word = sql.slice(start, i);
      tokens.push({ kind: "word", value: word, upper: word.toUpperCase(), pos: start });
      continue;
    }

    // Multi-char operators
    const two = i + 1 < len ? sql.slice(i, i + 2) : "";
    const three = i + 2 < len ? sql.slice(i, i + 3) : "";
    if (three === "<=>") {
      tokens.push({ kind: "op", value: "<=>", upper: "<=>", pos: i });
      i += 3;
      continue;
    }
    if (two === "<=" || two === ">=" || two === "<>" || two === "!=" || two === "||" || two === "&&") {
      tokens.push({ kind: "op", value: two, upper: two, pos: i });
      i += 2;
      continue;
    }

    // Single-char operators & punctuation
    if ("=<>+-*/%!".indexOf(ch) !== -1) {
      tokens.push({ kind: "op", value: ch, upper: ch, pos: i });
      i++;
      continue;
    }
    if ("(),.;".indexOf(ch) !== -1) {
      tokens.push({ kind: "punct", value: ch, upper: ch, pos: i });
      i++;
      continue;
    }

    throw new SqlSyntaxError(sql.slice(i, i + 16));
  }

  return tokens;
}

// ============================================================
// AST & EXPRESSION EVALUATOR
// ============================================================

type Expr =
  | { type: "literal"; value: MysqlValue }
  | { type: "column"; table?: string; name: string }
  | { type: "unary"; op: string; arg: Expr }
  | { type: "binary"; op: string; left: Expr; right: Expr }
  | { type: "isNull"; arg: Expr; not: boolean }
  | { type: "between"; arg: Expr; low: Expr; high: Expr; not: boolean }
  | { type: "inList"; arg: Expr; items: Expr[]; not: boolean }
  | { type: "inSubquery"; arg: Expr; subquery: SelectStmt; not: boolean }
  | { type: "like"; arg: Expr; pattern: Expr; not: boolean }
  | { type: "func"; name: string; args: Expr[]; distinct?: boolean; star?: boolean }
  | { type: "case"; base?: Expr; whens: Array<{ cond: Expr; result: Expr }>; elseExpr?: Expr }
  | { type: "exists"; subquery: SelectStmt; not: boolean }
  | { type: "subquery"; subquery: SelectStmt };

interface SelectItem {
  expr?: Expr;
  alias?: string;
  star?: boolean;
  starTable?: string;
  rawText: string;
}

interface TableRef {
  db?: string;
  table: string;
  alias: string;
  joinType?: "INNER" | "LEFT" | "RIGHT" | "CROSS";
  on?: Expr;
  using?: string[];
}

interface OrderItem {
  expr: Expr;
  direction: "ASC" | "DESC";
}

interface SelectStmt {
  kind: "select";
  distinct: boolean;
  items: SelectItem[];
  from: TableRef[];
  where?: Expr;
  groupBy: Expr[];
  having?: Expr;
  orderBy: OrderItem[];
  limit?: number;
  offset?: number;
  union?: { all: boolean; right: SelectStmt };
}

class TokenCursor {
  tokens: Token[];
  pos: number;
  rawSql: string;

  constructor(tokens: Token[], rawSql: string) {
    this.tokens = tokens;
    this.pos = 0;
    this.rawSql = rawSql;
  }

  eof(): boolean {
    return this.pos >= this.tokens.length;
  }

  peek(offset: number = 0): Token | null {
    const idx = this.pos + offset;
    return idx >= 0 && idx < this.tokens.length ? this.tokens[idx] : null;
  }

  next(): Token {
    if (this.pos >= this.tokens.length) {
      throw new SqlSyntaxError("");
    }
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  nearHere(): string {
    const t = this.peek();
    if (!t) return "";
    return this.rawSql.slice(t.pos, t.pos + 24).trim();
  }

  matchWord(word: string): boolean {
    const t = this.peek();
    if (t && t.kind === "word" && t.upper === word) {
      this.pos++;
      return true;
    }
    return false;
  }

  isWord(word: string, offset: number = 0): boolean {
    const t = this.peek(offset);
    return Boolean(t && t.kind === "word" && t.upper === word);
  }

  matchPunct(ch: string): boolean {
    const t = this.peek();
    if (t && t.kind === "punct" && t.value === ch) {
      this.pos++;
      return true;
    }
    return false;
  }

  expectPunct(ch: string): void {
    if (!this.matchPunct(ch)) {
      throw new SqlSyntaxError(this.nearHere());
    }
  }

  matchOp(op: string): boolean {
    const t = this.peek();
    if (t && t.kind === "op" && t.value === op) {
      this.pos++;
      return true;
    }
    return false;
  }

  expectWord(word: string): void {
    if (!this.matchWord(word)) {
      throw new SqlSyntaxError(this.nearHere());
    }
  }

  parseIdent(): string {
    const t = this.peek();
    if (!t) throw new SqlSyntaxError("");
    if (t.kind === "ident" || t.kind === "word") {
      this.pos++;
      return t.value;
    }
    throw new SqlSyntaxError(this.nearHere());
  }

  parseTableName(): { db?: string; table: string } {
    const first = this.parseIdent();
    if (this.matchPunct(".")) {
      const second = this.parseIdent();
      return { db: first, table: second };
    }
    return { table: first };
  }
}

const CLAUSE_STOP_WORDS = [
  "FROM",
  "WHERE",
  "GROUP",
  "HAVING",
  "ORDER",
  "LIMIT",
  "UNION",
  "INTO",
  "VALUES",
  "SET",
  "ON",
  "USING",
  "INNER",
  "LEFT",
  "RIGHT",
  "CROSS",
  "JOIN",
];

function isClauseStopWord(upper: string): boolean {
  return CLAUSE_STOP_WORDS.indexOf(upper) !== -1;
}

function parseExpression(cur: TokenCursor): Expr {
  return parseOr(cur);
}

function parseOr(cur: TokenCursor): Expr {
  let left = parseAnd(cur);
  while (cur.matchWord("OR") || cur.matchOp("||")) {
    const right = parseAnd(cur);
    left = { type: "binary", op: "OR", left: left, right: right };
  }
  return left;
}

function parseAnd(cur: TokenCursor): Expr {
  let left = parseNot(cur);
  while (cur.matchWord("AND") || cur.matchOp("&&")) {
    const right = parseNot(cur);
    left = { type: "binary", op: "AND", left: left, right: right };
  }
  return left;
}

function parseNot(cur: TokenCursor): Expr {
  if (cur.matchWord("NOT") || cur.matchOp("!")) {
    return { type: "unary", op: "NOT", arg: parseNot(cur) };
  }
  return parseComparison(cur);
}

function parseComparison(cur: TokenCursor): Expr {
  let left = parseAdditive(cur);

  while (true) {
    if (cur.matchWord("IS")) {
      const isNot = cur.matchWord("NOT");
      if (cur.matchWord("NULL")) {
        left = { type: "isNull", arg: left, not: isNot };
        continue;
      }
      if (cur.matchWord("TRUE")) {
        left = { type: "binary", op: isNot ? "!=" : "=", left: left, right: { type: "literal", value: 1 } };
        continue;
      }
      if (cur.matchWord("FALSE")) {
        left = { type: "binary", op: isNot ? "!=" : "=", left: left, right: { type: "literal", value: 0 } };
        continue;
      }
      throw new SqlSyntaxError(cur.nearHere());
    }

    let negated = false;
    if (cur.isWord("NOT") && (cur.isWord("IN", 1) || cur.isWord("LIKE", 1) || cur.isWord("BETWEEN", 1))) {
      cur.next();
      negated = true;
    }

    if (cur.matchWord("IN")) {
      cur.expectPunct("(");
      if (cur.isWord("SELECT")) {
        const sub = parseSelectStatement(cur);
        cur.expectPunct(")");
        left = { type: "inSubquery", arg: left, subquery: sub, not: negated };
      } else {
        const items: Expr[] = [];
        if (!cur.matchPunct(")")) {
          do {
            items.push(parseExpression(cur));
          } while (cur.matchPunct(","));
          cur.expectPunct(")");
        }
        left = { type: "inList", arg: left, items: items, not: negated };
      }
      continue;
    }

    if (cur.matchWord("LIKE")) {
      const pattern = parseAdditive(cur);
      left = { type: "like", arg: left, pattern: pattern, not: negated };
      continue;
    }

    if (cur.matchWord("BETWEEN")) {
      const low = parseAdditive(cur);
      cur.expectWord("AND");
      const high = parseAdditive(cur);
      left = { type: "between", arg: left, low: low, high: high, not: negated };
      continue;
    }

    const t = cur.peek();
    if (t && t.kind === "op" && ["=", "!=", "<>", "<", "<=", ">", ">=", "<=>"].indexOf(t.value) !== -1) {
      cur.next();
      const right = parseAdditive(cur);
      left = { type: "binary", op: t.value, left: left, right: right };
      continue;
    }

    break;
  }

  return left;
}

function parseAdditive(cur: TokenCursor): Expr {
  let left = parseMultiplicative(cur);
  while (true) {
    const t = cur.peek();
    if (t && t.kind === "op" && (t.value === "+" || t.value === "-")) {
      cur.next();
      const right = parseMultiplicative(cur);
      left = { type: "binary", op: t.value, left: left, right: right };
      continue;
    }
    break;
  }
  return left;
}

function parseMultiplicative(cur: TokenCursor): Expr {
  let left = parseUnary(cur);
  while (true) {
    const t = cur.peek();
    if (t && t.kind === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
      cur.next();
      const right = parseUnary(cur);
      left = { type: "binary", op: t.value, left: left, right: right };
      continue;
    }
    if (cur.matchWord("MOD")) {
      const right = parseUnary(cur);
      left = { type: "binary", op: "%", left: left, right: right };
      continue;
    }
    break;
  }
  return left;
}

function parseUnary(cur: TokenCursor): Expr {
  if (cur.matchOp("-")) {
    return { type: "unary", op: "-", arg: parseUnary(cur) };
  }
  if (cur.matchOp("+")) {
    return parseUnary(cur);
  }
  return parsePrimary(cur);
}

function parsePrimary(cur: TokenCursor): Expr {
  const t = cur.peek();
  if (!t) throw new SqlSyntaxError("");

  if (t.kind === "number") {
    cur.next();
    return { type: "literal", value: Number(t.value) };
  }
  if (t.kind === "string") {
    cur.next();
    return { type: "literal", value: t.value };
  }
  if (t.kind === "word") {
    if (t.upper === "NULL") {
      cur.next();
      return { type: "literal", value: null };
    }
    if (t.upper === "TRUE") {
      cur.next();
      return { type: "literal", value: 1 };
    }
    if (t.upper === "FALSE") {
      cur.next();
      return { type: "literal", value: 0 };
    }
    if (t.upper === "EXISTS") {
      cur.next();
      cur.expectPunct("(");
      const sub = parseSelectStatement(cur);
      cur.expectPunct(")");
      return { type: "exists", subquery: sub, not: false };
    }
    if (t.upper === "CASE") {
      cur.next();
      let base: Expr | undefined;
      if (!cur.isWord("WHEN")) {
        base = parseExpression(cur);
      }
      const whens: Array<{ cond: Expr; result: Expr }> = [];
      while (cur.matchWord("WHEN")) {
        const cond = parseExpression(cur);
        cur.expectWord("THEN");
        const result = parseExpression(cur);
        whens.push({ cond: cond, result: result });
      }
      let elseExpr: Expr | undefined;
      if (cur.matchWord("ELSE")) {
        elseExpr = parseExpression(cur);
      }
      cur.expectWord("END");
      return { type: "case", base: base, whens: whens, elseExpr: elseExpr };
    }
  }

  if (cur.matchPunct("(")) {
    if (cur.isWord("SELECT")) {
      const sub = parseSelectStatement(cur);
      cur.expectPunct(")");
      return { type: "subquery", subquery: sub };
    }
    const inner = parseExpression(cur);
    cur.expectPunct(")");
    return inner;
  }

  if (t.kind === "word" || t.kind === "ident") {
    cur.next();
    // Function call
    if (t.kind === "word" && cur.matchPunct("(")) {
      const fnName = t.upper;
      let distinct = false;
      let star = false;
      const args: Expr[] = [];
      if (!cur.matchPunct(")")) {
        if (cur.matchWord("DISTINCT")) {
          distinct = true;
        }
        if (cur.matchOp("*")) {
          star = true;
        } else {
          do {
            args.push(parseExpression(cur));
          } while (cur.matchPunct(","));
        }
        cur.expectPunct(")");
      }
      return { type: "func", name: fnName, args: args, distinct: distinct, star: star };
    }

    // Qualified column name (table.col or db.table.col)
    if (cur.matchPunct(".")) {
      const second = cur.parseIdent();
      if (cur.matchPunct(".")) {
        const third = cur.parseIdent();
        return { type: "column", table: second, name: third };
      }
      return { type: "column", table: t.value, name: second };
    }

    return { type: "column", name: t.value };
  }

  throw new SqlSyntaxError(cur.nearHere());
}

// ============================================================
// SELECT PARSER
// ============================================================

function parseSelectStatement(cur: TokenCursor): SelectStmt {
  cur.expectWord("SELECT");
  const distinct = cur.matchWord("DISTINCT");
  if (!distinct) cur.matchWord("ALL");

  const items: SelectItem[] = [];
  do {
    const startTok = cur.peek();
    const startPos = startTok ? startTok.pos : cur.rawSql.length;

    if (cur.matchOp("*")) {
      items.push({ star: true, rawText: "*" });
      continue;
    }

    const first = cur.peek();
    const second = cur.peek(1);
    const third = cur.peek(2);
    if (
      first &&
      (first.kind === "word" || first.kind === "ident") &&
      second &&
      second.kind === "punct" &&
      second.value === "." &&
      third &&
      third.kind === "op" &&
      third.value === "*"
    ) {
      cur.next();
      cur.next();
      cur.next();
      items.push({ star: true, starTable: first.value, rawText: first.value + ".*" });
      continue;
    }

    const expr = parseExpression(cur);
    const endTok = cur.peek();
    const endPos = endTok ? endTok.pos : cur.rawSql.length;
    const rawExpr = cur.rawSql.slice(startPos, endPos).trim();

    let alias: string | undefined;
    if (cur.matchWord("AS")) {
      const aTok = cur.peek();
      if (aTok && (aTok.kind === "ident" || aTok.kind === "word" || aTok.kind === "string")) {
        cur.next();
        alias = aTok.value;
      } else {
        throw new SqlSyntaxError(cur.nearHere());
      }
    } else {
      const nextTok = cur.peek();
      if (
        nextTok &&
        (nextTok.kind === "ident" || (nextTok.kind === "word" && !isClauseStopWord(nextTok.upper)))
      ) {
        cur.next();
        alias = nextTok.value;
      }
    }

    items.push({ expr: expr, alias: alias, rawText: rawExpr });
  } while (cur.matchPunct(","));

  const from: TableRef[] = [];
  if (cur.matchWord("FROM")) {
    from.push(parseTableRef(cur));
    while (true) {
      if (cur.matchPunct(",")) {
        const ref = parseTableRef(cur);
        ref.joinType = "CROSS";
        from.push(ref);
        continue;
      }
      let joinType: "INNER" | "LEFT" | "RIGHT" | "CROSS" | null = null;
      if (cur.matchWord("INNER")) {
        cur.expectWord("JOIN");
        joinType = "INNER";
      } else if (cur.matchWord("LEFT")) {
        cur.matchWord("OUTER");
        cur.expectWord("JOIN");
        joinType = "LEFT";
      } else if (cur.matchWord("RIGHT")) {
        cur.matchWord("OUTER");
        cur.expectWord("JOIN");
        joinType = "RIGHT";
      } else if (cur.matchWord("CROSS")) {
        cur.expectWord("JOIN");
        joinType = "CROSS";
      } else if (cur.matchWord("JOIN")) {
        joinType = "INNER";
      }
      if (!joinType) break;

      const ref = parseTableRef(cur);
      ref.joinType = joinType;
      if (cur.matchWord("ON")) {
        ref.on = parseExpression(cur);
      } else if (cur.matchWord("USING")) {
        cur.expectPunct("(");
        const cols: string[] = [];
        do {
          cols.push(cur.parseIdent());
        } while (cur.matchPunct(","));
        cur.expectPunct(")");
        ref.using = cols;
      }
      from.push(ref);
    }
  }

  let where: Expr | undefined;
  if (cur.matchWord("WHERE")) {
    where = parseExpression(cur);
  }

  const groupBy: Expr[] = [];
  if (cur.matchWord("GROUP")) {
    cur.expectWord("BY");
    do {
      groupBy.push(parseExpression(cur));
    } while (cur.matchPunct(","));
  }

  let having: Expr | undefined;
  if (cur.matchWord("HAVING")) {
    having = parseExpression(cur);
  }

  const orderBy: OrderItem[] = [];
  if (cur.matchWord("ORDER")) {
    cur.expectWord("BY");
    do {
      const expr = parseExpression(cur);
      let direction: "ASC" | "DESC" = "ASC";
      if (cur.matchWord("DESC")) direction = "DESC";
      else cur.matchWord("ASC");
      orderBy.push({ expr: expr, direction: direction });
    } while (cur.matchPunct(","));
  }

  let limit: number | undefined;
  let offset: number | undefined;
  if (cur.matchWord("LIMIT")) {
    const firstTok = cur.next();
    if (firstTok.kind !== "number") throw new SqlSyntaxError(firstTok.value);
    const firstNum = Math.max(0, Math.floor(Number(firstTok.value)));
    if (cur.matchPunct(",")) {
      const secondTok = cur.next();
      if (secondTok.kind !== "number") throw new SqlSyntaxError(secondTok.value);
      offset = firstNum;
      limit = Math.max(0, Math.floor(Number(secondTok.value)));
    } else {
      limit = firstNum;
      if (cur.matchWord("OFFSET")) {
        const offTok = cur.next();
        if (offTok.kind !== "number") throw new SqlSyntaxError(offTok.value);
        offset = Math.max(0, Math.floor(Number(offTok.value)));
      }
    }
  }

  let union: { all: boolean; right: SelectStmt } | undefined;
  if (cur.matchWord("UNION")) {
    const all = cur.matchWord("ALL");
    if (!all) cur.matchWord("DISTINCT");
    const right = parseSelectStatement(cur);
    union = { all: all, right: right };
  }

  return {
    kind: "select",
    distinct: distinct,
    items: items,
    from: from,
    where: where,
    groupBy: groupBy,
    having: having,
    orderBy: orderBy,
    limit: limit,
    offset: offset,
    union: union,
  };
}

function parseTableRef(cur: TokenCursor): TableRef {
  const name = cur.parseTableName();
  let alias = name.table;
  if (cur.matchWord("AS")) {
    alias = cur.parseIdent();
  } else {
    const next = cur.peek();
    if (
      next &&
      (next.kind === "ident" || (next.kind === "word" && !isClauseStopWord(next.upper)))
    ) {
      cur.next();
      alias = next.value;
    }
  }
  return { db: name.db, table: name.table, alias: alias };
}

// ============================================================
// EXPRESSION & QUERY EXECUTION
// ============================================================

interface JoinedRow {
  tables: Record<string, Record<string, MysqlValue> | null>;
  tableOrder: string[];
  schemas?: Record<string, MysqlTable>;
}

function isAggregateFuncName(name: string): boolean {
  return ["COUNT", "SUM", "AVG", "MIN", "MAX", "GROUP_CONCAT"].indexOf(name.toUpperCase()) !== -1;
}

function exprContainsAggregate(expr: Expr | undefined): boolean {
  if (!expr) return false;
  switch (expr.type) {
    case "func":
      if (isAggregateFuncName(expr.name)) return true;
      for (let i = 0; i < expr.args.length; i++) {
        if (exprContainsAggregate(expr.args[i])) return true;
      }
      return false;
    case "unary":
      return exprContainsAggregate(expr.arg);
    case "binary":
      return exprContainsAggregate(expr.left) || exprContainsAggregate(expr.right);
    case "isNull":
      return exprContainsAggregate(expr.arg);
    case "between":
      return (
        exprContainsAggregate(expr.arg) ||
        exprContainsAggregate(expr.low) ||
        exprContainsAggregate(expr.high)
      );
    case "inList":
      if (exprContainsAggregate(expr.arg)) return true;
      for (let i = 0; i < expr.items.length; i++) {
        if (exprContainsAggregate(expr.items[i])) return true;
      }
      return false;
    case "like":
      return exprContainsAggregate(expr.arg) || exprContainsAggregate(expr.pattern);
    case "case":
      if (exprContainsAggregate(expr.base) || exprContainsAggregate(expr.elseExpr)) return true;
      for (let i = 0; i < expr.whens.length; i++) {
        if (exprContainsAggregate(expr.whens[i].cond) || exprContainsAggregate(expr.whens[i].result)) {
          return true;
        }
      }
      return false;
    default:
      return false;
  }
}

function toTruthiness(val: MysqlValue): boolean {
  if (val === null || val === undefined || val === false || val === 0 || val === "") return false;
  if (typeof val === "string") {
    const n = Number(val);
    if (!isNaN(n) && val.trim() !== "") return n !== 0;
  }
  return Boolean(val);
}

function compareMysqlValues(a: MysqlValue, b: MysqlValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  const na = typeof a === "number" ? a : typeof a === "boolean" ? (a ? 1 : 0) : Number(a);
  const nb = typeof b === "number" ? b : typeof b === "boolean" ? (b ? 1 : 0) : Number(b);
  const aIsNum = typeof a === "number" || typeof a === "boolean" || (typeof a === "string" && a.trim() !== "" && !isNaN(na));
  const bIsNum = typeof b === "number" || typeof b === "boolean" || (typeof b === "string" && b.trim() !== "" && !isNaN(nb));
  if (aIsNum && bIsNum) {
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function likeToRegex(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      re += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    } else if (ch === "%") {
      re += ".*";
    } else if (ch === "_") {
      re += ".";
    } else {
      re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  re += "$";
  return new RegExp(re, "i");
}

function formatSqlDateNow(dateOnly: boolean): string {
  const d = new Date();
  const pad2 = (n: number) => (n < 10 ? "0" + n : String(n));
  const ymd = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  if (dateOnly) return ymd;
  return ymd + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}

function resolveColumnFromJoinedRow(
  row: JoinedRow,
  tableName: string | undefined,
  colName: string,
  clause: string
): MysqlValue {
  if (tableName) {
    const lowerTbl = tableName.toLowerCase();
    for (let i = 0; i < row.tableOrder.length; i++) {
      const alias = row.tableOrder[i];
      if (alias.toLowerCase() === lowerTbl) {
        const schemaTbl = row.schemas ? row.schemas[alias] : undefined;
        if (schemaTbl && !findColumnDef(schemaTbl, colName)) {
          throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + tableName + "." + colName + "' in '" + clause + "'");
        }
        const tblRow = row.tables[alias];
        if (!tblRow) return null;
        const keys = Object.keys(tblRow);
        for (let k = 0; k < keys.length; k++) {
          if (keys[k].toLowerCase() === colName.toLowerCase()) {
            return tblRow[keys[k]];
          }
        }
        throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + tableName + "." + colName + "' in '" + clause + "'");
      }
    }
    throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + tableName + "." + colName + "' in '" + clause + "'");
  }

  let matchedCount = 0;
  let matchedValue: MysqlValue = null;
  const lowerCol = colName.toLowerCase();

  if (row.schemas) {
    for (let i = 0; i < row.tableOrder.length; i++) {
      const alias = row.tableOrder[i];
      const schemaTbl = row.schemas[alias];
      const colDef = schemaTbl ? findColumnDef(schemaTbl, colName) : null;
      if (colDef) {
        matchedCount++;
        const tblRow = row.tables[alias];
        matchedValue = tblRow ? resolveRowValue(tblRow, colDef.name) : null;
      }
    }
  } else {
    for (let i = 0; i < row.tableOrder.length; i++) {
      const alias = row.tableOrder[i];
      const tblRow = row.tables[alias];
      if (!tblRow) continue;
      const keys = Object.keys(tblRow);
      for (let k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase() === lowerCol) {
          matchedValue = tblRow[keys[k]];
          matchedCount++;
          break;
        }
      }
    }
  }

  if (matchedCount === 0) {
    throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + colName + "' in '" + clause + "'");
  }
  if (matchedCount > 1) {
    throw new MysqlError("ERROR 1052 (23000): Column '" + colName + "' in " + clause + " is ambiguous");
  }
  return matchedValue;
}

function evalScalarExpr(
  session: MysqlSession,
  expr: Expr,
  row: JoinedRow,
  groupRows?: JoinedRow[],
  clause: string = "field list",
  aliasMap?: Record<string, MysqlValue>
): MysqlValue {
  switch (expr.type) {
    case "literal":
      return expr.value;

    case "column": {
      if (!expr.table && aliasMap && Object.prototype.hasOwnProperty.call(aliasMap, expr.name.toLowerCase())) {
        return aliasMap[expr.name.toLowerCase()];
      }
      try {
        return resolveColumnFromJoinedRow(row, expr.table, expr.name, clause);
      } catch (err) {
        if (aliasMap && !expr.table && Object.prototype.hasOwnProperty.call(aliasMap, expr.name.toLowerCase())) {
          return aliasMap[expr.name.toLowerCase()];
        }
        throw err;
      }
    }

    case "unary": {
      const v = evalScalarExpr(session, expr.arg, row, groupRows, clause, aliasMap);
      if (expr.op === "-") {
        if (v === null) return null;
        return -Number(v);
      }
      if (expr.op === "NOT") {
        if (v === null) return null;
        return toTruthiness(v) ? 0 : 1;
      }
      return v;
    }

    case "binary": {
      if (expr.op === "AND") {
        const l = evalScalarExpr(session, expr.left, row, groupRows, clause, aliasMap);
        if (l !== null && !toTruthiness(l)) return 0;
        const r = evalScalarExpr(session, expr.right, row, groupRows, clause, aliasMap);
        if (r !== null && !toTruthiness(r)) return 0;
        if (l === null || r === null) return null;
        return 1;
      }
      if (expr.op === "OR") {
        const l = evalScalarExpr(session, expr.left, row, groupRows, clause, aliasMap);
        if (l !== null && toTruthiness(l)) return 1;
        const r = evalScalarExpr(session, expr.right, row, groupRows, clause, aliasMap);
        if (r !== null && toTruthiness(r)) return 1;
        if (l === null || r === null) return null;
        return 0;
      }

      const l = evalScalarExpr(session, expr.left, row, groupRows, clause, aliasMap);
      const r = evalScalarExpr(session, expr.right, row, groupRows, clause, aliasMap);

      if (expr.op === "<=>") {
        if (l === null && r === null) return 1;
        if (l === null || r === null) return 0;
        return compareMysqlValues(l, r) === 0 ? 1 : 0;
      }
      if (l === null || r === null) return null;

      switch (expr.op) {
        case "=":
          return compareMysqlValues(l, r) === 0 ? 1 : 0;
        case "!=":
        case "<>":
          return compareMysqlValues(l, r) !== 0 ? 1 : 0;
        case "<":
          return compareMysqlValues(l, r) < 0 ? 1 : 0;
        case "<=":
          return compareMysqlValues(l, r) <= 0 ? 1 : 0;
        case ">":
          return compareMysqlValues(l, r) > 0 ? 1 : 0;
        case ">=":
          return compareMysqlValues(l, r) >= 0 ? 1 : 0;
        case "+":
          return Number(l) + Number(r);
        case "-":
          return Number(l) - Number(r);
        case "*":
          return Number(l) * Number(r);
        case "/":
          return Number(r) === 0 ? null : Number(l) / Number(r);
        case "%":
          return Number(r) === 0 ? null : Number(l) % Number(r);
        default:
          return null;
      }
    }

    case "isNull": {
      const v = evalScalarExpr(session, expr.arg, row, groupRows, clause, aliasMap);
      const isN = v === null;
      return expr.not ? (isN ? 0 : 1) : isN ? 1 : 0;
    }

    case "between": {
      const v = evalScalarExpr(session, expr.arg, row, groupRows, clause, aliasMap);
      const lo = evalScalarExpr(session, expr.low, row, groupRows, clause, aliasMap);
      const hi = evalScalarExpr(session, expr.high, row, groupRows, clause, aliasMap);
      if (v === null || lo === null || hi === null) return null;
      const inside = compareMysqlValues(v, lo) >= 0 && compareMysqlValues(v, hi) <= 0;
      return expr.not ? (inside ? 0 : 1) : inside ? 1 : 0;
    }

    case "like": {
      const v = evalScalarExpr(session, expr.arg, row, groupRows, clause, aliasMap);
      const p = evalScalarExpr(session, expr.pattern, row, groupRows, clause, aliasMap);
      if (v === null || p === null) return null;
      const matched = likeToRegex(String(p)).test(String(v));
      return expr.not ? (matched ? 0 : 1) : matched ? 1 : 0;
    }

    case "inList": {
      const v = evalScalarExpr(session, expr.arg, row, groupRows, clause, aliasMap);
      if (v === null) return null;
      let found = false;
      let sawNull = false;
      for (let i = 0; i < expr.items.length; i++) {
        const item = evalScalarExpr(session, expr.items[i], row, groupRows, clause, aliasMap);
        if (item === null) {
          sawNull = true;
        } else if (compareMysqlValues(v, item) === 0) {
          found = true;
          break;
        }
      }
      if (found) return expr.not ? 0 : 1;
      if (sawNull) return null;
      return expr.not ? 1 : 0;
    }

    case "inSubquery": {
      const v = evalScalarExpr(session, expr.arg, row, groupRows, clause, aliasMap);
      if (v === null) return null;
      const res = executeSelectPlan(session, expr.subquery);
      let found = false;
      let sawNull = false;
      for (let i = 0; i < res.rows.length; i++) {
        const cell = res.rows[i][0];
        if (cell === null) sawNull = true;
        else if (compareMysqlValues(v, cell) === 0) {
          found = true;
          break;
        }
      }
      if (found) return expr.not ? 0 : 1;
      if (sawNull) return null;
      return expr.not ? 1 : 0;
    }

    case "exists": {
      const res = executeSelectPlan(session, expr.subquery);
      const has = res.rows.length > 0;
      return expr.not ? (has ? 0 : 1) : has ? 1 : 0;
    }

    case "subquery": {
      const res = executeSelectPlan(session, expr.subquery);
      if (res.rows.length === 0) return null;
      return res.rows[0][0] !== undefined ? res.rows[0][0] : null;
    }

    case "case": {
      const baseVal = expr.base
        ? evalScalarExpr(session, expr.base, row, groupRows, clause, aliasMap)
        : undefined;
      for (let i = 0; i < expr.whens.length; i++) {
        const condVal = evalScalarExpr(session, expr.whens[i].cond, row, groupRows, clause, aliasMap);
        const match = expr.base
          ? baseVal !== null && condVal !== null && compareMysqlValues(baseVal as MysqlValue, condVal) === 0
          : toTruthiness(condVal);
        if (match) {
          return evalScalarExpr(session, expr.whens[i].result, row, groupRows, clause, aliasMap);
        }
      }
      if (expr.elseExpr) {
        return evalScalarExpr(session, expr.elseExpr, row, groupRows, clause, aliasMap);
      }
      return null;
    }

    case "func": {
      const fn = expr.name.toUpperCase();
      if (isAggregateFuncName(fn)) {
        const rowsToAgg = groupRows || [row];
        if (fn === "COUNT") {
          if (expr.star) return rowsToAgg.length;
          const arg = expr.args[0];
          if (!arg) return 0;
          const seen: string[] = [];
          let count = 0;
          for (let i = 0; i < rowsToAgg.length; i++) {
            const val = evalScalarExpr(session, arg, rowsToAgg[i], undefined, clause);
            if (val !== null) {
              if (expr.distinct) {
                const key = typeof val + ":" + String(val);
                if (seen.indexOf(key) === -1) {
                  seen.push(key);
                  count++;
                }
              } else {
                count++;
              }
            }
          }
          return count;
        }
        const arg = expr.args[0];
        if (!arg) return null;
        const vals: MysqlValue[] = [];
        const seenVals: string[] = [];
        for (let i = 0; i < rowsToAgg.length; i++) {
          const v = evalScalarExpr(session, arg, rowsToAgg[i], undefined, clause);
          if (v !== null) {
            if (expr.distinct) {
              const key = typeof v + ":" + String(v);
              if (seenVals.indexOf(key) !== -1) continue;
              seenVals.push(key);
            }
            vals.push(v);
          }
        }
        if (vals.length === 0) return null;
        if (fn === "SUM") {
          let s = 0;
          for (let i = 0; i < vals.length; i++) s += Number(vals[i]);
          return s;
        }
        if (fn === "AVG") {
          let s = 0;
          for (let i = 0; i < vals.length; i++) s += Number(vals[i]);
          return Number((s / vals.length).toFixed(4));
        }
        if (fn === "MIN") {
          let best = vals[0];
          for (let i = 1; i < vals.length; i++) {
            if (compareMysqlValues(vals[i], best) < 0) best = vals[i];
          }
          return best;
        }
        if (fn === "MAX") {
          let best = vals[0];
          for (let i = 1; i < vals.length; i++) {
            if (compareMysqlValues(vals[i], best) > 0) best = vals[i];
          }
          return best;
        }
        if (fn === "GROUP_CONCAT") {
          const strs: string[] = [];
          for (let i = 0; i < vals.length; i++) strs.push(String(vals[i]));
          return strs.join(",");
        }
      }

      // Scalar functions
      const args: MysqlValue[] = [];
      for (let i = 0; i < expr.args.length; i++) {
        args.push(evalScalarExpr(session, expr.args[i], row, groupRows, clause, aliasMap));
      }

      switch (fn) {
        case "VERSION":
          return session.serverVersion;
        case "DATABASE":
        case "SCHEMA":
          return session.currentDb;
        case "USER":
        case "CURRENT_USER":
        case "SESSION_USER":
          return session.user;
        case "CONNECTION_ID":
          return session.connectionId;
        case "NOW":
        case "CURRENT_TIMESTAMP":
          return formatSqlDateNow(false);
        case "CURDATE":
        case "CURRENT_DATE":
          return formatSqlDateNow(true);
        case "COALESCE":
          for (let i = 0; i < args.length; i++) {
            if (args[i] !== null) return args[i];
          }
          return null;
        case "IFNULL":
          return args[0] !== null && args[0] !== undefined ? args[0] : args[1] !== undefined ? args[1] : null;
        case "NULLIF":
          return compareMysqlValues(args[0] ?? null, args[1] ?? null) === 0 ? null : args[0] ?? null;
        case "IF":
          return toTruthiness(args[0] ?? null) ? args[1] ?? null : args[2] ?? null;
        case "CONCAT": {
          let out = "";
          for (let i = 0; i < args.length; i++) {
            if (args[i] === null) return null;
            out += String(args[i]);
          }
          return out;
        }
        case "CONCAT_WS": {
          if (args[0] === null) return null;
          const sep = String(args[0]);
          const parts: string[] = [];
          for (let i = 1; i < args.length; i++) {
            if (args[i] !== null) parts.push(String(args[i]));
          }
          return parts.join(sep);
        }
        case "UPPER":
        case "UCASE":
          return args[0] === null ? null : String(args[0]).toUpperCase();
        case "LOWER":
        case "LCASE":
          return args[0] === null ? null : String(args[0]).toLowerCase();
        case "LENGTH":
        case "CHAR_LENGTH":
          return args[0] === null ? null : String(args[0]).length;
        case "TRIM":
          return args[0] === null ? null : String(args[0]).trim();
        case "LEFT":
          return args[0] === null ? null : String(args[0]).slice(0, Math.max(0, Number(args[1] || 0)));
        case "RIGHT": {
          if (args[0] === null) return null;
          const s = String(args[0]);
          const n = Math.max(0, Number(args[1] || 0));
          return n === 0 ? "" : s.slice(Math.max(0, s.length - n));
        }
        case "SUBSTRING":
        case "SUBSTR": {
          if (args[0] === null) return null;
          const s = String(args[0]);
          const start = Number(args[1] || 1);
          const idx = start > 0 ? start - 1 : Math.max(0, s.length + start);
          if (args.length >= 3 && args[2] !== null) {
            return s.slice(idx, idx + Math.max(0, Number(args[2])));
          }
          return s.slice(idx);
        }
        case "REPLACE":
          if (args[0] === null || args[1] === null || args[2] === null) return null;
          return String(args[0]).split(String(args[1])).join(String(args[2]));
        case "ABS":
          return args[0] === null ? null : Math.abs(Number(args[0]));
        case "FLOOR":
          return args[0] === null ? null : Math.floor(Number(args[0]));
        case "CEIL":
        case "CEILING":
          return args[0] === null ? null : Math.ceil(Number(args[0]));
        case "ROUND": {
          if (args[0] === null) return null;
          const dec = args[1] !== undefined && args[1] !== null ? Math.max(0, Number(args[1])) : 0;
          const factor = Math.pow(10, dec);
          return Math.round(Number(args[0]) * factor) / factor;
        }
        case "YEAR":
          return args[0] === null ? null : Number(String(args[0]).slice(0, 4)) || null;
        case "MONTH":
          return args[0] === null ? null : Number(String(args[0]).slice(5, 7)) || null;
        case "DAY":
          return args[0] === null ? null : Number(String(args[0]).slice(8, 10)) || null;
        default:
          throw new MysqlError("ERROR 1305 (42000): FUNCTION " + fn + " does not exist");
      }
    }
  }
}

function resolveTableFromSession(
  session: MysqlSession,
  dbName: string | undefined,
  tableName: string
): { db: MysqlDatabase; table: MysqlTable } {
  refreshInformationSchema(session);
  let targetDbKey: string | null = null;
  if (dbName) {
    targetDbKey = findDatabaseKey(session.databases, dbName);
    if (!targetDbKey) {
      throw new MysqlError("ERROR 1049 (42000): Unknown database '" + dbName + "'");
    }
  } else {
    if (!session.currentDb) {
      throw new MysqlError("ERROR 1046 (3D000): No database selected");
    }
    targetDbKey = findDatabaseKey(session.databases, session.currentDb);
    if (!targetDbKey) {
      throw new MysqlError("ERROR 1049 (42000): Unknown database '" + session.currentDb + "'");
    }
  }

  const db = session.databases[targetDbKey];
  const tKey = findTableKey(db, tableName);
  if (!tKey) {
    throw new MysqlError("ERROR 1146 (42S02): Table '" + db.name + "." + tableName + "' doesn't exist");
  }
  return { db: db, table: db.tables[tKey] };
}

function buildJoinedRows(session: MysqlSession, from: TableRef[]): {
  rows: JoinedRow[];
  schemas: Record<string, MysqlTable>;
  tableOrder: string[];
} {
  if (from.length === 0) {
    return { rows: [{ tables: {}, tableOrder: [] }], schemas: {}, tableOrder: [] };
  }

  const schemas: Record<string, MysqlTable> = {};
  const tableOrder: string[] = [];

  const firstRef = from[0];
  const firstResolved = resolveTableFromSession(session, firstRef.db, firstRef.table);
  schemas[firstRef.alias] = firstResolved.table;
  tableOrder.push(firstRef.alias);

  let currentRows: JoinedRow[] = [];
  for (let i = 0; i < firstResolved.table.rows.length; i++) {
    const tablesMap: Record<string, Record<string, MysqlValue> | null> = {};
    tablesMap[firstRef.alias] = firstResolved.table.rows[i];
    currentRows.push({ tables: tablesMap, tableOrder: [firstRef.alias], schemas: schemas });
  }

  for (let j = 1; j < from.length; j++) {
    const ref = from[j];
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    if (Object.prototype.hasOwnProperty.call(schemas, ref.alias)) {
      throw new MysqlError("ERROR 1066 (42000): Not unique table/alias: '" + ref.alias + "'");
    }
    schemas[ref.alias] = resolved.table;
    const nextOrder = tableOrder.concat([ref.alias]);
    tableOrder.push(ref.alias);

    const rightRows = resolved.table.rows;
    const nextJoined: JoinedRow[] = [];
    const jType = ref.joinType || "INNER";

    const matchesJoinCond = (combined: JoinedRow, rightRow: Record<string, MysqlValue>): boolean => {
      if (ref.on) {
        return toTruthiness(evalScalarExpr(session, ref.on, combined, undefined, "on clause"));
      }
      if (ref.using && ref.using.length > 0) {
        for (let u = 0; u < ref.using.length; u++) {
          const col = ref.using[u];
          const rightVal = resolveRowValue(rightRow, col);
          let leftVal: MysqlValue = null;
          let found = false;
          for (let prev = 0; prev < combined.tableOrder.length - 1; prev++) {
            const prevAlias = combined.tableOrder[prev];
            const prevRow = combined.tables[prevAlias];
            if (prevRow && findColumnDef(schemas[prevAlias], col)) {
              leftVal = resolveRowValue(prevRow, col);
              found = true;
              break;
            }
          }
          if (!found || leftVal === null || rightVal === null || compareMysqlValues(leftVal, rightVal) !== 0) {
            return false;
          }
        }
        return true;
      }
      return true;
    };

    if (jType === "RIGHT") {
      for (let r = 0; r < rightRows.length; r++) {
        let matched = false;
        for (let l = 0; l < currentRows.length; l++) {
          const tablesMap: Record<string, Record<string, MysqlValue> | null> = {};
          const prevKeys = Object.keys(currentRows[l].tables);
          for (let k = 0; k < prevKeys.length; k++) {
            tablesMap[prevKeys[k]] = currentRows[l].tables[prevKeys[k]];
          }
          tablesMap[ref.alias] = rightRows[r];
          const combined: JoinedRow = { tables: tablesMap, tableOrder: nextOrder, schemas: schemas };
          if (matchesJoinCond(combined, rightRows[r])) {
            nextJoined.push(combined);
            matched = true;
          }
        }
        if (!matched) {
          const tablesMap: Record<string, Record<string, MysqlValue> | null> = {};
          for (let p = 0; p < nextOrder.length - 1; p++) {
            tablesMap[nextOrder[p]] = null;
          }
          tablesMap[ref.alias] = rightRows[r];
          nextJoined.push({ tables: tablesMap, tableOrder: nextOrder, schemas: schemas });
        }
      }
    } else {
      for (let l = 0; l < currentRows.length; l++) {
        let matched = false;
        for (let r = 0; r < rightRows.length; r++) {
          const tablesMap: Record<string, Record<string, MysqlValue> | null> = {};
          const prevKeys = Object.keys(currentRows[l].tables);
          for (let k = 0; k < prevKeys.length; k++) {
            tablesMap[prevKeys[k]] = currentRows[l].tables[prevKeys[k]];
          }
          tablesMap[ref.alias] = rightRows[r];
          const combined: JoinedRow = { tables: tablesMap, tableOrder: nextOrder, schemas: schemas };
          if (matchesJoinCond(combined, rightRows[r])) {
            nextJoined.push(combined);
            matched = true;
          }
        }
        if (!matched && jType === "LEFT") {
          const tablesMap: Record<string, Record<string, MysqlValue> | null> = {};
          const prevKeys = Object.keys(currentRows[l].tables);
          for (let k = 0; k < prevKeys.length; k++) {
            tablesMap[prevKeys[k]] = currentRows[l].tables[prevKeys[k]];
          }
          tablesMap[ref.alias] = null;
          nextJoined.push({ tables: tablesMap, tableOrder: nextOrder, schemas: schemas });
        }
      }
    }

    currentRows = nextJoined;
  }

  return { rows: currentRows, schemas: schemas, tableOrder: tableOrder };
}

function inferExprNumeric(expr: Expr, schemas: Record<string, MysqlTable>): boolean {
  switch (expr.type) {
    case "literal":
      return typeof expr.value === "number";
    case "unary":
      return expr.op === "-" || expr.op === "NOT";
    case "binary":
    case "isNull":
    case "between":
    case "like":
    case "inList":
    case "inSubquery":
    case "exists":
      return true;
    case "case": {
      if (expr.elseExpr && inferExprNumeric(expr.elseExpr, schemas)) return true;
      for (let i = 0; i < expr.whens.length; i++) {
        if (inferExprNumeric(expr.whens[i].result, schemas)) return true;
      }
      return false;
    }
    case "func": {
      const fn = expr.name.toUpperCase();
      if (
        [
          "COUNT",
          "SUM",
          "AVG",
          "LENGTH",
          "CHAR_LENGTH",
          "ROUND",
          "FLOOR",
          "CEIL",
          "CEILING",
          "ABS",
          "CONNECTION_ID",
          "YEAR",
          "MONTH",
          "DAY",
        ].indexOf(fn) !== -1
      ) {
        return true;
      }
      if ((fn === "MIN" || fn === "MAX" || fn === "COALESCE" || fn === "IFNULL") && expr.args[0]) {
        return inferExprNumeric(expr.args[0], schemas);
      }
      if (fn === "IF" && expr.args[1]) {
        return inferExprNumeric(expr.args[1], schemas);
      }
      return false;
    }
    case "column": {
      if (expr.table) {
        const keys = Object.keys(schemas);
        for (let i = 0; i < keys.length; i++) {
          if (keys[i].toLowerCase() === expr.table.toLowerCase()) {
            const col = findColumnDef(schemas[keys[i]], expr.name);
            if (col) return isNumericTypeName(col.type);
          }
        }
      } else {
        const keys = Object.keys(schemas);
        for (let i = 0; i < keys.length; i++) {
          const col = findColumnDef(schemas[keys[i]], expr.name);
          if (col) return isNumericTypeName(col.type);
        }
      }
      return false;
    }
    default:
      return false;
  }
}

function inferExprNullable(
  expr: Expr,
  schemas: Record<string, MysqlTable>,
  from: TableRef[]
): boolean {
  const hasOuterJoin = from.some((f) => f.joinType === "LEFT" || f.joinType === "RIGHT");
  if (hasOuterJoin) return true;
  if (expr.type === "literal") return expr.value === null;
  if (expr.type === "column") {
    const keys = Object.keys(schemas);
    for (let i = 0; i < keys.length; i++) {
      if (expr.table && keys[i].toLowerCase() !== expr.table.toLowerCase()) continue;
      const col = findColumnDef(schemas[keys[i]], expr.name);
      if (col) return col.nullable;
    }
    return true;
  }
  return false;
}

function defaultHeaderName(item: SelectItem): string {
  if (item.alias) return item.alias;
  if (item.expr && item.expr.type === "column") return item.expr.name;
  return item.rawText || "column";
}

function executeSelectPlan(
  session: MysqlSession,
  stmt: SelectStmt
): { columns: string[]; rows: MysqlValue[][]; numericCols: boolean[]; nullableCols: boolean[] } {
  const joined = buildJoinedRows(session, stmt.from);

  // Filter WHERE
  let filtered = joined.rows;
  if (stmt.where) {
    const next: JoinedRow[] = [];
    for (let i = 0; i < filtered.length; i++) {
      if (toTruthiness(evalScalarExpr(session, stmt.where, filtered[i], undefined, "where clause"))) {
        next.push(filtered[i]);
      }
    }
    filtered = next;
  }

  // Determine whether aggregation applies
  let hasAgg = false;
  for (let i = 0; i < stmt.items.length; i++) {
    if (exprContainsAggregate(stmt.items[i].expr)) {
      hasAgg = true;
      break;
    }
  }
  if (!hasAgg && exprContainsAggregate(stmt.having)) hasAgg = true;
  for (let i = 0; i < stmt.orderBy.length; i++) {
    if (exprContainsAggregate(stmt.orderBy[i].expr)) hasAgg = true;
  }

  const columns: string[] = [];
  const numericCols: boolean[] = [];
  const nullableCols: boolean[] = [];

  // Expand * items for column headers
  interface ExpandedCol {
    header: string;
    numeric: boolean;
    nullable: boolean;
    evalFn: (repRow: JoinedRow, grpRows?: JoinedRow[]) => MysqlValue;
    rawExpr?: Expr;
    alias?: string;
  }
  const expanded: ExpandedCol[] = [];

  for (let i = 0; i < stmt.items.length; i++) {
    const item = stmt.items[i];
    if (item.star) {
      if (joined.tableOrder.length === 0) {
        throw new MysqlError("ERROR 1096 (HY000): No tables used");
      }
      const targetAliases = item.starTable ? [item.starTable] : joined.tableOrder;
      for (let a = 0; a < targetAliases.length; a++) {
        let matchedAlias: string | null = null;
        for (let k = 0; k < joined.tableOrder.length; k++) {
          if (joined.tableOrder[k].toLowerCase() === targetAliases[a].toLowerCase()) {
            matchedAlias = joined.tableOrder[k];
            break;
          }
        }
        if (!matchedAlias) {
          throw new MysqlError("ERROR 1051 (42S02): Unknown table '" + targetAliases[a] + "'");
        }
        const tbl = joined.schemas[matchedAlias];
        const hasOuter = stmt.from.some((f) => f.joinType === "LEFT" || f.joinType === "RIGHT");
        for (let c = 0; c < tbl.columns.length; c++) {
          const colDef = tbl.columns[c];
          const aliasCap = matchedAlias;
          const colCap = colDef.name;
          expanded.push({
            header: colDef.name,
            numeric: isNumericTypeName(colDef.type),
            nullable: colDef.nullable || hasOuter,
            evalFn: (repRow: JoinedRow) => {
              const r = repRow.tables[aliasCap];
              return r ? resolveRowValue(r, colCap) : null;
            },
          });
        }
      }
    } else if (item.expr) {
      const exprCap = item.expr;
      const hdr = defaultHeaderName(item);
      expanded.push({
        header: hdr,
        numeric: inferExprNumeric(exprCap, joined.schemas),
        nullable: inferExprNullable(exprCap, joined.schemas, stmt.from),
        evalFn: (repRow: JoinedRow, grpRows?: JoinedRow[]) =>
          evalScalarExpr(session, exprCap, repRow, grpRows, "field list"),
        rawExpr: exprCap,
        alias: item.alias,
      });
    }
  }

  for (let i = 0; i < expanded.length; i++) {
    columns.push(expanded[i].header);
    numericCols.push(expanded[i].numeric);
    nullableCols.push(expanded[i].nullable);
  }

  // Group rows
  interface GroupBucket {
    repRow: JoinedRow;
    rows: JoinedRow[];
  }
  const buckets: GroupBucket[] = [];

  if (stmt.groupBy.length > 0) {
    const keyMap: Record<string, GroupBucket> = {};
    const keyOrder: string[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const parts: string[] = [];
      for (let g = 0; g < stmt.groupBy.length; g++) {
        const gv = evalScalarExpr(session, stmt.groupBy[g], r, undefined, "group statement");
        parts.push(gv === null ? "__NULL__" : typeof gv + ":" + String(gv));
      }
      const key = parts.join("\u0001");
      if (!Object.prototype.hasOwnProperty.call(keyMap, key)) {
        const b: GroupBucket = { repRow: r, rows: [r] };
        keyMap[key] = b;
        keyOrder.push(key);
      } else {
        keyMap[key].rows.push(r);
      }
    }
    for (let k = 0; k < keyOrder.length; k++) {
      buckets.push(keyMap[keyOrder[k]]);
    }
  } else if (hasAgg) {
    buckets.push({
      repRow: filtered[0] || { tables: {}, tableOrder: joined.tableOrder, schemas: joined.schemas },
      rows: filtered,
    });
  } else {
    for (let i = 0; i < filtered.length; i++) {
      buckets.push({ repRow: filtered[i], rows: [filtered[i]] });
    }
  }

  // Filter HAVING
  let postHaving = buckets;
  if (stmt.having) {
    const nextBuckets: GroupBucket[] = [];
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      const aliasMap: Record<string, MysqlValue> = {};
      for (let c = 0; c < expanded.length; c++) {
        const val = expanded[c].evalFn(b.repRow, b.rows);
        aliasMap[expanded[c].header.toLowerCase()] = val;
      }
      if (toTruthiness(evalScalarExpr(session, stmt.having, b.repRow, b.rows, "having clause", aliasMap))) {
        nextBuckets.push(b);
      }
    }
    postHaving = nextBuckets;
  }

  // Project + capture sort keys
  interface ProjectedRecord {
    values: MysqlValue[];
    sortKeys: MysqlValue[];
  }
  const records: ProjectedRecord[] = [];
  for (let i = 0; i < postHaving.length; i++) {
    const b = postHaving[i];
    const rowVals: MysqlValue[] = [];
    const aliasMap: Record<string, MysqlValue> = {};
    for (let c = 0; c < expanded.length; c++) {
      const v = expanded[c].evalFn(b.repRow, b.rows);
      rowVals.push(v);
      aliasMap[expanded[c].header.toLowerCase()] = v;
    }

    const sortKeys: MysqlValue[] = [];
    for (let o = 0; o < stmt.orderBy.length; o++) {
      const ordExpr = stmt.orderBy[o].expr;
      if (ordExpr.type === "literal" && typeof ordExpr.value === "number") {
        const idx = Math.floor(ordExpr.value) - 1;
        if (idx >= 0 && idx < rowVals.length) {
          sortKeys.push(rowVals[idx]);
          continue;
        }
      }
      sortKeys.push(evalScalarExpr(session, ordExpr, b.repRow, b.rows, "order clause", aliasMap));
    }
    records.push({ values: rowVals, sortKeys: sortKeys });
  }

  // Apply DISTINCT before ORDER BY/LIMIT
  let finalRecords = records;
  if (stmt.distinct) {
    const seenKeys: Record<string, boolean> = {};
    const deduped: ProjectedRecord[] = [];
    for (let i = 0; i < finalRecords.length; i++) {
      const sigParts: string[] = [];
      for (let c = 0; c < finalRecords[i].values.length; c++) {
        const v = finalRecords[i].values[c];
        sigParts.push(v === null ? "__NULL__" : typeof v + ":" + String(v));
      }
      const sig = sigParts.join("\u0001");
      if (!seenKeys[sig]) {
        seenKeys[sig] = true;
        deduped.push(finalRecords[i]);
      }
    }
    finalRecords = deduped;
  }

  // Apply ORDER BY
  if (stmt.orderBy.length > 0) {
    finalRecords = finalRecords.slice().sort((a, b) => {
      for (let o = 0; o < stmt.orderBy.length; o++) {
        const cmp = compareMysqlValues(a.sortKeys[o], b.sortKeys[o]);
        if (cmp !== 0) {
          return stmt.orderBy[o].direction === "DESC" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  // Apply LIMIT / OFFSET
  if (stmt.offset !== undefined || stmt.limit !== undefined) {
    const start = stmt.offset || 0;
    const end = stmt.limit !== undefined ? start + stmt.limit : finalRecords.length;
    finalRecords = finalRecords.slice(start, end);
  }

  let finalRows: MysqlValue[][] = [];
  for (let i = 0; i < finalRecords.length; i++) {
    finalRows.push(finalRecords[i].values);
  }

  // UNION
  if (stmt.union) {
    const rightRes = executeSelectPlan(session, stmt.union.right);
    if (rightRes.columns.length !== columns.length) {
      throw new MysqlError("ERROR 1222 (21000): The used SELECT statements have a different number of columns");
    }
    const combined = finalRows.concat(rightRes.rows);
    if (!stmt.union.all) {
      const seen: Record<string, boolean> = {};
      const deduped: MysqlValue[][] = [];
      for (let i = 0; i < combined.length; i++) {
        const sig = combined[i].map((v) => (v === null ? "__NULL__" : String(v))).join("\u0001");
        if (!seen[sig]) {
          seen[sig] = true;
          deduped.push(combined[i]);
        }
      }
      finalRows = deduped;
    } else {
      finalRows = combined;
    }
  }

  return { columns: columns, rows: finalRows, numericCols: numericCols, nullableCols: nullableCols };
}

// ============================================================
// DDL / DML EXECUTORS
// ============================================================

function parseColumnDefinition(cur: TokenCursor): {
  col?: MysqlColumnDef;
  tablePrimaryKeys?: string[];
  tableUniqueKeys?: string[];
  tableForeignKeys?: string[];
} {
  if (cur.matchWord("CONSTRAINT")) {
    cur.parseIdent();
  }
  if (cur.matchWord("PRIMARY")) {
    cur.expectWord("KEY");
    cur.expectPunct("(");
    const cols: string[] = [];
    do {
      cols.push(cur.parseIdent());
    } while (cur.matchPunct(","));
    cur.expectPunct(")");
    return { tablePrimaryKeys: cols };
  }
  if (cur.matchWord("UNIQUE")) {
    cur.matchWord("KEY") || cur.matchWord("INDEX");
    if (!cur.matchPunct("(")) {
      cur.parseIdent();
      cur.expectPunct("(");
    }
    const cols: string[] = [];
    do {
      cols.push(cur.parseIdent());
    } while (cur.matchPunct(","));
    cur.expectPunct(")");
    return { tableUniqueKeys: cols };
  }
  if (cur.matchWord("FOREIGN")) {
    cur.expectWord("KEY");
    cur.expectPunct("(");
    const fkCols: string[] = [];
    while (!cur.eof() && !cur.matchPunct(")")) {
      const tk = cur.next();
      if (tk.kind === "word" || tk.kind === "ident") fkCols.push(tk.value);
    }
    cur.expectWord("REFERENCES");
    cur.parseTableName();
    cur.expectPunct("(");
    while (!cur.eof() && !cur.matchPunct(")")) cur.next();
    while (!cur.eof()) {
      const t = cur.peek();
      if (!t || (t.kind === "punct" && (t.value === "," || t.value === ")"))) break;
      cur.next();
    }
    return { tableForeignKeys: fkCols };
  }
  if (cur.matchWord("CHECK")) {
    cur.expectPunct("(");
    let depth = 1;
    while (!cur.eof() && depth > 0) {
      if (cur.matchPunct("(")) depth++;
      else if (cur.matchPunct(")")) depth--;
      else cur.next();
    }
    return {};
  }

  const colName = cur.parseIdent();
  const baseType = cur.parseIdent().toLowerCase();
  let fullType = baseType;
  if (cur.matchPunct("(")) {
    const args: string[] = [];
    while (!cur.eof() && !cur.matchPunct(")")) {
      args.push(cur.next().value);
    }
    fullType += "(" + args.join("") + ")";
  }
  if (cur.matchWord("UNSIGNED")) {
    fullType += " unsigned";
  }

  let nullable = true;
  let key: "PRI" | "UNI" | "MUL" | "" = "";
  let defaultValue: MysqlValue = null;
  let extra = "";
  let autoIncrement = false;

  while (!cur.eof()) {
    const t = cur.peek();
    if (!t || (t.kind === "punct" && (t.value === "," || t.value === ")"))) break;
    if (cur.matchWord("NOT")) {
      cur.expectWord("NULL");
      nullable = false;
    } else if (cur.matchWord("NULL")) {
      nullable = true;
    } else if (cur.matchWord("PRIMARY")) {
      cur.expectWord("KEY");
      key = "PRI";
      nullable = false;
    } else if (cur.matchWord("UNIQUE")) {
      cur.matchWord("KEY");
      if (!key) key = "UNI";
    } else if (cur.matchWord("AUTO_INCREMENT")) {
      autoIncrement = true;
      extra = "auto_increment";
    } else if (cur.matchWord("DEFAULT")) {
      if (cur.matchWord("NULL")) defaultValue = null;
      else if (cur.matchWord("CURRENT_TIMESTAMP")) defaultValue = formatSqlDateNow(false);
      else if (cur.matchWord("TRUE")) defaultValue = 1;
      else if (cur.matchWord("FALSE")) defaultValue = 0;
      else if (cur.matchOp("-")) {
        const num = cur.next();
        defaultValue = -Number(num.value);
      } else {
        const lit = cur.next();
        defaultValue = lit.kind === "number" ? Number(lit.value) : lit.value;
      }
    } else if (cur.matchWord("REFERENCES")) {
      cur.parseTableName();
      if (cur.matchPunct("(")) {
        while (!cur.eof() && !cur.matchPunct(")")) cur.next();
      }
    } else if (cur.matchWord("CHECK")) {
      cur.expectPunct("(");
      let depth = 1;
      while (!cur.eof() && depth > 0) {
        if (cur.matchPunct("(")) depth++;
        else if (cur.matchPunct(")")) depth--;
        else cur.next();
      }
    } else if (cur.matchWord("ON")) {
      cur.next();
      cur.next();
    } else {
      cur.next();
    }
  }

  return {
    col: {
      name: colName,
      type: fullType,
      nullable: nullable,
      key: key,
      defaultValue: defaultValue,
      extra: extra,
      autoIncrement: autoIncrement,
    },
  };
}

function coerceSqlValue(val: MysqlValue, col: MysqlColumnDef): MysqlValue {
  if (val === null) return null;
  if (isNumericTypeName(col.type)) {
    if (typeof val === "number") return val;
    if (typeof val === "boolean") return val ? 1 : 0;
    const n = Number(val);
    if (!isNaN(n) && String(val).trim() !== "") return n;
    throw new MysqlError("ERROR 1366 (HY000): Incorrect integer/decimal value: '" + String(val) + "' for column '" + col.name + "'");
  }
  return String(val);
}

function validateAndInsertRow(table: MysqlTable, rowDraft: Record<string, MysqlValue>): void {
  const newRow: Record<string, MysqlValue> = {};

  for (let i = 0; i < table.columns.length; i++) {
    const col = table.columns[i];
    let val: MysqlValue = Object.prototype.hasOwnProperty.call(rowDraft, col.name)
      ? rowDraft[col.name]
      : col.defaultValue;

    if (col.autoIncrement && (val === null || val === undefined || val === 0)) {
      val = table.nextAutoIncrement;
      table.nextAutoIncrement++;
    } else if (col.autoIncrement && typeof val === "number" && val >= table.nextAutoIncrement) {
      table.nextAutoIncrement = val + 1;
    }

    val = coerceSqlValue(val, col);
    if (val === null && !col.nullable) {
      throw new MysqlError("ERROR 1048 (23000): Column '" + col.name + "' cannot be null");
    }

    if ((col.key === "PRI" || col.key === "UNI") && val !== null) {
      for (let r = 0; r < table.rows.length; r++) {
        const existing = table.rows[r][col.name];
        if (existing !== null && compareMysqlValues(existing, val) === 0) {
          const keyLabel = col.key === "PRI" ? table.name + ".PRIMARY" : table.name + "." + col.name;
          throw new MysqlError("ERROR 1062 (23000): Duplicate entry '" + String(val) + "' for key '" + keyLabel + "'");
        }
      }
    }

    newRow[col.name] = val;
  }

  table.rows.push(newRow);
}

function buildCreateTableSql(table: MysqlTable): string {
  const lines: string[] = [];
  const priCols: string[] = [];
  const uniCols: string[] = [];

  for (let i = 0; i < table.columns.length; i++) {
    const c = table.columns[i];
    let line = "  `" + c.name + "` " + c.type;
    if (!c.nullable) line += " NOT NULL";
    if (c.autoIncrement) line += " AUTO_INCREMENT";
    else if (c.defaultValue !== null) {
      line +=
        " DEFAULT " +
        (typeof c.defaultValue === "number" ? String(c.defaultValue) : "'" + String(c.defaultValue) + "'");
    } else if (c.nullable) {
      line += " DEFAULT NULL";
    }
    lines.push(line);
    if (c.key === "PRI") priCols.push("`" + c.name + "`");
    if (c.key === "UNI") uniCols.push(c.name);
  }

  if (priCols.length > 0) {
    lines.push("  PRIMARY KEY (" + priCols.join(",") + ")");
  }
  for (let i = 0; i < uniCols.length; i++) {
    lines.push("  UNIQUE KEY `" + uniCols[i] + "` (`" + uniCols[i] + "`)");
  }

  return (
    "CREATE TABLE `" +
    table.name +
    "` (\n" +
    lines.join(",\n") +
    "\n) ENGINE=" +
    table.engine +
    " AUTO_INCREMENT=" +
    table.nextAutoIncrement +
    " DEFAULT CHARSET=" +
    table.charset
  );
}

function executeSingleSqlStatement(
  session: MysqlSession,
  rawSql: string,
  vertical: boolean
): MysqlOutputBlock {
  const trimmed = rawSql.trim();
  if (!trimmed) {
    return { kind: "text", text: "" };
  }

  session.questions++;
  const tokens = tokenizeSql(trimmed);
  if (tokens.length === 0) {
    return { kind: "text", text: "" };
  }

  const cur = new TokenCursor(tokens, trimmed);
  const first = cur.peek()!;

  const renderResult = (
    columns: string[],
    rows: MysqlValue[][],
    numericCols: boolean[],
    nullableCols?: boolean[]
  ): MysqlOutputBlock => {
    if (rows.length === 0) {
      return { kind: "text", text: "Empty set (0.00 sec)" };
    }
    if (vertical) {
      return {
        kind: "vertical",
        text: formatVerticalRows(columns, rows) + "\n" + formatRowCountLabel(rows.length) + " in set " + formatTiming(0),
      };
    }
    return {
      kind: "table",
      text:
        formatAsciiTable(columns, rows, numericCols, nullableCols) +
        "\n" +
        formatRowCountLabel(rows.length) +
        " in set " +
        formatTiming(0),
    };
  };

  // SELECT or parenthesized SELECT
  if (first.kind === "word" && first.upper === "SELECT") {
    const stmt = parseSelectStatement(cur);
    if (!cur.eof()) throw new SqlSyntaxError(cur.nearHere());
    const res = executeSelectPlan(session, stmt);
    return renderResult(res.columns, res.rows, res.numericCols, res.nullableCols);
  }

  // USE <db>
  if (cur.matchWord("USE")) {
    const dbName = cur.parseIdent();
    const key = findDatabaseKey(session.databases, dbName);
    if (!key) {
      throw new MysqlError("ERROR 1049 (42000): Unknown database '" + dbName + "'");
    }
    session.currentDb = key;
    return { kind: "text", text: "Database changed" };
  }

  // SHOW ...
  if (cur.matchWord("SHOW")) {
    if (cur.matchWord("DATABASES") || cur.matchWord("SCHEMAS")) {
      let likePattern: string | null = null;
      if (cur.matchWord("LIKE")) {
        const pTok = cur.next();
        likePattern = pTok.value;
      }
      const names = Object.keys(session.databases).sort();
      const rows: MysqlValue[][] = [];
      const re = likePattern !== null ? likeToRegex(likePattern) : null;
      for (let i = 0; i < names.length; i++) {
        if (!re || re.test(names[i])) {
          rows.push([names[i]]);
        }
      }
      return renderResult(["Database"], rows, [false]);
    }

    const fullTables = cur.matchWord("FULL");
    if (cur.matchWord("TABLES")) {
      let targetDbName = session.currentDb;
      if (cur.matchWord("FROM") || cur.matchWord("IN")) {
        targetDbName = cur.parseIdent();
      }
      if (!targetDbName) {
        throw new MysqlError("ERROR 1046 (3D000): No database selected");
      }
      const dbKey = findDatabaseKey(session.databases, targetDbName);
      if (!dbKey) {
        throw new MysqlError("ERROR 1049 (42000): Unknown database '" + targetDbName + "'");
      }
      let likePattern: string | null = null;
      if (cur.matchWord("LIKE")) {
        likePattern = cur.next().value;
      }
      const db = session.databases[dbKey];
      const tNames = Object.keys(db.tables).sort();
      const re = likePattern !== null ? likeToRegex(likePattern) : null;
      const rows: MysqlValue[][] = [];
      for (let i = 0; i < tNames.length; i++) {
        if (!re || re.test(tNames[i])) {
          if (fullTables) {
            rows.push([tNames[i], db.name === "information_schema" ? "SYSTEM VIEW" : "BASE TABLE"]);
          } else {
            rows.push([tNames[i]]);
          }
        }
      }
      const headers = fullTables ? ["Tables_in_" + db.name, "Table_type"] : ["Tables_in_" + db.name];
      return renderResult(headers, rows, fullTables ? [false, false] : [false]);
    }

    if (cur.matchWord("COLUMNS")) {
      cur.expectWord("FROM");
      const ref = cur.parseTableName();
      let dbOverride = ref.db;
      if (!dbOverride && (cur.matchWord("FROM") || cur.matchWord("IN"))) {
        dbOverride = cur.parseIdent();
      }
      const resolved = resolveTableFromSession(session, dbOverride, ref.table);
      const rows: MysqlValue[][] = resolved.table.columns.map((c) => [
        c.name,
        c.type,
        c.nullable ? "YES" : "NO",
        c.key,
        c.defaultValue,
        c.extra,
      ]);
      return renderResult(["Field", "Type", "Null", "Key", "Default", "Extra"], rows, [false, false, false, false, false, false]);
    }

    if (cur.matchWord("CREATE")) {
      if (cur.matchWord("TABLE")) {
        const ref = cur.parseTableName();
        const resolved = resolveTableFromSession(session, ref.db, ref.table);
        return renderResult(
          ["Table", "Create Table"],
          [[resolved.table.name, buildCreateTableSql(resolved.table)]],
          [false, false]
        );
      }
      if (cur.matchWord("DATABASE") || cur.matchWord("SCHEMA")) {
        const dbName = cur.parseIdent();
        const key = findDatabaseKey(session.databases, dbName);
        if (!key) throw new MysqlError("ERROR 1049 (42000): Unknown database '" + dbName + "'");
        return renderResult(
          ["Database", "Create Database"],
          [[key, "CREATE DATABASE `" + key + "` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */"]],
          [false, false]
        );
      }
    }

    if (cur.matchWord("WARNINGS")) {
      const rows: MysqlValue[][] = session.lastWarnings.map((w) => [w.level, w.code, w.message]);
      return renderResult(["Level", "Code", "Message"], rows, [false, true, false]);
    }

    if (cur.matchWord("ERRORS")) {
      return renderResult(["Level", "Code", "Message"], [], [false, true, false]);
    }

    if (cur.matchWord("INDEX") || cur.matchWord("INDEXES") || cur.matchWord("KEYS")) {
      cur.expectWord("FROM");
      const ref = cur.parseTableName();
      const resolved = resolveTableFromSession(session, ref.db, ref.table);
      const rows: MysqlValue[][] = [];
      for (let i = 0; i < resolved.table.columns.length; i++) {
        const c = resolved.table.columns[i];
        if (c.key === "PRI" || c.key === "UNI" || c.key === "MUL") {
          rows.push([
            resolved.table.name,
            c.key === "MUL" ? 1 : 0,
            c.key === "PRI" ? "PRIMARY" : c.name,
            1,
            c.name,
            "A",
            resolved.table.rows.length,
            "BTREE",
          ]);
        }
      }
      return renderResult(
        ["Table", "Non_unique", "Key_name", "Seq_in_index", "Column_name", "Collation", "Cardinality", "Index_type"],
        rows,
        [false, true, false, true, false, false, true, false]
      );
    }

    if (cur.matchWord("VARIABLES") || cur.matchWord("STATUS")) {
      const rows: MysqlValue[][] = [
        ["version", session.serverVersion],
        ["version_comment", "MySQL Community Server - GPL"],
        ["character_set_server", "utf8mb4"],
        ["collation_server", "utf8mb4_0900_ai_ci"],
        ["port", 3306],
      ];
      return renderResult(["Variable_name", "Value"], rows, [false, false]);
    }

    throw new SqlSyntaxError(cur.nearHere());
  }

  // DESCRIBE / DESC / EXPLAIN <table>
  if (cur.matchWord("DESCRIBE") || cur.matchWord("DESC") || cur.matchWord("EXPLAIN")) {
    if (cur.isWord("SELECT")) {
      return renderResult(
        ["id", "select_type", "table", "type", "possible_keys", "key", "rows", "Extra"],
        [[1, "SIMPLE", null, "ALL", null, null, 1, null]],
        [true, false, false, false, false, false, true, false]
      );
    }
    const ref = cur.parseTableName();
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    const rows: MysqlValue[][] = resolved.table.columns.map((c) => [
      c.name,
      c.type,
      c.nullable ? "YES" : "NO",
      c.key,
      c.defaultValue,
      c.extra,
    ]);
    return renderResult(["Field", "Type", "Null", "Key", "Default", "Extra"], rows, [false, false, false, false, false, false]);
  }

  // CREATE DATABASE / TABLE
  if (cur.matchWord("CREATE")) {
    if (cur.matchWord("DATABASE") || cur.matchWord("SCHEMA")) {
      let ifNotExists = false;
      if (cur.matchWord("IF")) {
        cur.expectWord("NOT");
        cur.expectWord("EXISTS");
        ifNotExists = true;
      }
      const dbName = cur.parseIdent();
      const existing = findDatabaseKey(session.databases, dbName);
      if (existing) {
        if (ifNotExists) {
          return { kind: "text", text: "Query OK, 1 row affected, 1 warning (0.00 sec)" };
        }
        throw new MysqlError("ERROR 1007 (HY000): Can't create database '" + dbName + "'; database exists");
      }
      session.databases[dbName] = { name: dbName, tables: {} };
      return { kind: "text", text: "Query OK, 1 row affected (0.01 sec)" };
    }

    if (cur.matchWord("TABLE")) {
      let ifNotExists = false;
      if (cur.matchWord("IF")) {
        cur.expectWord("NOT");
        cur.expectWord("EXISTS");
        ifNotExists = true;
      }
      const ref = cur.parseTableName();
      const dbName = ref.db || session.currentDb;
      if (!dbName) throw new MysqlError("ERROR 1046 (3D000): No database selected");
      const dbKey = findDatabaseKey(session.databases, dbName);
      if (!dbKey) throw new MysqlError("ERROR 1049 (42000): Unknown database '" + dbName + "'");
      const db = session.databases[dbKey];
      const existingTbl = findTableKey(db, ref.table);

      cur.expectPunct("(");
      const cols: MysqlColumnDef[] = [];
      const priKeys: string[] = [];
      const uniKeys: string[] = [];
      const fkKeys: string[] = [];
      do {
        const parsed = parseColumnDefinition(cur);
        if (parsed.col) cols.push(parsed.col);
        if (parsed.tablePrimaryKeys) {
          for (let i = 0; i < parsed.tablePrimaryKeys.length; i++) priKeys.push(parsed.tablePrimaryKeys[i]);
        }
        if (parsed.tableUniqueKeys) {
          for (let i = 0; i < parsed.tableUniqueKeys.length; i++) uniKeys.push(parsed.tableUniqueKeys[i]);
        }
        if (parsed.tableForeignKeys) {
          for (let i = 0; i < parsed.tableForeignKeys.length; i++) fkKeys.push(parsed.tableForeignKeys[i]);
        }
      } while (cur.matchPunct(","));
      cur.expectPunct(")");

      // Apply table-level constraints
      for (let i = 0; i < priKeys.length; i++) {
        for (let c = 0; c < cols.length; c++) {
          if (cols[c].name.toLowerCase() === priKeys[i].toLowerCase()) {
            cols[c].key = "PRI";
            cols[c].nullable = false;
          }
        }
      }
      for (let i = 0; i < uniKeys.length; i++) {
        for (let c = 0; c < cols.length; c++) {
          if (cols[c].name.toLowerCase() === uniKeys[i].toLowerCase() && !cols[c].key) {
            cols[c].key = "UNI";
          }
        }
      }
      for (let i = 0; i < fkKeys.length; i++) {
        for (let c = 0; c < cols.length; c++) {
          if (cols[c].name.toLowerCase() === fkKeys[i].toLowerCase() && !cols[c].key) {
            cols[c].key = "MUL";
          }
        }
      }

      if (existingTbl) {
        if (ifNotExists) {
          return { kind: "text", text: "Query OK, 0 rows affected, 1 warning (0.00 sec)" };
        }
        throw new MysqlError("ERROR 1050 (42S01): Table '" + ref.table + "' already exists");
      }
      if (cols.length === 0) {
        throw new MysqlError("ERROR 1113 (42000): A table must have at least 1 column");
      }

      db.tables[ref.table] = {
        name: ref.table,
        columns: cols,
        rows: [],
        nextAutoIncrement: 1,
        engine: "InnoDB",
        charset: "utf8mb4",
      };
      return { kind: "text", text: "Query OK, 0 rows affected (0.02 sec)" };
    }

    throw new SqlSyntaxError(cur.nearHere());
  }

  // DROP DATABASE / TABLE
  if (cur.matchWord("DROP")) {
    if (cur.matchWord("DATABASE") || cur.matchWord("SCHEMA")) {
      let ifExists = false;
      if (cur.matchWord("IF")) {
        cur.expectWord("EXISTS");
        ifExists = true;
      }
      const dbName = cur.parseIdent();
      const dbKey = findDatabaseKey(session.databases, dbName);
      if (!dbKey) {
        if (ifExists) return { kind: "text", text: "Query OK, 0 rows affected, 1 warning (0.00 sec)" };
        throw new MysqlError("ERROR 1008 (HY000): Can't drop database '" + dbName + "'; database doesn't exist");
      }
      if (SYSTEM_DATABASES.indexOf(dbKey.toLowerCase()) !== -1) {
        throw new MysqlError("ERROR 1044 (42000): Access denied for user 'root'@'localhost' to database '" + dbKey + "'");
      }
      delete session.databases[dbKey];
      if (session.currentDb && session.currentDb.toLowerCase() === dbKey.toLowerCase()) {
        session.currentDb = null;
      }
      return { kind: "text", text: "Query OK, 0 rows affected (0.01 sec)" };
    }

    if (cur.matchWord("TABLE")) {
      let ifExists = false;
      if (cur.matchWord("IF")) {
        cur.expectWord("EXISTS");
        ifExists = true;
      }
      do {
        const ref = cur.parseTableName();
        const dbName = ref.db || session.currentDb;
        if (!dbName) throw new MysqlError("ERROR 1046 (3D000): No database selected");
        const dbKey = findDatabaseKey(session.databases, dbName);
        if (!dbKey) throw new MysqlError("ERROR 1049 (42000): Unknown database '" + dbName + "'");
        const db = session.databases[dbKey];
        const tKey = findTableKey(db, ref.table);
        if (!tKey) {
          if (!ifExists) {
            throw new MysqlError("ERROR 1051 (42S02): Unknown table '" + db.name + "." + ref.table + "'");
          }
        } else {
          delete db.tables[tKey];
        }
      } while (cur.matchPunct(","));
      return { kind: "text", text: "Query OK, 0 rows affected (0.01 sec)" };
    }

    throw new SqlSyntaxError(cur.nearHere());
  }

  // TRUNCATE [TABLE] <table>
  if (cur.matchWord("TRUNCATE")) {
    cur.matchWord("TABLE");
    const ref = cur.parseTableName();
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    resolved.table.rows = [];
    resolved.table.nextAutoIncrement = 1;
    return { kind: "text", text: "Query OK, 0 rows affected (0.01 sec)" };
  }

  // RENAME TABLE a TO b
  if (cur.matchWord("RENAME")) {
    cur.expectWord("TABLE");
    const oldRef = cur.parseTableName();
    cur.expectWord("TO");
    const newRef = cur.parseTableName();
    const resolved = resolveTableFromSession(session, oldRef.db, oldRef.table);
    if (findTableKey(resolved.db, newRef.table)) {
      throw new MysqlError("ERROR 1050 (42S01): Table '" + newRef.table + "' already exists");
    }
    const oldKey = findTableKey(resolved.db, oldRef.table)!;
    resolved.table.name = newRef.table;
    resolved.db.tables[newRef.table] = resolved.table;
    delete resolved.db.tables[oldKey];
    return { kind: "text", text: "Query OK, 0 rows affected (0.01 sec)" };
  }

  // ALTER TABLE
  if (cur.matchWord("ALTER")) {
    cur.expectWord("TABLE");
    const ref = cur.parseTableName();
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    const tbl = resolved.table;

    if (cur.matchWord("ADD")) {
      if (cur.matchWord("PRIMARY")) {
        cur.expectWord("KEY");
        cur.expectPunct("(");
        const colName = cur.parseIdent();
        cur.expectPunct(")");
        const col = findColumnDef(tbl, colName);
        if (!col) throw new MysqlError("ERROR 1072 (42000): Key column '" + colName + "' doesn't exist in table");
        col.key = "PRI";
        col.nullable = false;
        return { kind: "text", text: "Query OK, 0 rows affected (0.02 sec)" };
      }
      cur.matchWord("COLUMN");
      const parsed = parseColumnDefinition(cur);
      if (parsed.col) {
        if (findColumnDef(tbl, parsed.col.name)) {
          throw new MysqlError("ERROR 1060 (42S21): Duplicate column name '" + parsed.col.name + "'");
        }
        tbl.columns.push(parsed.col);
        for (let i = 0; i < tbl.rows.length; i++) {
          tbl.rows[i][parsed.col.name] = parsed.col.defaultValue;
        }
      }
      return { kind: "text", text: "Query OK, 0 rows affected (0.02 sec)" };
    }

    if (cur.matchWord("DROP")) {
      cur.matchWord("COLUMN");
      const colName = cur.parseIdent();
      const idx = tbl.columns.findIndex((c) => c.name.toLowerCase() === colName.toLowerCase());
      if (idx === -1) {
        throw new MysqlError("ERROR 1091 (42000): Can't DROP '" + colName + "'; check that column/key exists");
      }
      const actualName = tbl.columns[idx].name;
      tbl.columns.splice(idx, 1);
      for (let i = 0; i < tbl.rows.length; i++) {
        delete tbl.rows[i][actualName];
      }
      return { kind: "text", text: "Query OK, 0 rows affected (0.02 sec)" };
    }

    if (cur.matchWord("MODIFY")) {
      cur.matchWord("COLUMN");
      const parsed = parseColumnDefinition(cur);
      if (parsed.col) {
        const existing = findColumnDef(tbl, parsed.col.name);
        if (!existing) {
          throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + parsed.col.name + "' in '" + tbl.name + "'");
        }
        existing.type = parsed.col.type;
        existing.nullable = parsed.col.nullable;
        existing.defaultValue = parsed.col.defaultValue;
        existing.extra = parsed.col.extra;
        existing.autoIncrement = parsed.col.autoIncrement;
      }
      return { kind: "text", text: "Query OK, 0 rows affected (0.02 sec)" };
    }

    if (cur.matchWord("CHANGE")) {
      cur.matchWord("COLUMN");
      const oldName = cur.parseIdent();
      const parsed = parseColumnDefinition(cur);
      const existing = findColumnDef(tbl, oldName);
      if (!existing || !parsed.col) {
        throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + oldName + "' in '" + tbl.name + "'");
      }
      const prevName = existing.name;
      existing.name = parsed.col.name;
      existing.type = parsed.col.type;
      existing.nullable = parsed.col.nullable;
      existing.defaultValue = parsed.col.defaultValue;
      for (let i = 0; i < tbl.rows.length; i++) {
        const val = tbl.rows[i][prevName];
        delete tbl.rows[i][prevName];
        tbl.rows[i][existing.name] = val;
      }
      return { kind: "text", text: "Query OK, 0 rows affected (0.02 sec)" };
    }

    if (cur.matchWord("RENAME")) {
      cur.matchWord("TO") || cur.matchWord("AS");
      const newName = cur.parseIdent();
      if (findTableKey(resolved.db, newName)) {
        throw new MysqlError("ERROR 1050 (42S01): Table '" + newName + "' already exists");
      }
      const oldKey = findTableKey(resolved.db, ref.table)!;
      tbl.name = newName;
      resolved.db.tables[newName] = tbl;
      delete resolved.db.tables[oldKey];
      return { kind: "text", text: "Query OK, 0 rows affected (0.01 sec)" };
    }

    throw new SqlSyntaxError(cur.nearHere());
  }

  // INSERT INTO <table> [(cols)] VALUES (...), (...) | SELECT ...
  if (cur.matchWord("INSERT")) {
    cur.matchWord("IGNORE");
    cur.expectWord("INTO");
    const ref = cur.parseTableName();
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    const tbl = resolved.table;

    let targetCols: MysqlColumnDef[] = tbl.columns;
    if (cur.matchPunct("(")) {
      targetCols = [];
      do {
        const colName = cur.parseIdent();
        const col = findColumnDef(tbl, colName);
        if (!col) {
          throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + colName + "' in 'field list'");
        }
        targetCols.push(col);
      } while (cur.matchPunct(","));
      cur.expectPunct(")");
    }

    // Snapshot for atomic failure on duplicate/null errors
    const snapshot = cloneTable(tbl);

    try {
      let inserted = 0;
      if (cur.isWord("SELECT")) {
        const selectStmt = parseSelectStatement(cur);
        const selRes = executeSelectPlan(session, selectStmt);
        for (let r = 0; r < selRes.rows.length; r++) {
          if (selRes.rows[r].length !== targetCols.length) {
            throw new MysqlError("ERROR 1136 (21S01): Column count doesn't match value count at row " + (r + 1));
          }
          const draft: Record<string, MysqlValue> = {};
          for (let c = 0; c < targetCols.length; c++) {
            draft[targetCols[c].name] = selRes.rows[r][c];
          }
          validateAndInsertRow(tbl, draft);
          inserted++;
        }
      } else {
        cur.expectWord("VALUES");
        let rowIdx = 0;
        do {
          rowIdx++;
          cur.expectPunct("(");
          const exprs: Expr[] = [];
          if (!cur.matchPunct(")")) {
            do {
              if (cur.matchWord("DEFAULT")) {
                exprs.push({ type: "literal", value: null });
              } else {
                exprs.push(parseExpression(cur));
              }
            } while (cur.matchPunct(","));
            cur.expectPunct(")");
          }
          if (exprs.length !== targetCols.length) {
            throw new MysqlError("ERROR 1136 (21S01): Column count doesn't match value count at row " + rowIdx);
          }
          const draft: Record<string, MysqlValue> = {};
          const emptyJoined: JoinedRow = { tables: {}, tableOrder: [] };
          for (let c = 0; c < targetCols.length; c++) {
            draft[targetCols[c].name] = evalScalarExpr(session, exprs[c], emptyJoined, undefined, "field list");
          }
          validateAndInsertRow(tbl, draft);
          inserted++;
        } while (cur.matchPunct(","));
      }

      if (inserted === 1) {
        return { kind: "text", text: "Query OK, 1 row affected (0.01 sec)" };
      }
      return {
        kind: "text",
        text: "Query OK, " + inserted + " rows affected (0.01 sec)\nRecords: " + inserted + "  Duplicates: 0  Warnings: 0",
      };
    } catch (err) {
      resolved.db.tables[findTableKey(resolved.db, tbl.name)!] = snapshot;
      throw err;
    }
  }

  // UPDATE <table> SET col = expr [WHERE ...]
  if (cur.matchWord("UPDATE")) {
    const ref = cur.parseTableName();
    let alias = ref.table;
    if (!cur.isWord("SET")) {
      cur.matchWord("AS");
      alias = cur.parseIdent();
    }
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    const tbl = resolved.table;

    cur.expectWord("SET");
    const assignments: Array<{ col: MysqlColumnDef; expr: Expr }> = [];
    do {
      const colName = cur.parseIdent();
      const col = findColumnDef(tbl, colName);
      if (!col) {
        throw new MysqlError("ERROR 1054 (42S22): Unknown column '" + colName + "' in 'field list'");
      }
      if (!cur.matchOp("=")) throw new SqlSyntaxError(cur.nearHere());
      const expr = parseExpression(cur);
      assignments.push({ col: col, expr: expr });
    } while (cur.matchPunct(","));

    let whereExpr: Expr | undefined;
    if (cur.matchWord("WHERE")) {
      whereExpr = parseExpression(cur);
    }

    let limitCount: number | undefined;
    if (cur.matchWord("LIMIT")) {
      const nTok = cur.next();
      if (nTok.kind !== "number") throw new SqlSyntaxError(nTok.value);
      limitCount = Math.max(0, Math.floor(Number(nTok.value)));
    }

    let matched = 0;
    let changed = 0;
    const snapshot = cloneTable(tbl);

    try {
      for (let i = 0; i < tbl.rows.length; i++) {
        if (limitCount !== undefined && matched >= limitCount) break;
        const row = tbl.rows[i];
        const joinedRow: JoinedRow = {
          tables: { [alias]: row },
          tableOrder: [alias],
        };
        if (whereExpr && !toTruthiness(evalScalarExpr(session, whereExpr, joinedRow, undefined, "where clause"))) {
          continue;
        }
        matched++;
        let rowChanged = false;
        for (let a = 0; a < assignments.length; a++) {
          const nextRaw = evalScalarExpr(session, assignments[a].expr, joinedRow, undefined, "field list");
          const coerced = coerceSqlValue(nextRaw, assignments[a].col);
          if (coerced === null && !assignments[a].col.nullable) {
            throw new MysqlError("ERROR 1048 (23000): Column '" + assignments[a].col.name + "' cannot be null");
          }
          if (row[assignments[a].col.name] !== coerced) {
            row[assignments[a].col.name] = coerced;
            rowChanged = true;
          }
        }
        if (rowChanged) changed++;
      }

      return {
        kind: "text",
        text:
          "Query OK, " +
          changed +
          " " +
          (changed === 1 ? "row" : "rows") +
          " affected (0.01 sec)\nRows matched: " +
          matched +
          "  Changed: " +
          changed +
          "  Warnings: 0",
      };
    } catch (err) {
      resolved.db.tables[findTableKey(resolved.db, tbl.name)!] = snapshot;
      throw err;
    }
  }

  // DELETE FROM <table> [WHERE ...]
  if (cur.matchWord("DELETE")) {
    cur.expectWord("FROM");
    const ref = cur.parseTableName();
    let alias = ref.table;
    if (!cur.eof() && !cur.isWord("WHERE") && !cur.isWord("ORDER") && !cur.isWord("LIMIT")) {
      cur.matchWord("AS");
      alias = cur.parseIdent();
    }
    const resolved = resolveTableFromSession(session, ref.db, ref.table);
    const tbl = resolved.table;

    let whereExpr: Expr | undefined;
    if (cur.matchWord("WHERE")) {
      whereExpr = parseExpression(cur);
    }

    let limitCount: number | undefined;
    if (cur.matchWord("LIMIT")) {
      const nTok = cur.next();
      if (nTok.kind !== "number") throw new SqlSyntaxError(nTok.value);
      limitCount = Math.max(0, Math.floor(Number(nTok.value)));
    }

    const kept: Record<string, MysqlValue>[] = [];
    let deleted = 0;

    for (let i = 0; i < tbl.rows.length; i++) {
      const row = tbl.rows[i];
      if (limitCount !== undefined && deleted >= limitCount) {
        kept.push(row);
        continue;
      }
      const joinedRow: JoinedRow = {
        tables: { [alias]: row },
        tableOrder: [alias],
      };
      if (!whereExpr || toTruthiness(evalScalarExpr(session, whereExpr, joinedRow, undefined, "where clause"))) {
        deleted++;
      } else {
        kept.push(row);
      }
    }

    tbl.rows = kept;
    return {
      kind: "text",
      text: "Query OK, " + formatRowCountLabel(deleted) + " affected (0.01 sec)",
    };
  }

  // SET / COMMIT / ROLLBACK / BEGIN / START TRANSACTION
  if (cur.matchWord("SET")) {
    return { kind: "text", text: "Query OK, 0 rows affected (0.00 sec)" };
  }
  if (cur.matchWord("BEGIN") || cur.matchWord("START") || cur.matchWord("COMMIT") || cur.matchWord("ROLLBACK")) {
    return { kind: "text", text: "Query OK, 0 rows affected (0.00 sec)" };
  }

  throw new SqlSyntaxError(cur.nearHere());
}

function buildStatusOutput(session: MysqlSession): string {
  const elapsedSec = Math.max(1, Math.floor((Date.now() - session.startedAt) / 1000) + 8078);
  const hrs = Math.floor(elapsedSec / 3600);
  const mins = Math.floor((elapsedSec % 3600) / 60);
  const secs = elapsedSec % 60;
  const uptimeStr = hrs + " hours " + mins + " min " + secs + " sec";
  const dbDisplay = session.currentDb || "";
  let totalTables = 0;
  const dbKeys = Object.keys(session.databases);
  for (let i = 0; i < dbKeys.length; i++) {
    totalTables += Object.keys(session.databases[dbKeys[i]].tables).length;
  }

  return [
    "--------------",
    "mysql  Ver " +
      session.serverVersion +
      " for Win64 on x86_64 (MySQL Community Server - GPL)",
    "",
    "Connection id:          " + session.connectionId,
    "Current database:       " + dbDisplay,
    "Current user:           " + session.user,
    "SSL:                    Cipher in use is TLS_AES_256_GCM_SHA384",
    "Using delimiter:        " + session.delimiter,
    "Server version:         " + session.serverVersion + " MySQL Community Server - GPL",
    "Protocol version:       10",
    "Connection:             localhost via TCP/IP",
    "Server characterset:    utf8mb4",
    "Db     characterset:    utf8mb4",
    "Client characterset:    utf8mb4",
    "Conn.  characterset:    utf8mb4",
    "TCP port:               3306",
    "Binary data as:         Hexadecimal",
    "Uptime:                 " + uptimeStr,
    "",
    "Threads: 2  Questions: " +
      session.questions +
      "  Slow queries: 0  Opens: 142  Flush tables: 3  Open tables: " +
      totalTables +
      "  Queries per second avg: 0.005",
    "--------------",
  ].join("\n");
}

function tryHandleClientCommand(
  session: MysqlSession,
  rawLine: string
): {
  handled: boolean;
  outputs: MysqlOutputBlock[];
  clearScreen: boolean;
  exited: boolean;
  reconnected: boolean;
} {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return { handled: true, outputs: [], clearScreen: false, exited: false, reconnected: false };
  }

  const stripped = trimmed.replace(/;+\s*$/, "").trim();
  const lower = stripped.toLowerCase();

  // Clear current buffer (\c)
  if (trimmed === "\\c" || lower === "clear") {
    session.buffer = "";
    return { handled: true, outputs: [], clearScreen: false, exited: false, reconnected: false };
  }

  // Screen clear (cls / system cls / \! cls)
  if (lower === "cls" || lower === "system cls" || lower === "\\! cls" || lower === "system clear") {
    return { handled: true, outputs: [], clearScreen: true, exited: false, reconnected: false };
  }

  // Exit / Quit
  if (lower === "\\q" || lower === "exit" || lower === "quit") {
    session.exited = true;
    session.buffer = "";
    return {
      handled: true,
      outputs: [{ kind: "bye", text: "Bye" }],
      clearScreen: false,
      exited: true,
      reconnected: false,
    };
  }

  // Help (\h, \?, ?, help)
  if (lower === "\\h" || lower === "\\?" || lower === "?" || lower === "help") {
    return {
      handled: true,
      outputs: [{ kind: "help", text: MYSQL_HELP_TEXT }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }
  if (lower.indexOf("help ") === 0) {
    const topic = stripped.slice(5).trim().replace(/^['"]|['"]$/g, "");
    const upperTopic = topic.toUpperCase();
    if (upperTopic === "CONTENTS") {
      return {
        handled: true,
        outputs: [
          {
            kind: "help",
            text: [
              "For more information, type 'help <item>', where <item> is one of the following",
              "categories:",
              "   Account Management",
              "   Data Definition",
              "   Data Manipulation",
              "   Functions",
              "   Utility",
            ].join("\n"),
          },
        ],
        clearScreen: false,
        exited: false,
        reconnected: false,
      };
    }
    return {
      handled: true,
      outputs: [
        {
          kind: "help",
          text:
            "Name: '" +
            upperTopic +
            "'\nDescription:\nMySQL 8.0 SQL reference topic for " +
            upperTopic +
            ". Type '\\h' for client commands.",
        },
      ],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Status (\s, status)
  if (lower === "\\s" || lower === "status") {
    return {
      handled: true,
      outputs: [{ kind: "status", text: buildStatusOutput(session) }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Print current buffer (\p, print)
  if (stripped === "\\p" || lower === "print") {
    return {
      handled: true,
      outputs: [
        {
          kind: "text",
          text: session.buffer ? "--------------\n" + session.buffer + "\n--------------" : "",
        },
      ],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Prompt (\R <pattern>, prompt <pattern>) - checked case-sensitively before \r reconnect
  if (
    stripped === "\\R" ||
    stripped.indexOf("\\R ") === 0 ||
    lower === "prompt" ||
    lower.indexOf("prompt ") === 0
  ) {
    const p =
      stripped.indexOf("\\R") === 0
        ? stripped.slice(2).trim()
        : stripped.slice(6).trim();
    session.promptPattern = p ? p + " " : "mysql> ";
    return {
      handled: true,
      outputs: [{ kind: "text", text: "PROMPT set to '" + session.promptPattern + "'" }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Reconnect (\r, connect) - case-sensitive for \r so \R is never intercepted
  if (
    stripped === "\\r" ||
    stripped.indexOf("\\r ") === 0 ||
    lower === "connect" ||
    lower.indexOf("connect ") === 0
  ) {
    const parts = stripped.split(/\s+/);
    if (parts[1]) {
      const dbKey = findDatabaseKey(session.databases, parts[1]);
      if (!dbKey) {
        return {
          handled: true,
          outputs: [{ kind: "error", text: "ERROR 1049 (42000): Unknown database '" + parts[1] + "'" }],
          clearScreen: false,
          exited: false,
          reconnected: false,
        };
      }
      session.currentDb = dbKey;
    }
    session.connectionId++;
    session.exited = false;
    return {
      handled: true,
      outputs: [
        {
          kind: "text",
          text:
            "Connection id:    " +
            session.connectionId +
            "\nCurrent database: " +
            (session.currentDb || "*** NONE ***"),
        },
      ],
      clearScreen: false,
      exited: false,
      reconnected: true,
    };
  }

  // Delimiter (\d <delim>, delimiter <delim>)
  if (lower.indexOf("\\d ") === 0 || lower.indexOf("delimiter ") === 0) {
    const newDelim = trimmed.replace(/^(\\d|delimiter)\s+/i, "").trim();
    if (!newDelim) {
      return {
        handled: true,
        outputs: [{ kind: "error", text: "DELIMITER must be followed by a 'delimiter' character or string" }],
        clearScreen: false,
        exited: false,
        reconnected: false,
      };
    }
    session.delimiter = newDelim;
    return { handled: true, outputs: [], clearScreen: false, exited: false, reconnected: false };
  }

  // Use database without semicolon (use <db>, \u <db>)
  if (lower.indexOf("\\u ") === 0 || (lower.indexOf("use ") === 0 && trimmed.indexOf(";") === -1)) {
    const dbArg = stripped.replace(/^(\\u|use)\s+/i, "").trim().replace(/^`|`$/g, "");
    const key = findDatabaseKey(session.databases, dbArg);
    if (!key) {
      return {
        handled: true,
        outputs: [{ kind: "error", text: "ERROR 1049 (42000): Unknown database '" + dbArg + "'" }],
        clearScreen: false,
        exited: false,
        reconnected: false,
      };
    }
    session.currentDb = key;
    return {
      handled: true,
      outputs: [{ kind: "text", text: "Database changed" }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Warnings toggle (\W / \w)
  if (trimmed === "\\W" || lower === "warnings") {
    session.warningsEnabled = true;
    return {
      handled: true,
      outputs: [{ kind: "text", text: "Show warnings enabled." }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }
  if (trimmed === "\\w" || lower === "nowarning") {
    session.warningsEnabled = false;
    return {
      handled: true,
      outputs: [{ kind: "text", text: "Show warnings disabled." }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Reset connection (\x, resetconnection)
  if (stripped === "\\x" || lower === "resetconnection") {
    session.connectionId++;
    session.buffer = "";
    return {
      handled: true,
      outputs: [],
      clearScreen: false,
      exited: false,
      reconnected: true,
    };
  }

  // Charset (\C <charset>, charset <charset>)
  if (stripped === "\\C" || stripped.indexOf("\\C ") === 0 || lower.indexOf("charset ") === 0) {
    return {
      handled: true,
      outputs: [{ kind: "text", text: "Charset changed" }],
      clearScreen: false,
      exited: false,
      reconnected: false,
    };
  }

  // Rehash / nopager / notee
  if (stripped === "\\#" || lower === "rehash" || stripped === "\\n" || lower === "nopager" || stripped === "\\t" || lower === "notee") {
    return { handled: true, outputs: [], clearScreen: false, exited: false, reconnected: false };
  }

  return { handled: false, outputs: [], clearScreen: false, exited: false, reconnected: false };
}

export interface SplitStatement {
  sql: string;
  vertical: boolean;
}

export function splitMysqlBuffer(
  buffer: string,
  delimiter: string = ";"
): {
  statements: SplitStatement[];
  remainder: string;
  aborted: boolean;
  promptType: MysqlPromptType;
} {
  const statements: SplitStatement[] = [];
  let quote: "'" | '"' | "`" | null = null;
  let inBlockComment = false;
  let inLineComment = false;
  let stmtStart = 0;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    const next = i + 1 < buffer.length ? buffer[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (quote !== null) {
      if (ch === "\\" && (quote === "'" || quote === '"')) {
        i++;
        continue;
      }
      if (ch === quote) {
        if (next === quote) {
          i++;
          continue;
        }
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "-" && next === "-" && (i + 2 >= buffer.length || /\s/.test(buffer[i + 2]))) {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "#") {
      inLineComment = true;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    // \c clears current statement
    if (ch === "\\" && next === "c") {
      return { statements: statements, remainder: "", aborted: true, promptType: "main" };
    }

    // \g or \G terminates statement
    if (ch === "\\" && (next === "g" || next === "G")) {
      const piece = buffer.slice(stmtStart, i).trim();
      if (piece) {
        statements.push({ sql: piece, vertical: next === "G" });
      }
      i++;
      stmtStart = i + 1;
      continue;
    }

    // Custom or ';' delimiter
    if (delimiter && buffer.slice(i, i + delimiter.length) === delimiter) {
      const piece = buffer.slice(stmtStart, i).trim();
      if (piece) {
        statements.push({ sql: piece, vertical: false });
      }
      i += delimiter.length - 1;
      stmtStart = i + 1;
      continue;
    }
  }

  const remainder = buffer.slice(stmtStart);
  const trimmedRem = remainder.trim();
  return {
    statements: statements,
    remainder: trimmedRem ? remainder : "",
    aborted: false,
    promptType: trimmedRem ? detectPromptType(remainder) : "main",
  };
}

/**
 * Interactive line-by-line CLI handler: preserves authentic MySQL multiline buffering
 * (`    -> `, `   '> `, `   "> `) until `;`, `\g`, `\G`, or a single-line client command.
 */
export function submitMysqlLine(session: MysqlSession, rawLine: string): MysqlExecutionResult {
  if (session.exited) {
    return {
      outputs: [{ kind: "bye", text: "Bye" }],
      clearScreen: false,
      exited: true,
      reconnected: false,
      prompt: formatMysqlPrompt("main", session.promptPattern),
      promptType: "main",
      currentDb: session.currentDb,
    };
  }

  // Empty buffer: check standalone client command first
  if (!session.buffer.trim()) {
    const cmdRes = tryHandleClientCommand(session, rawLine);
    if (cmdRes.handled) {
      const pType: MysqlPromptType = session.buffer.trim() ? detectPromptType(session.buffer) : "main";
      return {
        outputs: cmdRes.outputs,
        clearScreen: cmdRes.clearScreen,
        exited: cmdRes.exited,
        reconnected: cmdRes.reconnected,
        prompt: formatMysqlPrompt(pType, session.promptPattern),
        promptType: pType,
        currentDb: session.currentDb,
      };
    }
  } else if (rawLine.trim() === "\\c") {
    session.buffer = "";
    return {
      outputs: [],
      clearScreen: false,
      exited: false,
      reconnected: false,
      prompt: formatMysqlPrompt("main", session.promptPattern),
      promptType: "main",
      currentDb: session.currentDb,
    };
  }

  const combined = session.buffer ? session.buffer + "\n" + rawLine : rawLine;
  const split = splitMysqlBuffer(combined, session.delimiter);

  const outputs: MysqlOutputBlock[] = [];
  let clearScreen = false;
  let exited = false;
  let reconnected = false;

  for (let i = 0; i < split.statements.length; i++) {
    const st = split.statements[i];
    const cmd = tryHandleClientCommand(session, st.sql);
    if (cmd.handled) {
      for (let o = 0; o < cmd.outputs.length; o++) outputs.push(cmd.outputs[o]);
      if (cmd.clearScreen) clearScreen = true;
      if (cmd.exited) exited = true;
      if (cmd.reconnected) reconnected = true;
      continue;
    }
    try {
      const block = executeSingleSqlStatement(session, st.sql, st.vertical);
      if (block.text) outputs.push(block);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputs.push({ kind: "error", text: msg });
    }
  }

  session.buffer = split.aborted ? "" : split.remainder;
  const promptType: MysqlPromptType = session.buffer.trim() ? split.promptType : "main";

  return {
    outputs: outputs,
    clearScreen: clearScreen,
    exited: exited || session.exited,
    reconnected: reconnected,
    prompt: formatMysqlPrompt(promptType, session.promptPattern),
    promptType: promptType,
    currentDb: session.currentDb,
  };
}

/**
 * Direct query execution helper (for unit tests or pasted multi-statement scripts).
 * Automatically runs a statement even if the caller omits a trailing `;`.
 */
export function executeMysqlInput(session: MysqlSession, rawInput: string): MysqlExecutionResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return submitMysqlLine(session, "");
  }

  const cmd = tryHandleClientCommand(session, trimmed);
  if (cmd.handled && trimmed.indexOf("\n") === -1) {
    return {
      outputs: cmd.outputs,
      clearScreen: cmd.clearScreen,
      exited: cmd.exited,
      reconnected: cmd.reconnected,
      prompt: formatMysqlPrompt("main", session.promptPattern),
      promptType: "main",
      currentDb: session.currentDb,
    };
  }

  const split = splitMysqlBuffer(trimmed, session.delimiter);
  if (split.statements.length === 0 && split.remainder.trim() && !split.aborted) {
    // Auto-terminate direct SQL query when invoked programmatically without `;`
    return executeMysqlInput(session, trimmed + session.delimiter);
  }

  const outputs: MysqlOutputBlock[] = [];
  let clearScreen = false;
  let exited = false;
  let reconnected = false;

  for (let i = 0; i < split.statements.length; i++) {
    const st = split.statements[i];
    const subCmd = tryHandleClientCommand(session, st.sql);
    if (subCmd.handled) {
      for (let o = 0; o < subCmd.outputs.length; o++) outputs.push(subCmd.outputs[o]);
      if (subCmd.clearScreen) clearScreen = true;
      if (subCmd.exited) exited = true;
      if (subCmd.reconnected) reconnected = true;
      continue;
    }
    try {
      const block = executeSingleSqlStatement(session, st.sql, st.vertical);
      if (block.text) outputs.push(block);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputs.push({ kind: "error", text: msg });
    }
  }

  if (split.remainder.trim() && !split.aborted) {
    try {
      const block = executeSingleSqlStatement(session, split.remainder.trim(), false);
      if (block.text) outputs.push(block);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputs.push({ kind: "error", text: msg });
    }
  }

  session.buffer = "";
  return {
    outputs: outputs,
    clearScreen: clearScreen,
    exited: exited || session.exited,
    reconnected: reconnected,
    prompt: formatMysqlPrompt("main", session.promptPattern),
    promptType: "main",
    currentDb: session.currentDb,
  };
}

export function getMysqlCompletions(session: MysqlSession, tokenPrefix: string): string[] {
  const lower = tokenPrefix.toLowerCase();
  const candidates: string[] = [];
  const seen: Record<string, boolean> = {};

  const pushCandidate = (word: string) => {
    const key = word.toLowerCase();
    if (!seen[key] && (!lower || key.indexOf(lower) === 0)) {
      seen[key] = true;
      candidates.push(word);
    }
  };

  // Database names
  const dbKeys = Object.keys(session.databases);
  for (let i = 0; i < dbKeys.length; i++) {
    pushCandidate(dbKeys[i]);
  }

  // Tables & columns in current database
  if (session.currentDb) {
    const dbKey = findDatabaseKey(session.databases, session.currentDb);
    if (dbKey) {
      const db = session.databases[dbKey];
      const tKeys = Object.keys(db.tables);
      for (let i = 0; i < tKeys.length; i++) {
        const tbl = db.tables[tKeys[i]];
        pushCandidate(tbl.name);
        for (let c = 0; c < tbl.columns.length; c++) {
          pushCandidate(tbl.columns[c].name);
        }
      }
    }
  }

  // SQL keywords
  for (let i = 0; i < SQL_KEYWORDS.length; i++) {
    pushCandidate(SQL_KEYWORDS[i]);
  }

  return candidates.sort();
}
