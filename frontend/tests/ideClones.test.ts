import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeJavaProblems,
  executeJavaCode,
  extractFoldableMethodLines,
  extractTodoTasks,
  formatJavaCode,
  inspectJavaAtLine,
} from "../lib/ide/eclipseRunner.ts";

import {
  ASYNC_SCHEDULER_JAVA,
  HELLO_WORLD_JAVA,
  INTELLIJ_PRESETS,
  LAMBDA_EVALUATION_JAVA,
  USER_TEST_DATA_JAVA,
  analyzeJavaDiagnostics,
  executeTerminalCommand,
  extractJavaSymbols,
  findVirtualFileByName,
  indexVirtualFiles,
  runJavaProgram,
  tokenizeJavaLine,
} from "../lib/ide/intellijRunner.ts";

import {
  applyPragmaUpdate,
  createInitialDatabaseState,
  deleteTableRow,
  detectCellDataType,
  executeSqlBatch,
  exportDatabaseToSql,
  exportResultToCsv,
  insertBlankRecord,
  revertChanges,
  splitSqlStatements,
  updateTableCell,
  utf8ByteLength,
  writeChanges,
} from "../lib/ide/sqliteEngine.ts";

import {
  MYSQL_HELP_TEXT,
  MYSQL_SERVER_VERSION,
  MYSQL_WELCOME_BANNER,
  createMysqlSession,
  detectPromptType,
  executeMysqlInput,
  formatAsciiTable,
  formatMysqlPrompt,
  formatVerticalRows,
  getMysqlCompletions,
  splitMysqlBuffer,
  submitMysqlLine,
} from "../lib/ide/mysqlEngine.ts";

// ============================================================================
// 1. Eclipse Java Runner (frontend/lib/ide/eclipseRunner.ts)
// ============================================================================

test("Eclipse: runs HelloWorld in package com.openclassrooms", () => {
  const code = [
    "package com.openclassrooms;",
    "",
    "public class HelloWorld {",
    "\tpublic static void main(String[] args) {",
    "\t\t// TODO Auto-generated method stub",
    '\t\tSystem.out.println("I am using Eclipse!");',
    "\t}",
    "}",
  ].join("\n");

  const res = executeJavaCode(code);
  assert.equal(res.success, true);
  assert.equal(res.exitCode, 0);
  assert.equal(res.packageName, "com.openclassrooms");
  assert.equal(res.className, "HelloWorld");
  assert.equal(res.stdout, "I am using Eclipse!\n");
  assert.equal(res.stderr, "");
  assert.equal(res.problems.filter((p) => p.severity === "error").length, 0);
});

test("Eclipse: evaluates variables, loops, conditionals, recursion, ArrayList, Scanner, and try/catch", () => {
  const code = [
    "package demo;",
    "import java.util.ArrayList;",
    "import java.util.Scanner;",
    "",
    "public class Calc {",
    "    public static int fact(int n) {",
    "        if (n <= 1) return 1;",
    "        return n * fact(n - 1);",
    "    }",
    "    public static void main(String[] args) {",
    "        Scanner sc = new Scanner(System.in);",
    "        String name = sc.nextLine();",
    "        int factor = sc.nextInt();",
    "        int sum = 0;",
    "        for (int i = 1; i <= 5; i++) {",
    "            if (i % 2 == 0) sum += i;",
    "        }",
    "        int k = 3;",
    "        String label = \"\";",
    "        switch (k) {",
    '            case 3: label = "three"; break;',
    '            default: label = "other"; break;',
    "        }",
    "        ArrayList<Integer> list = new ArrayList<Integer>();",
    "        list.add(fact(5));",
    "        list.add(sum * factor);",
    "        String caught = \"none\";",
    "        try {",
    "            int bad = 10 / 0;",
    "            System.out.println(bad);",
    "        } catch (ArithmeticException ex) {",
    '            caught = "div0";',
    "        }",
    '        System.out.println(name + ":" + list.get(0) + ":" + list.get(1) + ":" + label + ":" + caught);',
    "    }",
    "}",
  ].join("\n");

  const res = executeJavaCode(code, "Alice\n4\n");
  assert.equal(res.success, true, res.stderr);
  assert.equal(res.stdout, "Alice:120:24:three:div0\n");

  // Scanner edge case: nextInt() then nextLine() trailing newline semantics & hasNextInt()
  const scannerEdge = [
    "import java.util.Scanner;",
    "public class ScanMix {",
    "    public static void main(String[] args) {",
    "        Scanner s = new Scanner(System.in);",
    "        boolean hasInt = s.hasNextInt();",
    "        int n = s.nextInt();",
    "        String rest = s.nextLine();",
    "        String next = s.nextLine();",
    '        System.out.println(hasInt + "|" + n + "|" + rest + "|" + next);',
    "    }",
    "}",
  ].join("\n");
  const edgeOut = executeJavaCode(scannerEdge, "7\nBeta\n");
  assert.equal(edgeOut.success, true, edgeOut.stderr);
  assert.equal(edgeOut.stdout, "true|7||Beta\n");
});

test("Eclipse: detects syntax errors, unbalanced braces, runtime division by zero, TODOs, symbols, and formatting", () => {
  const broken = [
    "public class Broken {",
    "    public static void main(String[] args) {",
    '        System.out.println("unclosed)',
    "    }",
  ].join("\n");

  const problems = analyzeJavaProblems(broken, "Broken.java", "/HelloWorld/src");
  assert.ok(problems.some((p) => p.severity === "error"));

  const failRun = executeJavaCode(broken);
  assert.equal(failRun.success, false);
  assert.equal(failRun.exitCode, 1);
  assert.ok(failRun.stderr.indexOf("Unresolved compilation problem") !== -1);

  const divZero = [
    "public class Crash {",
    "    public static void main(String[] args) {",
    "        int x = 1 / 0;",
    "        System.out.println(x);",
    "    }",
    "}",
  ].join("\n");
  const crashRun = executeJavaCode(divZero);
  assert.equal(crashRun.success, false);
  assert.ok(crashRun.stderr.indexOf("ArithmeticException") !== -1);

  const sample = [
    "package com.openclassrooms;",
    "public class Sample {",
    "    // TODO implement helper",
    "    public static void main(String[] args) {",
    '        System.out.println("hi");',
    "    }",
    "}",
  ].join("\n");
  const todos = extractTodoTasks(sample);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].line, 3);
  assert.ok(todos[0].text.indexOf("TODO") !== -1);

  const foldable = extractFoldableMethodLines(sample);
  assert.deepEqual(foldable, [4]);

  const info = inspectJavaAtLine(sample, 5);
  assert.ok(info.declaration.indexOf("println") !== -1);
  assert.ok(info.symbols.some((s) => s.kind === "class" && s.name === "Sample"));

  const formatted = formatJavaCode("class A{\nvoid m(){\nint x=1;\n}\n}");
  assert.equal(formatted, "class A{\n\tvoid m(){\n\t\tint x=1;\n\t}\n}");

  const emptyRun = executeJavaCode("   ");
  assert.equal(emptyRun.success, false);
});

// ============================================================================
// 2. IntelliJ IDEA Java Runner (frontend/lib/ide/intellijRunner.ts)
// ============================================================================

test("IntelliJ: executes built-in HelloWorld, UserTestData, LambdaEvaluation, and detects InfiniteLoopStatement", () => {
  const hw = runJavaProgram(HELLO_WORLD_JAVA);
  assert.equal(hw.success, true);
  assert.equal(hw.exitCode, 0);
  assert.equal(hw.className, "com.example.java.HelloWorld");
  assert.equal(hw.stdout, "Hello World!\n");

  const asyncDiag = analyzeJavaDiagnostics(ASYNC_SCHEDULER_JAVA);
  assert.ok(asyncDiag.some((d) => d.severity === "warning" && d.code === "InfiniteLoopStatement"));

  const userRes = runJavaProgram(USER_TEST_DATA_JAVA);
  assert.equal(userRes.success, true, userRes.stderr);
  assert.ok(userRes.stdout.indexOf("User[") !== -1 || userRes.stdout.length > 0);

  const lambdaRes = runJavaProgram(LAMBDA_EVALUATION_JAVA);
  assert.equal(lambdaRes.success, true, lambdaRes.stderr);
  assert.ok(lambdaRes.outputLines.length > 0);
});

test("IntelliJ: runs custom Java with loops, conditionals, helper methods, diagnostics, tokenizer, and symbols", () => {
  const code = [
    "package org.test;",
    "",
    "public class MathDemo {",
    "    private static final int SCALE = 2;",
    "",
    "    static int fib(int n) {",
    "        if (n <= 1) return n;",
    "        return fib(n - 1) + fib(n - 2);",
    "    }",
    "",
    "    public static void main(String[] args) {",
    "        int total = 0;",
    "        for (int i = 0; i < 6; i++) {",
    "            if (i % 2 == 1) total += fib(i);",
    "        }",
    '        System.out.println("result=" + (total * SCALE));',
    "    }",
    "}",
  ].join("\n");

  const res = runJavaProgram(code);
  assert.equal(res.success, true, res.stderr);
  assert.equal(res.className, "org.test.MathDemo");
  assert.equal(res.stdout, "result=16\n");

  const syms = extractJavaSymbols(code);
  assert.ok(syms.some((s) => s.kind === "class" && s.name === "MathDemo"));
  assert.ok(syms.some((s) => s.kind === "method" && s.name === "fib"));
  assert.ok(syms.some((s) => s.kind === "method" && s.name === "main" && s.isMain));

  const tokLine = tokenizeJavaLine('public static final int N = 42; // ok', false);
  assert.equal(tokLine.inBlockComment, false);
  assert.ok(tokLine.tokens.some((t) => t.type === "keyword" && t.text === "public"));
  assert.ok(tokLine.tokens.some((t) => t.type === "comment"));

  const multiCommentStart = tokenizeJavaLine("/* block comment", false);
  assert.equal(multiCommentStart.inBlockComment, true);
  const multiCommentEnd = tokenizeJavaLine("still inside */ int x = 1;", true);
  assert.equal(multiCommentEnd.inBlockComment, false);

  const missingSemi = [
    "public class Bad {",
    "    public static void main(String[] args) {",
    "        int x = 5",
    "        System.out.println(x);",
    "    }",
    "}",
  ].join("\n");
  const diags = analyzeJavaDiagnostics(missingSemi);
  assert.ok(diags.some((d) => d.severity === "error"));

  const badRun = runJavaProgram(missingSemi);
  assert.equal(badRun.success, false);
  assert.equal(badRun.exitCode, 1);

  const emptyDiag = analyzeJavaDiagnostics("");
  assert.equal(emptyDiag.length, 0);
});

test("IntelliJ: virtual file index/lookup and embedded terminal commands work", () => {
  const hwPreset = INTELLIJ_PRESETS.find((p) => p.id === "HelloWorld");
  assert.ok(hwPreset);
  const filesById = indexVirtualFiles(hwPreset.tree);
  const active = filesById[hwPreset.defaultFileId];
  assert.ok(active);

  const found = findVirtualFileByName(hwPreset.tree, "HelloWorld.java");
  assert.ok(found);
  assert.equal(found.name, "HelloWorld.java");

  const pwdOut = executeTerminalCommand("pwd", hwPreset, filesById, active.id);
  assert.ok(pwdOut.lines[0].indexOf("HelloWorld") !== -1);

  const verOut = executeTerminalCommand("java -version", hwPreset, filesById, active.id);
  assert.ok(verOut.lines.some((l) => l.indexOf("21.0.4") !== -1));

  const javaOut = executeTerminalCommand("java HelloWorld", hwPreset, filesById, active.id);
  assert.ok(javaOut.lines.some((l) => l.indexOf("Hello World!") !== -1));

  const clearOut = executeTerminalCommand("clear", hwPreset, filesById, active.id);
  assert.equal(clearOut.clear, true);
});

// ============================================================================
// 3. DB Browser SQLite Engine (frontend/lib/ide/sqliteEngine.ts)
// ============================================================================

test("SQLite: seeds Northwind 9 tables, Shipper 6 rows, and runs select * from shipper;", () => {
  const state = createInitialDatabaseState("northwind");
  assert.equal(state.working.dbName, "northwind.db");
  assert.equal(state.working.tableOrder.length, 9);
  assert.deepEqual(state.working.tableOrder, [
    "Category",
    "Customer",
    "Employee",
    "OrderDetail",
    "Product",
    "SalesOrder",
    "Shipper",
    "Supplier",
    "sqlite_sequence",
  ]);
  assert.equal(state.working.indices.length, 1);
  assert.equal(state.working.indices[0].name, "IDX_OrderId_ProductId");

  const { batch } = executeSqlBatch(state, "select * from shipper;");
  assert.equal(batch.ok, true);
  assert.ok(batch.lastQueryResult);
  assert.deepEqual(batch.lastQueryResult.columns, ["shipperId", "companyName", "phone"]);
  assert.equal(batch.lastQueryResult.rows.length, 6);
  assert.deepEqual(batch.lastQueryResult.rows[0], [1, "Speedy Express", "(503) 555-9831"]);
  assert.deepEqual(batch.lastQueryResult.rows[5], [6, "DHL", "1-800-225-5345"]);
  assert.equal(batch.lastQueryResult.editableTable, "Shipper");
});

test("SQLite: supports JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, INSERT/UPDATE/DELETE, and commit/revert", () => {
  let state = createInitialDatabaseState("northwind");

  const joinRes = executeSqlBatch(
    state,
    "SELECT c.categoryName, COUNT(p.productId) AS cnt FROM Category c LEFT JOIN Product p ON c.categoryId = p.categoryId GROUP BY c.categoryName HAVING COUNT(p.productId) >= 2 ORDER BY cnt DESC LIMIT 3;"
  );
  assert.equal(joinRes.batch.ok, true, joinRes.batch.summaryText);
  assert.ok(joinRes.batch.lastQueryResult);
  assert.equal(joinRes.batch.lastQueryResult.rows.length, 3);
  assert.ok(Number(joinRes.batch.lastQueryResult.rows[0][1]) >= Number(joinRes.batch.lastQueryResult.rows[1][1]));

  const dmlRes = executeSqlBatch(
    state,
    "INSERT INTO Shipper (companyName, phone) VALUES ('FedEx Express', '1-800-463-3339');" +
      "UPDATE Shipper SET phone = '1-800-555-0000' WHERE companyName = 'FedEx Express';" +
      "SELECT companyName, phone FROM Shipper WHERE companyName = 'FedEx Express';"
  );
  assert.equal(dmlRes.batch.ok, true, dmlRes.batch.summaryText);
  state = dmlRes.nextState;
  assert.equal(state.dirty, true);
  assert.equal(state.working.tables["Shipper"].rows.length, 7);
  assert.equal(state.committed.tables["Shipper"].rows.length, 6);
  assert.deepEqual(dmlRes.batch.lastQueryResult?.rows, [["FedEx Express", "1-800-555-0000"]]);

  const reverted = revertChanges(state);
  assert.equal(reverted.dirty, false);
  assert.equal(reverted.working.tables["Shipper"].rows.length, 6);

  const deleted = executeSqlBatch(state, "DELETE FROM Shipper WHERE shipperId = 6;");
  assert.equal(deleted.batch.ok, true);
  const committed = writeChanges(deleted.nextState);
  assert.equal(committed.dirty, false);
  assert.equal(committed.committed.tables["Shipper"].rows.length, 6);
  assert.equal(committed.working.tables["Shipper"].rows.length, 6);
});

test("SQLite: supports PRAGMA, DDL, GUI cell/row helpers, exports, and error handling", () => {
  let state = createInitialDatabaseState("northwind");

  const ti = executeSqlBatch(state, "PRAGMA table_info(Shipper);");
  assert.equal(ti.batch.ok, true);
  assert.equal(ti.batch.lastQueryResult?.rows.length, 3);
  assert.equal(ti.batch.lastQueryResult?.rows[0][1], "shipperId");
  assert.equal(ti.batch.lastQueryResult?.rows[0][5], 1);

  const fkSet = executeSqlBatch(state, "PRAGMA foreign_keys = ON;");
  assert.equal(fkSet.batch.ok, true);
  assert.equal(fkSet.nextState.working.pragmas.foreign_keys, true);

  state = applyPragmaUpdate(state, "journal_mode", "wal");
  assert.equal(state.dirty, true);
  assert.equal(state.working.pragmas.journal_mode, "wal");

  state = updateTableCell(state, "Shipper", 0, "phone", "(503) 555-0100");
  assert.equal(state.working.tables["Shipper"].rows[0].phone, "(503) 555-0100");
  state = insertBlankRecord(state, "Shipper");
  assert.equal(state.working.tables["Shipper"].rows.length, 7);
  state = deleteTableRow(state, "Shipper", 6);
  assert.equal(state.working.tables["Shipper"].rows.length, 6);

  const ddl = executeSqlBatch(
    state,
    "CREATE TABLE Notes (id INTEGER PRIMARY KEY, body TEXT); INSERT INTO Notes (id, body) VALUES (1, 'hello');"
  );
  assert.equal(ddl.batch.ok, true, ddl.batch.summaryText);
  assert.ok(ddl.nextState.working.tables["Notes"]);

  assert.equal(detectCellDataType(null), "NULL");
  assert.equal(detectCellDataType(42), "Integer");
  assert.equal(detectCellDataType(3.14), "Real");
  assert.equal(detectCellDataType("abc"), "Text");
  assert.equal(utf8ByteLength("café"), 5);

  const csv = exportResultToCsv(["a", "b"], [['x,y', null]]);
  assert.equal(csv, 'a,b\n"x,y",');
  const sqlDump = exportDatabaseToSql(ddl.nextState.working);
  assert.ok(sqlDump.indexOf("CREATE TABLE Notes") !== -1);
  assert.ok(sqlDump.indexOf("COMMIT;") !== -1);

  const split = splitSqlStatements("SELECT 'a;b'; -- c\nSELECT 1;");
  assert.equal(split.length, 2);

  const errRes = executeSqlBatch(state, "SELECT * FROM does_not_exist;");
  assert.equal(errRes.batch.ok, false);
  assert.equal(errRes.batch.statements[0].ok, false);

  const emptyBatch = executeSqlBatch(state, "   -- only comment\n");
  assert.equal(emptyBatch.batch.ok, true);
  assert.equal(emptyBatch.batch.statements.length, 0);
});

// ============================================================================
// 4. MySQL CLI Engine (frontend/lib/ide/mysqlEngine.ts)

test("MySQL CLI: views reflect current rows and are listed as views", () => {
  const session = createMysqlSession();
  const run = (sql: string) => executeMysqlInput(session, sql).outputs.map((item) => item.text).join("\n");
  assert.match(run("CREATE DATABASE lab_view_test;"), /Query OK/);
  assert.match(run("USE lab_view_test;"), /Database changed/);
  assert.match(run("CREATE TABLE inventory (item VARCHAR(30), qty INT, price INT);"), /Query OK/);
  assert.match(run("INSERT INTO inventory VALUES ('Mouse', 20, 200);"), /Query OK/);
  assert.match(run("CREATE VIEW stock_value AS SELECT item, qty, price, qty*price AS total_value FROM inventory;"), /Query OK/);
  assert.match(run("SELECT SUM(total_value) AS total FROM stock_value;"), /4000/);
  assert.match(run("UPDATE inventory SET qty = 22 WHERE item = 'Mouse';"), /Query OK/);
  assert.match(run("SELECT SUM(total_value) AS total FROM stock_value;"), /4400/);
  assert.match(run("CREATE TABLE stock_value (id INT);"), /ERROR 1050/);
  assert.match(run("USE university; SELECT SUM(total_value) FROM lab_view_test.stock_value;"), /4400/);
  assert.match(run("USE lab_view_test;"), /Database changed/);
  assert.match(run("SHOW FULL TABLES;"), /VIEW/);
  assert.match(run("DROP VIEW stock_value;"), /Query OK/);
  assert.match(run("SELECT * FROM stock_value;"), /ERROR 1146/);
});
// ============================================================================

test("MySQL: banner, SHOW DATABASES, USE, DESCRIBE, SELECT, \\G, \\s, \\h, \\c, \\q", () => {
  assert.equal(MYSQL_SERVER_VERSION, "8.0.35");
  assert.ok(MYSQL_WELCOME_BANNER.indexOf("Welcome to the MySQL monitor.  Commands end with ; or \\g.") !== -1);
  assert.ok(MYSQL_HELP_TEXT.indexOf("\\G") !== -1);
  assert.ok(MYSQL_HELP_TEXT.indexOf("resetconnection(\\x)") !== -1);

  const session = createMysqlSession();
  assert.equal(formatMysqlPrompt("main"), "mysql> ");
  assert.equal(formatMysqlPrompt("continue"), "    -> ");
  assert.equal(formatMysqlPrompt("singleQuote"), "    '> ");
  assert.equal(formatMysqlPrompt("doubleQuote"), '    "> ');
  assert.equal(formatMysqlPrompt("backtick"), "    `> ");
  assert.equal(formatMysqlPrompt("comment"), "   /*> ");

  const dbs = executeMysqlInput(session, "SHOW DATABASES;");
  assert.equal(dbs.outputs[0].kind, "table");
  assert.ok(dbs.outputs[0].text.indexOf("northwind") !== -1);
  assert.ok(dbs.outputs[0].text.indexOf("university") !== -1);

  const useRes = executeMysqlInput(session, "USE northwind;");
  assert.equal(useRes.currentDb, "northwind");
  assert.ok(useRes.outputs[0].text.indexOf("Database changed") !== -1);

  const descRes = executeMysqlInput(session, "DESCRIBE shippers;");
  assert.equal(descRes.outputs[0].kind, "table");
  assert.ok(descRes.outputs[0].text.indexOf("CompanyName") !== -1);

  const selRes = executeMysqlInput(session, "SELECT ShipperID, CompanyName FROM shippers ORDER BY ShipperID;");
  assert.equal(selRes.outputs[0].kind, "table");
  assert.ok(selRes.outputs[0].text.indexOf("Speedy Express") !== -1);

  const vertRes = executeMysqlInput(session, "SELECT ShipperID, CompanyName FROM shippers WHERE ShipperID = 1\\G");
  assert.equal(vertRes.outputs[0].kind, "vertical");
  assert.ok(vertRes.outputs[0].text.indexOf("1. row") !== -1);
  assert.ok(vertRes.outputs[0].text.indexOf("Speedy Express") !== -1);

  const statusRes = submitMysqlLine(session, "\\s");
  assert.equal(statusRes.outputs[0].kind, "status");
  assert.ok(statusRes.outputs[0].text.indexOf("Ver 8.0.35 for Win64 on x86_64") !== -1);
  assert.ok(statusRes.outputs[0].text.indexOf("Current database:") !== -1);
  assert.ok(statusRes.outputs[0].text.indexOf("northwind") !== -1);

  const helpRes = submitMysqlLine(session, "\\h");
  assert.equal(helpRes.outputs[0].kind, "help");
  assert.ok(helpRes.outputs[0].text.indexOf("List of all MySQL commands:") !== -1);
  assert.equal(helpRes.outputs[0].text.indexOf("pager"), -1);

  const beforeConn = session.connectionId;
  const resetRes = submitMysqlLine(session, "\\x");
  assert.equal(resetRes.reconnected, true);
  assert.equal(session.connectionId, beforeConn + 1);

  const charsetRes = submitMysqlLine(session, "\\C utf8mb4");
  assert.equal(charsetRes.outputs[0].kind, "text");
  assert.equal(charsetRes.outputs[0].text, "Charset changed");

  // Multiline accumulation + \c abort
  const partial = submitMysqlLine(session, "SELECT 1");
  assert.equal(partial.promptType, "continue");
  assert.equal(detectPromptType("SELECT 'open"), "singleQuote");
  const aborted = submitMysqlLine(session, "\\c");
  assert.equal(aborted.promptType, "main");
  assert.equal(session.buffer, "");

  const bye = submitMysqlLine(session, "\\q");
  assert.equal(bye.exited, true);
  assert.equal(bye.outputs[0].kind, "bye");
});

test("MySQL: regression tests for \\R prompt vs \\r reconnect and LEFT JOIN NULL columns", () => {
  const session = createMysqlSession("university");
  const initialConnId = session.connectionId;

  // \R sets custom prompt (must NOT be intercepted by \r reconnect)
  const promptSet = submitMysqlLine(session, "\\R prod>");
  assert.equal(promptSet.outputs[0].kind, "text");
  assert.ok(promptSet.outputs[0].text.indexOf("PROMPT set to 'prod> '") !== -1);
  assert.equal(promptSet.prompt, "prod> ");

  // Reset back with bare \R
  const promptReset = submitMysqlLine(session, "\\R");
  assert.equal(promptReset.prompt, "mysql> ");

  // \r reconnect increments connectionId and switches DB when given
  const reconn = submitMysqlLine(session, "\\r northwind");
  assert.equal(reconn.reconnected, true);
  assert.equal(reconn.currentDb, "northwind");
  assert.equal(session.connectionId, initialConnId + 1);

  // LEFT JOIN where an order matches or customer has no orders: test schema-based unqualified resolution
  const prep = executeMysqlInput(
    session,
    "CREATE TABLE lj_left (id INT PRIMARY KEY, lval VARCHAR(20));" +
      "CREATE TABLE lj_right (rid INT PRIMARY KEY, left_id INT, rval VARCHAR(20));" +
      "INSERT INTO lj_left VALUES (1, 'has_match'), (2, 'no_match');" +
      "INSERT INTO lj_right VALUES (10, 1, 'matched');"
  );
  assert.equal(prep.outputs.some((o) => o.kind === "error"), false);

  const leftJoin = executeMysqlInput(
    session,
    "SELECT id, lval, rid, rval FROM lj_left LEFT JOIN lj_right ON lj_left.id = lj_right.left_id ORDER BY id;"
  );
  assert.equal(leftJoin.outputs[0].kind, "table", leftJoin.outputs[0].text);
  assert.ok(leftJoin.outputs[0].text.indexOf("matched") !== -1);
  assert.ok(leftJoin.outputs[0].text.indexOf("NULL") !== -1);
  // IS_NUM column rid is right-aligned even for NULL ("| NULL |")
  assert.ok(leftJoin.outputs[0].text.indexOf("|   10 |") !== -1);
  assert.ok(leftJoin.outputs[0].text.indexOf("| NULL |") !== -1);

  // Unknown column still produces ERROR 1054
  const badCol = executeMysqlInput(
    session,
    "SELECT no_such_col FROM lj_left LEFT JOIN lj_right ON lj_left.id = lj_right.left_id;"
  );
  assert.equal(badCol.outputs[0].kind, "error");
  assert.ok(badCol.outputs[0].text.indexOf("ERROR 1054") !== -1);
});

test("MySQL: enforces ERROR 1046/1049/1146/1064, DML/aggregations, helpers, and completions", () => {
  const session = createMysqlSession();

  const noDb = executeMysqlInput(session, "SELECT * FROM shippers;");
  assert.equal(noDb.outputs[0].kind, "error");
  assert.ok(noDb.outputs[0].text.indexOf("ERROR 1046") !== -1);

  const badDb = executeMysqlInput(session, "USE missing_db;");
  assert.equal(badDb.outputs[0].kind, "error");
  assert.ok(badDb.outputs[0].text.indexOf("ERROR 1049") !== -1);

  executeMysqlInput(session, "USE company;");

  const badTbl = executeMysqlInput(session, "SELECT * FROM ghost_table;");
  assert.equal(badTbl.outputs[0].kind, "error");
  assert.ok(badTbl.outputs[0].text.indexOf("ERROR 1146") !== -1);

  const badSql = executeMysqlInput(session, "FROBULATE TABLE employees;");
  assert.equal(badSql.outputs[0].kind, "error");
  assert.ok(badSql.outputs[0].text.indexOf("ERROR 1064") !== -1);

  const agg = executeMysqlInput(
    session,
    "SELECT dept_id, COUNT(*) AS cnt FROM employees GROUP BY dept_id HAVING COUNT(*) >= 1 ORDER BY dept_id;"
  );
  assert.equal(agg.outputs[0].kind, "table");

  const ascii = formatAsciiTable(["id", "name"], [[1, "Alpha"]], [true, false]);
  assert.ok(ascii.indexOf("|  1 | Alpha |") !== -1);
  const nullableAscii = formatAsciiTable(
    ["n", "s"],
    [
      [42, "hi"],
      [null, null],
    ],
    [true, false],
    [true, true]
  );
  assert.ok(nullableAscii.indexOf("|   42 | hi   |") !== -1);
  assert.ok(nullableAscii.indexOf("| NULL | NULL |") !== -1);
  const vert = formatVerticalRows(["id"], [[1]]);
  assert.ok(vert.indexOf("1. row") !== -1);

  const split = splitMysqlBuffer("SELECT 1; SELECT 'x;y';");
  assert.equal(split.statements.length, 2);

  const completions = getMysqlCompletions(session, "emp");
  assert.ok(completions.indexOf("employees") !== -1);

  const emptyLine = submitMysqlLine(session, "   ");
  assert.equal(emptyLine.outputs.length, 0);
});
