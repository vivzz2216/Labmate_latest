import { hasRealSqlite, runRealBatch } from "./sqliteReal";

export type SqlValue = string | number | boolean | null;

export interface ColumnSchema {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  defaultValue: SqlValue;
  unique?: boolean;
  definitionSql: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  rows: Record<string, SqlValue>[];
  createSql: string;
}

export interface IndexSchema {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  createSql: string;
}

export interface ViewSchema {
  name: string;
  selectSql: string;
  createSql: string;
}

export interface TriggerSchema {
  name: string;
  tableName: string;
  createSql: string;
}

export interface PragmaState {
  foreign_keys: boolean;
  journal_mode: "delete" | "truncate" | "persist" | "memory" | "wal" | "off";
  synchronous: "OFF" | "NORMAL" | "FULL" | "EXTRA";
  encoding: "UTF-8" | "UTF-16" | "UTF-16le" | "UTF-16be";
  cache_size: number;
  page_size: number;
  temp_store: "DEFAULT" | "FILE" | "MEMORY";
  auto_vacuum: "NONE" | "FULL" | "INCREMENTAL";
  locking_mode: "NORMAL" | "EXCLUSIVE";
  recursive_triggers: boolean;
  user_version: number;
  schema_version: number;
}

export interface SqlSnapshot {
  dbPath: string;
  dbName: string;
  tables: Record<string, TableSchema>;
  tableOrder: string[];
  indices: IndexSchema[];
  views: ViewSchema[];
  triggers: TriggerSchema[];
  pragmas: PragmaState;
}

export interface SqlLogEntry {
  id: number;
  timestamp: string;
  source: "User" | "DB Browser";
  sql: string;
  status: "ok" | "error";
  message: string;
}

export interface DatabaseState {
  committed: SqlSnapshot;
  working: SqlSnapshot;
  dirty: boolean;
  attachedDatabases: { alias: string; path: string }[];
  sqlLog: SqlLogEntry[];
  nextLogId: number;
}

export interface StatementResult {
  sql: string;
  startLine: number;
  ok: boolean;
  isQuery: boolean;
  columns: string[];
  rows: SqlValue[][];
  rowsAffected: number;
  elapsedMs: number;
  message: string;
  error?: string;
  editableTable?: string;
  sourceRowIndices?: number[];
}

export interface BatchExecutionResult {
  ok: boolean;
  statements: StatementResult[];
  lastQueryResult: StatementResult | null;
  summaryText: string;
  totalElapsedMs: number;
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number): string => (n < 10 ? "0" + String(n) : String(n));
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  );
}

export function getDefaultPragmas(): PragmaState {
  return {
    foreign_keys: true,
    journal_mode: "delete",
    synchronous: "FULL",
    encoding: "UTF-8",
    cache_size: -2000,
    page_size: 4096,
    temp_store: "DEFAULT",
    auto_vacuum: "NONE",
    locking_mode: "NORMAL",
    recursive_triggers: false,
    user_version: 0,
    schema_version: 11,
  };
}

function buildNorthwindSnapshot(): SqlSnapshot {
  const tables: Record<string, TableSchema> = {};

  tables["Category"] = {
    name: "Category",
    createSql:
      "CREATE TABLE Category ( categoryId INTEGER PRIMARY KEY AUTOINCREMENT, categoryName VARCHAR(15) NOT NULL, description TEXT, picture BLOB )",
    columns: [
      {
        name: "categoryId",
        type: "INTEGER",
        notNull: false,
        primaryKey: true,
        autoIncrement: true,
        defaultValue: null,
        definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT",
      },
      {
        name: "categoryName",
        type: "VARCHAR(15)",
        notNull: true,
        primaryKey: false,
        autoIncrement: false,
        defaultValue: null,
        definitionSql: "VARCHAR(15) NOT NULL",
      },
      {
        name: "description",
        type: "TEXT",
        notNull: false,
        primaryKey: false,
        autoIncrement: false,
        defaultValue: null,
        definitionSql: "TEXT",
      },
      {
        name: "picture",
        type: "BLOB",
        notNull: false,
        primaryKey: false,
        autoIncrement: false,
        defaultValue: null,
        definitionSql: "BLOB",
      },
    ],
    rows: [
      { categoryId: 1, categoryName: "Beverages", description: "Soft drinks, coffees, teas, beers, and ales", picture: null },
      { categoryId: 2, categoryName: "Condiments", description: "Sweet and savory sauces, relishes, spreads, and seasonings", picture: null },
      { categoryId: 3, categoryName: "Confections", description: "Desserts, candies, and sweet breads", picture: null },
      { categoryId: 4, categoryName: "Dairy Products", description: "Cheeses", picture: null },
      { categoryId: 5, categoryName: "Grains/Cereals", description: "Breads, crackers, pasta, and cereal", picture: null },
      { categoryId: 6, categoryName: "Meat/Poultry", description: "Prepared meats", picture: null },
      { categoryId: 7, categoryName: "Produce", description: "Dried fruit and bean curd", picture: null },
      { categoryId: 8, categoryName: "Seafood", description: "Seaweed and fish", picture: null },
    ],
  };

  tables["Customer"] = {
    name: "Customer",
    createSql:
      "CREATE TABLE Customer ( customerId VARCHAR(15) PRIMARY KEY NOT NULL, companyName VARCHAR(40) NOT NULL, contactName VARCHAR(30), contactTitle VARCHAR(30), address VARCHAR(60), city VARCHAR(15), region VARCHAR(15), postalCode VARCHAR(10), country VARCHAR(15), phone VARCHAR(24), fax VARCHAR(24) )",
    columns: [
      { name: "customerId", type: "VARCHAR(15)", notNull: true, primaryKey: true, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15) PRIMARY KEY NOT NULL" },
      { name: "companyName", type: "VARCHAR(40)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(40) NOT NULL" },
      { name: "contactName", type: "VARCHAR(30)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(30)" },
      { name: "contactTitle", type: "VARCHAR(30)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(30)" },
      { name: "address", type: "VARCHAR(60)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(60)" },
      { name: "city", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "region", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "postalCode", type: "VARCHAR(10)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(10)" },
      { name: "country", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "phone", type: "VARCHAR(24)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(24)" },
      { name: "fax", type: "VARCHAR(24)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(24)" },
    ],
    rows: [
      { customerId: "ALFKI", companyName: "Alfreds Futterkiste", contactName: "Maria Anders", contactTitle: "Sales Representative", address: "Obere Str. 57", city: "Berlin", region: null, postalCode: "12209", country: "Germany", phone: "030-0074321", fax: "030-0076545" },
      { customerId: "ANATR", companyName: "Ana Trujillo Emparedados y helados", contactName: "Ana Trujillo", contactTitle: "Owner", address: "Avda. de la Constitucion 2222", city: "Mexico D.F.", region: null, postalCode: "05021", country: "Mexico", phone: "(5) 555-4729", fax: "(5) 555-3745" },
      { customerId: "ANTON", companyName: "Antonio Moreno Taqueria", contactName: "Antonio Moreno", contactTitle: "Owner", address: "Mataderos 2312", city: "Mexico D.F.", region: null, postalCode: "05023", country: "Mexico", phone: "(5) 555-3932", fax: null },
      { customerId: "AROUT", companyName: "Around the Horn", contactName: "Thomas Hardy", contactTitle: "Sales Representative", address: "120 Hanover Sq.", city: "London", region: null, postalCode: "WA1 1DP", country: "UK", phone: "(171) 555-7788", fax: "(171) 555-6750" },
      { customerId: "BERGS", companyName: "Berglunds snabbkop", contactName: "Christina Berglund", contactTitle: "Order Administrator", address: "Berguvsvagen 8", city: "Lulea", region: null, postalCode: "S-958 22", country: "Sweden", phone: "0921-12 34 65", fax: "0921-12 34 67" },
      { customerId: "BLAUS", companyName: "Blauer See Delikatessen", contactName: "Hanna Moos", contactTitle: "Sales Representative", address: "Forsterstr. 57", city: "Mannheim", region: null, postalCode: "68306", country: "Germany", phone: "0621-08460", fax: "0621-08924" },
      { customerId: "BLONP", companyName: "Blondesddsl pere et fils", contactName: "Frederique Citeaux", contactTitle: "Marketing Manager", address: "24, place Kleber", city: "Strasbourg", region: null, postalCode: "67000", country: "France", phone: "88.60.15.31", fax: "88.60.15.32" },
      { customerId: "BOLID", companyName: "Bolido Comidas preparadas", contactName: "Martin Sommer", contactTitle: "Owner", address: "C/ Araquil, 67", city: "Madrid", region: null, postalCode: "28023", country: "Spain", phone: "(91) 555 22 82", fax: "(91) 555 91 99" },
      { customerId: "BONAP", companyName: "Bon app'", contactName: "Laurence Lebihan", contactTitle: "Owner", address: "12, rue des Bouchers", city: "Marseille", region: null, postalCode: "13008", country: "France", phone: "91.24.45.40", fax: "91.24.45.41" },
      { customerId: "BOTTM", companyName: "Bottom-Dollar Markets", contactName: "Elizabeth Lincoln", contactTitle: "Accounting Manager", address: "23 Tsawassen Blvd.", city: "Tsawassen", region: "BC", postalCode: "T2F 8M4", country: "Canada", phone: "(604) 555-4729", fax: "(604) 555-3745" },
      { customerId: "BSBEV", companyName: "B's Beverages", contactName: "Victoria Ashworth", contactTitle: "Sales Representative", address: "Fauntleroy Circus", city: "London", region: null, postalCode: "EC2 5NT", country: "UK", phone: "(171) 555-1212", fax: null },
      { customerId: "CACTU", companyName: "Cactus Comidas para llevar", contactName: "Patricio Simpson", contactTitle: "Sales Agent", address: "Cerrito 333", city: "Buenos Aires", region: null, postalCode: "1010", country: "Argentina", phone: "(1) 135-5555", fax: "(1) 135-4892" },
    ],
  };

  tables["Employee"] = {
    name: "Employee",
    createSql:
      "CREATE TABLE Employee ( employeeId INTEGER PRIMARY KEY AUTOINCREMENT, lastname VARCHAR(20) NOT NULL, firstname VARCHAR(10) NOT NULL, title VARCHAR(30), titleOfCourtesy VARCHAR(25), birthDate DATETIME, hireDate DATETIME, address VARCHAR(60), city VARCHAR(15), region VARCHAR(15), postalCode VARCHAR(10), country VARCHAR(15), phone VARCHAR(24), extension VARCHAR(4), photo BLOB, notes TEXT, mgrId INT, photoPath VARCHAR(255) )",
    columns: [
      { name: "employeeId", type: "INTEGER", notNull: false, primaryKey: true, autoIncrement: true, defaultValue: null, definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "lastname", type: "VARCHAR(20)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(20) NOT NULL" },
      { name: "firstname", type: "VARCHAR(10)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(10) NOT NULL" },
      { name: "title", type: "VARCHAR(30)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(30)" },
      { name: "titleOfCourtesy", type: "VARCHAR(25)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(25)" },
      { name: "birthDate", type: "DATETIME", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DATETIME" },
      { name: "hireDate", type: "DATETIME", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DATETIME" },
      { name: "address", type: "VARCHAR(60)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(60)" },
      { name: "city", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "region", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "postalCode", type: "VARCHAR(10)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(10)" },
      { name: "country", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "phone", type: "VARCHAR(24)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(24)" },
      { name: "extension", type: "VARCHAR(4)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(4)" },
      { name: "photo", type: "BLOB", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "BLOB" },
      { name: "notes", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
      { name: "mgrId", type: "INT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT" },
      { name: "photoPath", type: "VARCHAR(255)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(255)" },
    ],
    rows: [
      { employeeId: 1, lastname: "Davolio", firstname: "Nancy", title: "Sales Representative", titleOfCourtesy: "Ms.", birthDate: "1968-12-08", hireDate: "2002-05-01", address: "507 - 20th Ave. E. Apt. 2A", city: "Seattle", region: "WA", postalCode: "98122", country: "USA", phone: "(206) 555-9857", extension: "5467", photo: null, notes: "Education includes a BA in psychology from Colorado State University.", mgrId: 2, photoPath: "http://accweb/emmployees/davolio.bmp" },
      { employeeId: 2, lastname: "Fuller", firstname: "Andrew", title: "Vice President, Sales", titleOfCourtesy: "Dr.", birthDate: "1952-02-19", hireDate: "2002-08-14", address: "908 W. Capital Way", city: "Tacoma", region: "WA", postalCode: "98401", country: "USA", phone: "(206) 555-9482", extension: "3457", photo: null, notes: "Andrew received his BTS commercial in 1974 and a Ph.D. in international marketing.", mgrId: null, photoPath: "http://accweb/emmployees/fuller.bmp" },
      { employeeId: 3, lastname: "Leverling", firstname: "Janet", title: "Sales Representative", titleOfCourtesy: "Ms.", birthDate: "1963-08-30", hireDate: "2002-04-01", address: "722 Moss Bay Blvd.", city: "Kirkland", region: "WA", postalCode: "98033", country: "USA", phone: "(206) 555-3412", extension: "3355", photo: null, notes: "Janet has a BS degree in chemistry from Boston College.", mgrId: 2, photoPath: "http://accweb/emmployees/leverling.bmp" },
      { employeeId: 4, lastname: "Peacock", firstname: "Margaret", title: "Sales Representative", titleOfCourtesy: "Mrs.", birthDate: "1957-09-19", hireDate: "2003-05-03", address: "4110 Old Redmond Rd.", city: "Redmond", region: "WA", postalCode: "98052", country: "USA", phone: "(206) 555-8122", extension: "5176", photo: null, notes: "Margaret holds a BA in English literature from Concordia College.", mgrId: 2, photoPath: "http://accweb/emmployees/peacock.bmp" },
      { employeeId: 5, lastname: "Buchanan", firstname: "Steven", title: "Sales Manager", titleOfCourtesy: "Mr.", birthDate: "1955-03-04", hireDate: "2003-10-17", address: "14 Garrett Hill", city: "London", region: null, postalCode: "SW1 8JR", country: "UK", phone: "(71) 555-4848", extension: "3453", photo: null, notes: "Steven Buchanan graduated from St. Andrews University, Scotland.", mgrId: 2, photoPath: "http://accweb/emmployees/buchanan.bmp" },
      { employeeId: 6, lastname: "Suyama", firstname: "Michael", title: "Sales Representative", titleOfCourtesy: "Mr.", birthDate: "1963-07-02", hireDate: "2003-10-17", address: "Coventry House Miner Rd.", city: "London", region: null, postalCode: "EC2 7JR", country: "UK", phone: "(71) 555-7773", extension: "428", photo: null, notes: "Michael is a graduate of Sussex University.", mgrId: 5, photoPath: "http://accweb/emmployees/suyama.bmp" },
      { employeeId: 7, lastname: "King", firstname: "Robert", title: "Sales Representative", titleOfCourtesy: "Mr.", birthDate: "1960-05-29", hireDate: "2004-01-02", address: "Edgeham Hollow Winchester Way", city: "London", region: null, postalCode: "RG1 9SP", country: "UK", phone: "(71) 555-5598", extension: "465", photo: null, notes: "Robert King served in the Peace Corps and traveled extensively.", mgrId: 5, photoPath: "http://accweb/emmployees/king.bmp" },
      { employeeId: 8, lastname: "Callahan", firstname: "Laura", title: "Inside Sales Coordinator", titleOfCourtesy: "Ms.", birthDate: "1958-01-09", hireDate: "2004-03-05", address: "4726 - 11th Ave. N.E.", city: "Seattle", region: "WA", postalCode: "98105", country: "USA", phone: "(206) 555-1189", extension: "2344", photo: null, notes: "Laura received a BA in psychology from the University of Washington.", mgrId: 2, photoPath: "http://accweb/emmployees/callahan.bmp" },
      { employeeId: 9, lastname: "Dodsworth", firstname: "Anne", title: "Sales Representative", titleOfCourtesy: "Ms.", birthDate: "1966-01-27", hireDate: "2004-11-15", address: "7 Houndstooth Rd.", city: "London", region: null, postalCode: "WG2 7LT", country: "UK", phone: "(71) 555-4444", extension: "452", photo: null, notes: "Anne has a BA degree in English from St. Lawrence College.", mgrId: 5, photoPath: "http://accweb/emmployees/dodsworth.bmp" },
    ],
  };

  tables["OrderDetail"] = {
    name: "OrderDetail",
    createSql:
      "CREATE TABLE OrderDetail ( orderId INT NOT NULL, productId INT NOT NULL, unitPrice DECIMAL(10, 2) NOT NULL, quantity SMALLINT NOT NULL, discount DECIMAL(10, 2) NOT NULL )",
    columns: [
      { name: "orderId", type: "INT", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT NOT NULL" },
      { name: "productId", type: "INT", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT NOT NULL" },
      { name: "unitPrice", type: "DECIMAL(10, 2)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DECIMAL(10, 2) NOT NULL" },
      { name: "quantity", type: "SMALLINT", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "SMALLINT NOT NULL" },
      { name: "discount", type: "DECIMAL(10, 2)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DECIMAL(10, 2) NOT NULL" },
    ],
    rows: [
      { orderId: 10248, productId: 11, unitPrice: 14, quantity: 12, discount: 0 },
      { orderId: 10248, productId: 42, unitPrice: 9.8, quantity: 10, discount: 0 },
      { orderId: 10248, productId: 72, unitPrice: 34.8, quantity: 5, discount: 0 },
      { orderId: 10249, productId: 14, unitPrice: 18.6, quantity: 9, discount: 0 },
      { orderId: 10249, productId: 51, unitPrice: 42.4, quantity: 40, discount: 0 },
      { orderId: 10250, productId: 41, unitPrice: 7.7, quantity: 10, discount: 0 },
      { orderId: 10250, productId: 51, unitPrice: 42.4, quantity: 35, discount: 0.15 },
      { orderId: 10250, productId: 65, unitPrice: 16.8, quantity: 15, discount: 0.15 },
      { orderId: 10251, productId: 22, unitPrice: 16.8, quantity: 6, discount: 0.05 },
      { orderId: 10251, productId: 57, unitPrice: 15.6, quantity: 15, discount: 0.05 },
      { orderId: 10251, productId: 65, unitPrice: 16.8, quantity: 20, discount: 0 },
      { orderId: 10252, productId: 20, unitPrice: 64.8, quantity: 40, discount: 0.05 },
      { orderId: 10252, productId: 33, unitPrice: 2, quantity: 25, discount: 0.05 },
      { orderId: 10252, productId: 60, unitPrice: 27.2, quantity: 40, discount: 0 },
      { orderId: 10253, productId: 31, unitPrice: 10, quantity: 20, discount: 0 },
      { orderId: 10253, productId: 39, unitPrice: 14.4, quantity: 42, discount: 0 },
      { orderId: 10253, productId: 49, unitPrice: 16, quantity: 40, discount: 0 },
      { orderId: 10254, productId: 24, unitPrice: 3.6, quantity: 15, discount: 0.15 },
      { orderId: 10254, productId: 55, unitPrice: 19.2, quantity: 21, discount: 0.15 },
      { orderId: 10254, productId: 74, unitPrice: 8, quantity: 21, discount: 0 },
    ],
  };

  tables["Product"] = {
    name: "Product",
    createSql:
      "CREATE TABLE Product ( productId INTEGER PRIMARY KEY AUTOINCREMENT, productName VARCHAR(40) NOT NULL, supplierId INT, categoryId INT, quantityPerUnit VARCHAR(20), unitPrice DECIMAL(10, 2), unitsInStock SMALLINT, unitsOnOrder SMALLINT, reorderLevel SMALLINT, discontinued CHAR(1) NOT NULL )",
    columns: [
      { name: "productId", type: "INTEGER", notNull: false, primaryKey: true, autoIncrement: true, defaultValue: null, definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "productName", type: "VARCHAR(40)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(40) NOT NULL" },
      { name: "supplierId", type: "INT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT" },
      { name: "categoryId", type: "INT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT" },
      { name: "quantityPerUnit", type: "VARCHAR(20)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(20)" },
      { name: "unitPrice", type: "DECIMAL(10, 2)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DECIMAL(10, 2)" },
      { name: "unitsInStock", type: "SMALLINT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "SMALLINT" },
      { name: "unitsOnOrder", type: "SMALLINT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "SMALLINT" },
      { name: "reorderLevel", type: "SMALLINT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "SMALLINT" },
      { name: "discontinued", type: "CHAR(1)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: "0", definitionSql: "CHAR(1) NOT NULL" },
    ],
    rows: [
      { productId: 1, productName: "Chai", supplierId: 1, categoryId: 1, quantityPerUnit: "10 boxes x 20 bags", unitPrice: 18, unitsInStock: 39, unitsOnOrder: 0, reorderLevel: 10, discontinued: "0" },
      { productId: 2, productName: "Chang", supplierId: 1, categoryId: 1, quantityPerUnit: "24 - 12 oz bottles", unitPrice: 19, unitsInStock: 17, unitsOnOrder: 40, reorderLevel: 25, discontinued: "0" },
      { productId: 3, productName: "Aniseed Syrup", supplierId: 1, categoryId: 2, quantityPerUnit: "12 - 550 ml bottles", unitPrice: 10, unitsInStock: 13, unitsOnOrder: 70, reorderLevel: 25, discontinued: "0" },
      { productId: 4, productName: "Chef Anton's Cajun Seasoning", supplierId: 2, categoryId: 2, quantityPerUnit: "48 - 6 oz jars", unitPrice: 22, unitsInStock: 53, unitsOnOrder: 0, reorderLevel: 0, discontinued: "0" },
      { productId: 5, productName: "Chef Anton's Gumbo Mix", supplierId: 2, categoryId: 2, quantityPerUnit: "36 boxes", unitPrice: 21.35, unitsInStock: 0, unitsOnOrder: 0, reorderLevel: 0, discontinued: "1" },
      { productId: 6, productName: "Grandma's Boysenberry Spread", supplierId: 3, categoryId: 2, quantityPerUnit: "12 - 8 oz jars", unitPrice: 25, unitsInStock: 120, unitsOnOrder: 0, reorderLevel: 25, discontinued: "0" },
      { productId: 7, productName: "Uncle Bob's Organic Dried Pears", supplierId: 3, categoryId: 7, quantityPerUnit: "12 - 1 lb pkgs.", unitPrice: 30, unitsInStock: 15, unitsOnOrder: 0, reorderLevel: 10, discontinued: "0" },
      { productId: 8, productName: "Northwoods Cranberry Sauce", supplierId: 3, categoryId: 2, quantityPerUnit: "12 - 12 oz jars", unitPrice: 40, unitsInStock: 6, unitsOnOrder: 0, reorderLevel: 0, discontinued: "0" },
      { productId: 9, productName: "Mishi Kobe Niku", supplierId: 4, categoryId: 6, quantityPerUnit: "18 - 500 g pkgs.", unitPrice: 97, unitsInStock: 29, unitsOnOrder: 0, reorderLevel: 0, discontinued: "1" },
      { productId: 10, productName: "Ikura", supplierId: 4, categoryId: 8, quantityPerUnit: "12 - 200 ml jars", unitPrice: 31, unitsInStock: 31, unitsOnOrder: 0, reorderLevel: 0, discontinued: "0" },
      { productId: 11, productName: "Queso Cabrales", supplierId: 5, categoryId: 4, quantityPerUnit: "1 kg pkg.", unitPrice: 21, unitsInStock: 22, unitsOnOrder: 30, reorderLevel: 30, discontinued: "0" },
      { productId: 14, productName: "Tofu", supplierId: 6, categoryId: 7, quantityPerUnit: "40 - 100 g pkgs.", unitPrice: 23.25, unitsInStock: 35, unitsOnOrder: 0, reorderLevel: 0, discontinued: "0" },
      { productId: 20, productName: "Sir Rodney's Marmalade", supplierId: 8, categoryId: 3, quantityPerUnit: "30 gift boxes", unitPrice: 81, unitsInStock: 40, unitsOnOrder: 0, reorderLevel: 0, discontinued: "0" },
      { productId: 22, productName: "Gustaf's Knackebrod", supplierId: 9, categoryId: 5, quantityPerUnit: "24 - 500 g pkgs.", unitPrice: 21, unitsInStock: 104, unitsOnOrder: 0, reorderLevel: 25, discontinued: "0" },
      { productId: 33, productName: "Geitost", supplierId: 15, categoryId: 4, quantityPerUnit: "500 g", unitPrice: 2.5, unitsInStock: 112, unitsOnOrder: 0, reorderLevel: 20, discontinued: "0" },
      { productId: 42, productName: "Singaporean Hokkien Fried Mee", supplierId: 20, categoryId: 5, quantityPerUnit: "32 - 1 kg pkgs.", unitPrice: 14, unitsInStock: 26, unitsOnOrder: 0, reorderLevel: 0, discontinued: "1" },
      { productId: 51, productName: "Manjimup Dried Apples", supplierId: 24, categoryId: 7, quantityPerUnit: "50 - 300 g pkgs.", unitPrice: 53, unitsInStock: 20, unitsOnOrder: 0, reorderLevel: 10, discontinued: "0" },
      { productId: 72, productName: "Mozzarella di Giovanni", supplierId: 14, categoryId: 4, quantityPerUnit: "24 - 200 g pkgs.", unitPrice: 34.8, unitsInStock: 14, unitsOnOrder: 0, reorderLevel: 0, discontinued: "0" },
    ],
  };

  tables["SalesOrder"] = {
    name: "SalesOrder",
    createSql:
      "CREATE TABLE SalesOrder ( orderId INTEGER PRIMARY KEY AUTOINCREMENT, custId VARCHAR(15), employeeId INT, orderDate DATETIME, requiredDate DATETIME, shippedDate DATETIME, shipperId INT, freight DECIMAL(10, 2), shipName VARCHAR(40), shipAddress VARCHAR(60), shipCity VARCHAR(15), shipRegion VARCHAR(15), shipPostalCode VARCHAR(10), shipCountry VARCHAR(15) )",
    columns: [
      { name: "orderId", type: "INTEGER", notNull: false, primaryKey: true, autoIncrement: true, defaultValue: null, definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "custId", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "employeeId", type: "INT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT" },
      { name: "orderDate", type: "DATETIME", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DATETIME" },
      { name: "requiredDate", type: "DATETIME", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DATETIME" },
      { name: "shippedDate", type: "DATETIME", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DATETIME" },
      { name: "shipperId", type: "INT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT" },
      { name: "freight", type: "DECIMAL(10, 2)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "DECIMAL(10, 2)" },
      { name: "shipName", type: "VARCHAR(40)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(40)" },
      { name: "shipAddress", type: "VARCHAR(60)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(60)" },
      { name: "shipCity", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "shipRegion", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "shipPostalCode", type: "VARCHAR(10)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(10)" },
      { name: "shipCountry", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
    ],
    rows: [
      { orderId: 10248, custId: "ALFKI", employeeId: 5, orderDate: "2006-07-04", requiredDate: "2006-08-01", shippedDate: "2006-07-16", shipperId: 3, freight: 32.38, shipName: "Vins et alcools Chevalier", shipAddress: "59 rue de l'Abbaye", shipCity: "Reims", shipRegion: null, shipPostalCode: "51100", shipCountry: "France" },
      { orderId: 10249, custId: "ANATR", employeeId: 6, orderDate: "2006-07-05", requiredDate: "2006-08-16", shippedDate: "2006-07-10", shipperId: 1, freight: 11.61, shipName: "Toms Spezialitaten", shipAddress: "Luisenstr. 48", shipCity: "Munster", shipRegion: null, shipPostalCode: "44087", shipCountry: "Germany" },
      { orderId: 10250, custId: "ANTON", employeeId: 4, orderDate: "2006-07-08", requiredDate: "2006-08-05", shippedDate: "2006-07-12", shipperId: 2, freight: 65.83, shipName: "Hanari Carnes", shipAddress: "Rua do Paco, 67", shipCity: "Rio de Janeiro", shipRegion: "RJ", shipPostalCode: "05454-876", shipCountry: "Brazil" },
      { orderId: 10251, custId: "AROUT", employeeId: 3, orderDate: "2006-07-08", requiredDate: "2006-08-05", shippedDate: "2006-07-15", shipperId: 1, freight: 41.34, shipName: "Victuailles en stock", shipAddress: "2, rue du Commerce", shipCity: "Lyon", shipRegion: null, shipPostalCode: "69004", shipCountry: "France" },
      { orderId: 10252, custId: "BERGS", employeeId: 4, orderDate: "2006-07-09", requiredDate: "2006-08-06", shippedDate: "2006-07-11", shipperId: 2, freight: 51.3, shipName: "Supremes delices", shipAddress: "Boulevard Tirou, 255", shipCity: "Charleroi", shipRegion: null, shipPostalCode: "B-6000", shipCountry: "Belgium" },
      { orderId: 10253, custId: "BLAUS", employeeId: 3, orderDate: "2006-07-10", requiredDate: "2006-07-24", shippedDate: "2006-07-16", shipperId: 2, freight: 58.17, shipName: "Hanari Carnes", shipAddress: "Rua do Paco, 67", shipCity: "Rio de Janeiro", shipRegion: "RJ", shipPostalCode: "05454-876", shipCountry: "Brazil" },
      { orderId: 10254, custId: "BLONP", employeeId: 5, orderDate: "2006-07-11", requiredDate: "2006-08-08", shippedDate: "2006-07-23", shipperId: 2, freight: 22.98, shipName: "Chop-suey Chinese", shipAddress: "Hauptstr. 31", shipCity: "Bern", shipRegion: null, shipPostalCode: "3012", shipCountry: "Switzerland" },
      { orderId: 10255, custId: "BOLID", employeeId: 9, orderDate: "2006-07-12", requiredDate: "2006-08-09", shippedDate: "2006-07-15", shipperId: 3, freight: 148.33, shipName: "Richter Supermarkt", shipAddress: "Starenweg 5", shipCity: "Geneve", shipRegion: null, shipPostalCode: "1204", shipCountry: "Switzerland" },
      { orderId: 10256, custId: "BONAP", employeeId: 3, orderDate: "2006-07-15", requiredDate: "2006-08-12", shippedDate: "2006-07-17", shipperId: 2, freight: 13.97, shipName: "Wellington Importadora", shipAddress: "Rua do Mercado, 12", shipCity: "Resende", shipRegion: "SP", shipPostalCode: "08737-363", shipCountry: "Brazil" },
      { orderId: 10257, custId: "BOTTM", employeeId: 4, orderDate: "2006-07-16", requiredDate: "2006-08-13", shippedDate: "2006-07-22", shipperId: 3, freight: 81.91, shipName: "HILARION-Abastos", shipAddress: "Carrera 22 con Ave. Carlos Soublette", shipCity: "San Cristobal", shipRegion: "Tachira", shipPostalCode: "5022", shipCountry: "Venezuela" },
    ],
  };

  tables["Shipper"] = {
    name: "Shipper",
    createSql:
      "CREATE TABLE Shipper ( shipperId INTEGER PRIMARY KEY AUTOINCREMENT, companyName VARCHAR(40) NOT NULL, phone VARCHAR(44) )",
    columns: [
      {
        name: "shipperId",
        type: "INTEGER",
        notNull: false,
        primaryKey: true,
        autoIncrement: true,
        defaultValue: null,
        definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT",
      },
      {
        name: "companyName",
        type: "VARCHAR(40)",
        notNull: true,
        primaryKey: false,
        autoIncrement: false,
        defaultValue: null,
        definitionSql: "VARCHAR(40) NOT NULL",
      },
      {
        name: "phone",
        type: "VARCHAR(44)",
        notNull: false,
        primaryKey: false,
        autoIncrement: false,
        defaultValue: null,
        definitionSql: "VARCHAR(44)",
      },
    ],
    rows: [
      { shipperId: 1, companyName: "Speedy Express", phone: "(503) 555-9831" },
      { shipperId: 2, companyName: "United Package", phone: "(503) 555-3199" },
      { shipperId: 3, companyName: "Federal Shipping", phone: "(503) 555-9931" },
      { shipperId: 4, companyName: "Alliance Shipper", phone: "1-800-222-0451" },
      { shipperId: 5, companyName: "UPS", phone: "1-800-782-7892" },
      { shipperId: 6, companyName: "DHL", phone: "1-800-225-5345" },
    ],
  };

  tables["Supplier"] = {
    name: "Supplier",
    createSql:
      "CREATE TABLE Supplier ( supplierId INTEGER PRIMARY KEY AUTOINCREMENT, companyName VARCHAR(40) NOT NULL, contactName VARCHAR(30), contactTitle VARCHAR(30), address VARCHAR(60), city VARCHAR(15), region VARCHAR(15), postalCode VARCHAR(10), country VARCHAR(15), phone VARCHAR(24), fax VARCHAR(24), HomePage TEXT )",
    columns: [
      { name: "supplierId", type: "INTEGER", notNull: false, primaryKey: true, autoIncrement: true, defaultValue: null, definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "companyName", type: "VARCHAR(40)", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(40) NOT NULL" },
      { name: "contactName", type: "VARCHAR(30)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(30)" },
      { name: "contactTitle", type: "VARCHAR(30)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(30)" },
      { name: "address", type: "VARCHAR(60)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(60)" },
      { name: "city", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "region", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "postalCode", type: "VARCHAR(10)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(10)" },
      { name: "country", type: "VARCHAR(15)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(15)" },
      { name: "phone", type: "VARCHAR(24)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(24)" },
      { name: "fax", type: "VARCHAR(24)", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(24)" },
      { name: "HomePage", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
    ],
    rows: [
      { supplierId: 1, companyName: "Exotic Liquids", contactName: "Charlotte Cooper", contactTitle: "Purchasing Manager", address: "49 Gilbert St.", city: "London", region: null, postalCode: "EC1 4SD", country: "UK", phone: "(171) 555-2222", fax: null, HomePage: null },
      { supplierId: 2, companyName: "New Orleans Cajun Delights", contactName: "Shelley Burke", contactTitle: "Order Administrator", address: "P.O. Box 78934", city: "New Orleans", region: "LA", postalCode: "70117", country: "USA", phone: "(100) 555-4822", fax: null, HomePage: "#CAJUN.HTM#" },
      { supplierId: 3, companyName: "Grandma Kelly's Homestead", contactName: "Regina Murphy", contactTitle: "Sales Representative", address: "707 Oxford Rd.", city: "Ann Arbor", region: "MI", postalCode: "48104", country: "USA", phone: "(313) 555-5735", fax: "(313) 555-3349", HomePage: null },
      { supplierId: 4, companyName: "Tokyo Traders", contactName: "Yoshi Nagase", contactTitle: "Marketing Manager", address: "9-8 Sekimai Musashino-shi", city: "Tokyo", region: null, postalCode: "100", country: "Japan", phone: "(03) 3555-5011", fax: null, HomePage: null },
      { supplierId: 5, companyName: "Cooperativa de Quesos 'Las Cabras'", contactName: "Antonio del Valle Saavedra", contactTitle: "Export Administrator", address: "Calle del Rosal 4", city: "Oviedo", region: "Asturias", postalCode: "33007", country: "Spain", phone: "(98) 598 76 54", fax: null, HomePage: null },
      { supplierId: 6, companyName: "Mayumi's", contactName: "Mayumi Ohno", contactTitle: "Marketing Representative", address: "92 Setsuko Chuo-ku", city: "Osaka", region: null, postalCode: "545", country: "Japan", phone: "(06) 431-7877", fax: null, HomePage: "Mayumi's (on the World Wide Web)#http://www.microsoft.com/accessdev/sampleapps/mayumi.htm#" },
      { supplierId: 8, companyName: "Specialty Biscuits, Ltd.", contactName: "Peter Wilson", contactTitle: "Sales Representative", address: "29 King's Way", city: "Manchester", region: null, postalCode: "M14 GSD", country: "UK", phone: "(161) 555-4448", fax: null, HomePage: null },
      { supplierId: 9, companyName: "PB Knackebrod AB", contactName: "Lars Peterson", contactTitle: "Sales Agent", address: "Kaloadagatan 13", city: "Goteborg", region: null, postalCode: "S-345 67", country: "Sweden", phone: "031-987 65 43", fax: "031-987 65 91", HomePage: null },
    ],
  };

  tables["sqlite_sequence"] = {
    name: "sqlite_sequence",
    createSql: "CREATE TABLE sqlite_sequence(name,seq)",
    columns: [
      { name: "name", type: "", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "" },
      { name: "seq", type: "", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "" },
    ],
    rows: [
      { name: "Category", seq: 8 },
      { name: "Employee", seq: 9 },
      { name: "Product", seq: 77 },
      { name: "SalesOrder", seq: 11077 },
      { name: "Shipper", seq: 6 },
      { name: "Supplier", seq: 29 },
    ],
  };

  const tableOrder = [
    "Category",
    "Customer",
    "Employee",
    "OrderDetail",
    "Product",
    "SalesOrder",
    "Shipper",
    "Supplier",
    "sqlite_sequence",
  ];

  const indices: IndexSchema[] = [
    {
      name: "IDX_OrderId_ProductId",
      tableName: "OrderDetail",
      columns: ["orderId", "productId"],
      unique: true,
      createSql:
        "CREATE UNIQUE INDEX IDX_OrderId_ProductId ON OrderDetail (orderId, productId)",
    },
  ];

  return {
    dbPath: "D:\\BD\\SQLite\\northwind.db",
    dbName: "northwind.db",
    tables,
    tableOrder,
    indices,
    views: [],
    triggers: [],
    pragmas: getDefaultPragmas(),
  };
}

function buildEmptySnapshot(dbPath: string): SqlSnapshot {
  const parts = dbPath.split(/[\\/]/);
  const dbName = parts[parts.length - 1] || "untitled.db";
  return {
    dbPath,
    dbName,
    tables: {},
    tableOrder: [],
    indices: [],
    views: [],
    triggers: [],
    pragmas: getDefaultPragmas(),
  };
}

function buildSampleUniversitySnapshot(): SqlSnapshot {
  const tables: Record<string, TableSchema> = {};
  tables["students"] = {
    name: "students",
    createSql:
      "CREATE TABLE students ( student_id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, major TEXT, gpa REAL )",
    columns: [
      { name: "student_id", type: "INTEGER", notNull: false, primaryKey: true, autoIncrement: true, defaultValue: null, definitionSql: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "full_name", type: "TEXT", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT NOT NULL" },
      { name: "major", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
      { name: "gpa", type: "REAL", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "REAL" },
    ],
    rows: [
      { student_id: 1, full_name: "Aarav Mehta", major: "Computer Science", gpa: 3.88 },
      { student_id: 2, full_name: "Maya Lin", major: "Data Science", gpa: 3.94 },
      { student_id: 3, full_name: "Liam O'Connor", major: "Mathematics", gpa: 3.65 },
      { student_id: 4, full_name: "Sofia Alvarez", major: "Computer Science", gpa: 3.79 },
    ],
  };
  tables["courses"] = {
    name: "courses",
    createSql:
      "CREATE TABLE courses ( course_code VARCHAR(10) PRIMARY KEY NOT NULL, title TEXT NOT NULL, credits INTEGER NOT NULL )",
    columns: [
      { name: "course_code", type: "VARCHAR(10)", notNull: true, primaryKey: true, autoIncrement: false, defaultValue: null, definitionSql: "VARCHAR(10) PRIMARY KEY NOT NULL" },
      { name: "title", type: "TEXT", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT NOT NULL" },
      { name: "credits", type: "INTEGER", notNull: true, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INTEGER NOT NULL" },
    ],
    rows: [
      { course_code: "CS301", title: "Database Management Systems", credits: 4 },
      { course_code: "CS204", title: "Algorithms & Data Structures", credits: 4 },
      { course_code: "STAT210", title: "Applied Probability", credits: 3 },
    ],
  };
  tables["sqlite_sequence"] = {
    name: "sqlite_sequence",
    createSql: "CREATE TABLE sqlite_sequence(name,seq)",
    columns: [
      { name: "name", type: "", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "" },
      { name: "seq", type: "", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "" },
    ],
    rows: [{ name: "students", seq: 4 }],
  };

  return {
    dbPath: "D:\\BD\\SQLite\\university.db",
    dbName: "university.db",
    tables,
    tableOrder: ["students", "courses", "sqlite_sequence"],
    indices: [],
    views: [],
    triggers: [],
    pragmas: getDefaultPragmas(),
  };
}

export function createInitialDatabaseState(preset: "northwind" | "university" | "blank" = "northwind", customPath?: string): DatabaseState {
  let snapshot: SqlSnapshot;
  if (preset === "blank") {
    snapshot = buildEmptySnapshot(customPath || "D:\\BD\\SQLite\\new_database.db");
  } else if (preset === "university") {
    snapshot = buildSampleUniversitySnapshot();
  } else {
    snapshot = buildNorthwindSnapshot();
  }
  return {
    committed: deepClone(snapshot),
    working: snapshot,
    dirty: false,
    attachedDatabases: [],
    sqlLog: [
      {
        id: 1,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql: "PRAGMA encoding;",
        status: "ok",
        message: "UTF-8",
      },
      {
        id: 2,
        timestamp: nowTimestamp(),
        source: "User",
        sql: preset === "northwind" ? "select * from shipper;" : "-- Opened " + snapshot.dbName,
        status: "ok",
        message: preset === "northwind" ? "6 rows returned" : "Ready",
      },
    ],
    nextLogId: 3,
  };
}

export function writeChanges(state: DatabaseState): DatabaseState {
  return {
    committed: deepClone(state.working),
    working: deepClone(state.working),
    dirty: false,
    attachedDatabases: deepClone(state.attachedDatabases),
    sqlLog: state.sqlLog.concat([
      {
        id: state.nextLogId,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql: "COMMIT; -- Write Changes",
        status: "ok",
        message: "Database changes saved to " + state.working.dbName,
      },
    ]),
    nextLogId: state.nextLogId + 1,
  };
}

export function revertChanges(state: DatabaseState): DatabaseState {
  return {
    committed: deepClone(state.committed),
    working: deepClone(state.committed),
    dirty: false,
    attachedDatabases: deepClone(state.attachedDatabases),
    sqlLog: state.sqlLog.concat([
      {
        id: state.nextLogId,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql: "ROLLBACK; -- Revert Changes",
        status: "ok",
        message: "Reverted uncommitted changes",
      },
    ]),
    nextLogId: state.nextLogId + 1,
  };
}

function findTableKey(snapshot: SqlSnapshot, name: string): string | null {
  const lower = name.toLowerCase();
  for (let i = 0; i < snapshot.tableOrder.length; i++) {
    if (snapshot.tableOrder[i].toLowerCase() === lower) {
      return snapshot.tableOrder[i];
    }
  }
  const keys = Object.keys(snapshot.tables);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) {
      return keys[i];
    }
  }
  return null;
}

function findColumnName(table: TableSchema, colName: string): string | null {
  const lower = colName.toLowerCase();
  for (let i = 0; i < table.columns.length; i++) {
    if (table.columns[i].name.toLowerCase() === lower) {
      return table.columns[i].name;
    }
  }
  return null;
}

export function stripIdentifierQuotes(ident: string): string {
  const t = ident.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("`") && t.endsWith("`")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

interface RawStatement {
  sql: string;
  startLine: number;
}

export function splitSqlStatements(script: string): RawStatement[] {
  const results: RawStatement[] = [];
  let current = "";
  let line = 1;
  let stmtStartLine = 1;
  let hasNonWs = false;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;
  let inLineComment = false;
  let inBlockComment = false;
  let beginDepth = 0;

  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    const next = i + 1 < script.length ? script[i + 1] : "";

    if (ch === "\n") {
      if (inLineComment) {
        inLineComment = false;
      }
      current += ch;
      line++;
      continue;
    }

    if (inLineComment) {
      current += ch;
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === "*" && next === "/") {
        current += "/";
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      if (ch === "-" && next === "-") {
        inLineComment = true;
        current += "--";
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        current += "/*";
        i++;
        continue;
      }
    }

    if (!hasNonWs && !/\s/.test(ch)) {
      hasNonWs = true;
      stmtStartLine = line;
    }

    if (ch === "'" && !inDouble && !inBacktick && !inBracket) {
      if (inSingle && next === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle && !inBacktick && !inBracket) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === "`" && !inSingle && !inDouble && !inBracket) {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }
    if (ch === "[" && !inSingle && !inDouble && !inBacktick) {
      inBracket = true;
      current += ch;
      continue;
    }
    if (ch === "]" && inBracket) {
      inBracket = false;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      const slice6 = script.slice(i, i + 6).toUpperCase();
      if (
        slice6.indexOf("BEGIN") === 0 &&
        (i === 0 || !/[A-Za-z0-9_]/.test(script[i - 1])) &&
        (i + 5 >= script.length || !/[A-Za-z0-9_]/.test(script[i + 5]))
      ) {
        beginDepth++;
      }
      const slice4 = script.slice(i, i + 4).toUpperCase();
      if (
        beginDepth > 0 &&
        slice4.indexOf("END") === 0 &&
        (i === 0 || !/[A-Za-z0-9_]/.test(script[i - 1])) &&
        (i + 3 >= script.length || !/[A-Za-z0-9_]/.test(script[i + 3]))
      ) {
        beginDepth--;
      }

      if (ch === ";" && beginDepth === 0) {
        const cleaned = stripLeadingComments(current).trim();
        if (cleaned.length > 0) {
          results.push({ sql: cleaned + ";", startLine: stmtStartLine });
        }
        current = "";
        hasNonWs = false;
        continue;
      }
    }

    current += ch;
  }

  const tail = stripLeadingComments(current).trim();
  if (tail.length > 0) {
    results.push({ sql: tail, startLine: stmtStartLine });
  }

  return results;
}

function stripLeadingComments(sql: string): string {
  let s = sql.trim();
  while (s.length > 0) {
    if (s.startsWith("--")) {
      const nl = s.indexOf("\n");
      if (nl === -1) return "";
      s = s.slice(nl + 1).trim();
    } else if (s.startsWith("/*")) {
      const end = s.indexOf("*/");
      if (end === -1) return "";
      s = s.slice(end + 2).trim();
    } else {
      break;
    }
  }
  return s;
}

function stripAllComments(sql: string): string {
  let out = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : "";
    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === "-" && next === "-") {
        while (i < sql.length && sql[i] !== "\n") i++;
        out += " ";
        continue;
      }
      if (ch === "/" && next === "*") {
        i += 2;
        while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
        i++;
        out += " ";
        continue;
      }
    }
    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && next === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
    } else if (ch === "`" && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
    }
    out += ch;
  }
  return out;
}

function splitTopLevelCommas(text: string): string[] {
  const items: string[] = [];
  let cur = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : "";
    if (ch === "'" && !inDouble && !inBacktick && !inBracket) {
      if (inSingle && next === "'") {
        cur += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && !inBacktick && !inBracket) {
      inDouble = !inDouble;
    } else if (ch === "`" && !inSingle && !inDouble && !inBracket) {
      inBacktick = !inBacktick;
    } else if (ch === "[" && !inSingle && !inDouble && !inBacktick) {
      inBracket = true;
    } else if (ch === "]" && inBracket) {
      inBracket = false;
    } else if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (ch === "," && depth === 0) {
        items.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim().length > 0) {
    items.push(cur.trim());
  }
  return items;
}

interface Token {
  type: "word" | "number" | "string" | "ident" | "op" | "paren" | "comma" | "dot" | "star";
  value: string;
  upper: string;
}

function tokenizeSql(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'") {
      let s = "";
      i++;
      while (i < expr.length) {
        if (expr[i] === "'" && expr[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (expr[i] === "'") {
          i++;
          break;
        } else {
          s += expr[i];
          i++;
        }
      }
      tokens.push({ type: "string", value: s, upper: s });
      continue;
    }
    if (ch === '"' || ch === "`") {
      const q = ch;
      let s = "";
      i++;
      while (i < expr.length && expr[i] !== q) {
        s += expr[i];
        i++;
      }
      i++;
      tokens.push({ type: "ident", value: s, upper: s.toUpperCase() });
      continue;
    }
    if (ch === "[") {
      let s = "";
      i++;
      while (i < expr.length && expr[i] !== "]") {
        s += expr[i];
        i++;
      }
      i++;
      tokens.push({ type: "ident", value: s, upper: s.toUpperCase() });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(expr[i + 1] || ""))) {
      let num = "";
      let dotCount = 0;
      while (i < expr.length && (/[0-9]/.test(expr[i]) || (expr[i] === "." && dotCount === 0))) {
        if (expr[i] === ".") dotCount++;
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: num, upper: num });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let w = "";
      while (i < expr.length && /[A-Za-z0-9_$]/.test(expr[i])) {
        w += expr[i];
        i++;
      }
      tokens.push({ type: "word", value: w, upper: w.toUpperCase() });
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === "!=" || two === "<>" || two === "<=" || two === ">=" || two === "||") {
      tokens.push({ type: "op", value: two, upper: two });
      i += 2;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch, upper: ch });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ",", upper: "," });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: "dot", value: ".", upper: "." });
      i++;
      continue;
    }
    if (ch === "*") {
      tokens.push({ type: "star", value: "*", upper: "*" });
      i++;
      continue;
    }
    if ("=<>+-/%".indexOf(ch) !== -1) {
      tokens.push({ type: "op", value: ch, upper: ch });
      i++;
      continue;
    }
    i++;
  }
  return tokens;
}

type RowContext = Record<string, SqlValue>;

function resolveIdentifier(name: string, row: RowContext): SqlValue {
  if (Object.prototype.hasOwnProperty.call(row, name)) {
    return row[name];
  }
  const lower = name.toLowerCase();
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) {
      return row[keys[i]];
    }
  }
  // If unqualified, look up suffix `.col`
  if (lower.indexOf(".") === -1) {
    const suffix = "." + lower;
    for (let i = 0; i < keys.length; i++) {
      const kl = keys[i].toLowerCase();
      if (kl.length > suffix.length && kl.slice(kl.length - suffix.length) === suffix) {
        return row[keys[i]];
      }
    }
  }
  return null;
}

function compareSqlValues(a: SqlValue, b: SqlValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  const na = typeof a === "number" ? a : typeof a === "boolean" ? (a ? 1 : 0) : Number(a);
  const nb = typeof b === "number" ? b : typeof b === "boolean" ? (b ? 1 : 0) : Number(b);
  if (
    (typeof a === "number" || (typeof a === "string" && a.trim() !== "" && !isNaN(na))) &&
    (typeof b === "number" || (typeof b === "string" && b.trim() !== "" && !isNaN(nb)))
  ) {
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function likeMatch(val: SqlValue, pattern: SqlValue): boolean {
  if (val === null || pattern === null) return false;
  const text = String(val);
  const pat = String(pattern);
  let regexStr = "^";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "%") regexStr += "[\\s\\S]*";
    else if (c === "_") regexStr += "[\\s\\S]";
    else if ("\\^$.*+?()[]{}|".indexOf(c) !== -1) regexStr += "\\" + c;
    else regexStr += c;
  }
  regexStr += "$";
  return new RegExp(regexStr, "i").test(text);
}

function isTruthy(val: SqlValue): boolean {
  if (val === null || val === false || val === 0 || val === "") return false;
  return true;
}

function toNum(val: SqlValue): number {
  if (val === null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

class ExprParser {
  private tokens: Token[];
  private pos: number;
  private row: RowContext;
  private groupRows: RowContext[] | null;

  constructor(tokens: Token[], row: RowContext, groupRows: RowContext[] | null = null) {
    this.tokens = tokens;
    this.pos = 0;
    this.row = row;
    this.groupRows = groupRows;
  }

  private peek(offset = 0): Token | null {
    const idx = this.pos + offset;
    return idx >= 0 && idx < this.tokens.length ? this.tokens[idx] : null;
  }

  private next(): Token | null {
    const t = this.peek();
    if (t) this.pos++;
    return t;
  }

  public parse(): SqlValue {
    if (this.tokens.length === 0) return null;
    return this.parseOr();
  }

  private parseOr(): SqlValue {
    let left = this.parseAnd();
    while (this.peek()?.type === "word" && this.peek()?.upper === "OR") {
      this.next();
      const right = this.parseAnd();
      left = isTruthy(left) || isTruthy(right) ? 1 : 0;
    }
    return left;
  }

  private parseAnd(): SqlValue {
    let left = this.parseNot();
    while (this.peek()?.type === "word" && this.peek()?.upper === "AND") {
      this.next();
      const right = this.parseNot();
      left = isTruthy(left) && isTruthy(right) ? 1 : 0;
    }
    return left;
  }

  private parseNot(): SqlValue {
    if (this.peek()?.type === "word" && this.peek()?.upper === "NOT") {
      this.next();
      return isTruthy(this.parseNot()) ? 0 : 1;
    }
    return this.parseComparison();
  }

  private parseComparison(): SqlValue {
    let left = this.parseAddSub();
    while (true) {
      const t = this.peek();
      if (!t) break;

      if (t.type === "word" && t.upper === "IS") {
        this.next();
        let negate = false;
        if (this.peek()?.type === "word" && this.peek()?.upper === "NOT") {
          negate = true;
          this.next();
        }
        if (this.peek()?.type === "word" && this.peek()?.upper === "NULL") {
          this.next();
          const isNull = left === null;
          left = (negate ? !isNull : isNull) ? 1 : 0;
          continue;
        }
        const rhs = this.parseAddSub();
        const eq = compareSqlValues(left, rhs) === 0;
        left = (negate ? !eq : eq) ? 1 : 0;
        continue;
      }

      let negate = false;
      if (
        t.type === "word" &&
        t.upper === "NOT" &&
        this.peek(1)?.type === "word" &&
        (this.peek(1)?.upper === "IN" ||
          this.peek(1)?.upper === "LIKE" ||
          this.peek(1)?.upper === "BETWEEN")
      ) {
        negate = true;
        this.next();
      }

      const opWord = this.peek();
      if (opWord?.type === "word" && opWord.upper === "LIKE") {
        this.next();
        const pat = this.parseAddSub();
        const matched = likeMatch(left, pat);
        left = (negate ? !matched : matched) ? 1 : 0;
        continue;
      }

      if (opWord?.type === "word" && opWord.upper === "IN") {
        this.next();
        if (this.peek()?.value === "(") {
          this.next();
          const list: SqlValue[] = [];
          if (this.peek()?.value !== ")") {
            while (this.peek()) {
              list.push(this.parseOr());
              if (this.peek()?.type === "comma") {
                this.next();
              } else {
                break;
              }
            }
          }
          if (this.peek()?.value === ")") this.next();
          let found = false;
          for (let i = 0; i < list.length; i++) {
            if (left !== null && list[i] !== null && compareSqlValues(left, list[i]) === 0) {
              found = true;
              break;
            }
          }
          left = (negate ? !found : found) ? 1 : 0;
          continue;
        }
      }

      if (opWord?.type === "word" && opWord.upper === "BETWEEN") {
        this.next();
        const low = this.parseAddSub();
        if (this.peek()?.type === "word" && this.peek()?.upper === "AND") {
          this.next();
        }
        const high = this.parseAddSub();
        const inRange =
          left !== null &&
          low !== null &&
          high !== null &&
          compareSqlValues(left, low) >= 0 &&
          compareSqlValues(left, high) <= 0;
        left = (negate ? !inRange : inRange) ? 1 : 0;
        continue;
      }

      if (
        t.type === "op" &&
        (t.value === "=" ||
          t.value === "!=" ||
          t.value === "<>" ||
          t.value === "<" ||
          t.value === ">" ||
          t.value === "<=" ||
          t.value === ">=")
      ) {
        this.next();
        const right = this.parseAddSub();
        if (left === null || right === null) {
          left = 0;
          continue;
        }
        const cmp = compareSqlValues(left, right);
        if (t.value === "=") left = cmp === 0 ? 1 : 0;
        else if (t.value === "!=" || t.value === "<>") left = cmp !== 0 ? 1 : 0;
        else if (t.value === "<") left = cmp < 0 ? 1 : 0;
        else if (t.value === ">") left = cmp > 0 ? 1 : 0;
        else if (t.value === "<=") left = cmp <= 0 ? 1 : 0;
        else if (t.value === ">=") left = cmp >= 0 ? 1 : 0;
        continue;
      }

      break;
    }
    return left;
  }

  private parseAddSub(): SqlValue {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (!t || t.type !== "op") break;
      if (t.value === "+") {
        this.next();
        const right = this.parseMulDiv();
        if (left === null || right === null) left = null;
        else left = toNum(left) + toNum(right);
      } else if (t.value === "-") {
        this.next();
        const right = this.parseMulDiv();
        if (left === null || right === null) left = null;
        else left = toNum(left) - toNum(right);
      } else if (t.value === "||") {
        this.next();
        const right = this.parseMulDiv();
        if (left === null || right === null) left = null;
        else left = String(left) + String(right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): SqlValue {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.type === "star") {
        this.next();
        const right = this.parseUnary();
        if (left === null || right === null) left = null;
        else left = toNum(left) * toNum(right);
      } else if (t.type === "op" && t.value === "/") {
        this.next();
        const right = this.parseUnary();
        if (left === null || right === null) left = null;
        else {
          const d = toNum(right);
          left = d === 0 ? null : toNum(left) / d;
        }
      } else if (t.type === "op" && t.value === "%") {
        this.next();
        const right = this.parseUnary();
        if (left === null || right === null) left = null;
        else {
          const d = toNum(right);
          left = d === 0 ? null : toNum(left) % d;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): SqlValue {
    const t = this.peek();
    if (t?.type === "op" && t.value === "-") {
      this.next();
      const v = this.parseUnary();
      return v === null ? null : -toNum(v);
    }
    if (t?.type === "op" && t.value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SqlValue {
    const t = this.peek();
    if (!t) return null;

    if (t.type === "paren" && t.value === "(") {
      this.next();
      const val = this.parseOr();
      if (this.peek()?.value === ")") this.next();
      return val;
    }

    if (t.type === "number") {
      this.next();
      return t.value.indexOf(".") !== -1 ? parseFloat(t.value) : parseInt(t.value, 10);
    }

    if (t.type === "string") {
      this.next();
      return t.value;
    }

    if (t.type === "word") {
      if (t.upper === "NULL") {
        this.next();
        return null;
      }
      if (t.upper === "TRUE") {
        this.next();
        return 1;
      }
      if (t.upper === "FALSE") {
        this.next();
        return 0;
      }
      if (t.upper === "CURRENT_TIMESTAMP" || t.upper === "CURRENT_DATE") {
        this.next();
        return nowTimestamp();
      }
      if (t.upper === "CASE") {
        return this.parseCase();
      }
      if (t.upper === "CAST") {
        return this.parseCast();
      }

      if (this.peek(1)?.value === "(") {
        const fnName = t.upper;
        this.next(); // fn name
        this.next(); // (
        return this.evalFunctionCall(fnName);
      }
    }

    if (t.type === "word" || t.type === "ident") {
      this.next();
      let name = t.value;
      if (this.peek()?.type === "dot") {
        this.next();
        const colTok = this.next();
        if (colTok) {
          name = name + "." + colTok.value;
        }
      }
      return resolveIdentifier(name, this.row);
    }

    this.next();
    return null;
  }

  private parseCast(): SqlValue {
    this.next(); // CAST
    if (this.peek()?.value === "(") this.next();
    const val = this.parseOr();
    if (this.peek()?.upper === "AS") this.next();
    const typeTok = this.next();
    if (this.peek()?.value === "(") {
      while (this.peek() && this.peek()?.value !== ")") this.next();
      if (this.peek()?.value === ")") this.next();
    }
    if (this.peek()?.value === ")") this.next();
    if (val === null) return null;
    const tp = (typeTok?.upper || "TEXT").toUpperCase();
    if (tp.indexOf("INT") !== -1) return parseInt(String(val), 10) || 0;
    if (tp === "REAL" || tp === "FLOAT" || tp === "DOUBLE" || tp === "NUMERIC" || tp === "DECIMAL") {
      return parseFloat(String(val)) || 0;
    }
    return String(val);
  }

  private parseCase(): SqlValue {
    this.next(); // CASE
    let hasBase = false;
    let baseVal: SqlValue = null;
    if (this.peek()?.upper !== "WHEN") {
      hasBase = true;
      baseVal = this.parseOr();
    }
    let result: SqlValue = null;
    let matched = false;
    while (this.peek()?.upper === "WHEN") {
      this.next();
      const cond = this.parseOr();
      if (this.peek()?.upper === "THEN") this.next();
      const thenVal = this.parseOr();
      if (!matched) {
        const hit = hasBase ? compareSqlValues(baseVal, cond) === 0 : isTruthy(cond);
        if (hit) {
          result = thenVal;
          matched = true;
        }
      }
    }
    if (this.peek()?.upper === "ELSE") {
      this.next();
      const elseVal = this.parseOr();
      if (!matched) result = elseVal;
    }
    if (this.peek()?.upper === "END") this.next();
    return result;
  }

  private collectRawArgSlices(): { distinct: boolean; argTokenLists: Token[][] } {
    let distinct = false;
    if (this.peek()?.type === "word" && this.peek()?.upper === "DISTINCT") {
      distinct = true;
      this.next();
    }
    const argTokenLists: Token[][] = [];
    if (this.peek()?.value === ")") {
      this.next();
      return { distinct, argTokenLists };
    }
    let current: Token[] = [];
    let depth = 0;
    while (this.peek()) {
      const tok = this.next()!;
      if (tok.value === "(") {
        depth++;
        current.push(tok);
      } else if (tok.value === ")") {
        if (depth === 0) {
          argTokenLists.push(current);
          break;
        }
        depth--;
        current.push(tok);
      } else if (tok.type === "comma" && depth === 0) {
        argTokenLists.push(current);
        current = [];
      } else {
        current.push(tok);
      }
    }
    return { distinct, argTokenLists };
  }

  private evalFunctionCall(fnName: string): SqlValue {
    const { distinct, argTokenLists } = this.collectRawArgSlices();

    if (
      fnName === "COUNT" ||
      fnName === "SUM" ||
      fnName === "AVG" ||
      fnName === "MIN" ||
      fnName === "MAX" ||
      fnName === "TOTAL" ||
      fnName === "GROUP_CONCAT"
    ) {
      const rows = this.groupRows || [this.row];
      if (fnName === "COUNT") {
        if (argTokenLists.length === 0 || (argTokenLists[0].length === 1 && argTokenLists[0][0].type === "star")) {
          return rows.length;
        }
        const vals: SqlValue[] = [];
        const seen: Record<string, boolean> = {};
        for (let i = 0; i < rows.length; i++) {
          const v = new ExprParser(argTokenLists[0], rows[i]).parse();
          if (v !== null) {
            if (distinct) {
              const k = typeof v + ":" + String(v);
              if (!seen[k]) {
                seen[k] = true;
                vals.push(v);
              }
            } else {
              vals.push(v);
            }
          }
        }
        return vals.length;
      }

      const vals: SqlValue[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (argTokenLists.length > 0) {
          const v = new ExprParser(argTokenLists[0], rows[i]).parse();
          if (v !== null) vals.push(v);
        }
      }
      if (fnName === "SUM" || fnName === "TOTAL") {
        if (vals.length === 0) return fnName === "TOTAL" ? 0 : null;
        let sum = 0;
        for (let i = 0; i < vals.length; i++) sum += toNum(vals[i]);
        return Math.round(sum * 1e9) / 1e9;
      }
      if (fnName === "AVG") {
        if (vals.length === 0) return null;
        let sum = 0;
        for (let i = 0; i < vals.length; i++) sum += toNum(vals[i]);
        return Math.round((sum / vals.length) * 1e6) / 1e6;
      }
      if (fnName === "MIN") {
        if (vals.length === 0) return null;
        let min = vals[0];
        for (let i = 1; i < vals.length; i++) {
          if (compareSqlValues(vals[i], min) < 0) min = vals[i];
        }
        return min;
      }
      if (fnName === "MAX") {
        if (vals.length === 0) return null;
        let max = vals[0];
        for (let i = 1; i < vals.length; i++) {
          if (compareSqlValues(vals[i], max) > 0) max = vals[i];
        }
        return max;
      }
      if (fnName === "GROUP_CONCAT") {
        const sep =
          argTokenLists.length > 1
            ? String(new ExprParser(argTokenLists[1], this.row).parse() ?? ",")
            : ",";
        return vals.map((v) => String(v)).join(sep);
      }
    }

    const args = argTokenLists.map((toks) => new ExprParser(toks, this.row, this.groupRows).parse());

    if (fnName === "SQLITE_VERSION") return "3.45.1";
    if (fnName === "UPPER") return args[0] === null ? null : String(args[0]).toUpperCase();
    if (fnName === "LOWER") return args[0] === null ? null : String(args[0]).toLowerCase();
    if (fnName === "LENGTH") return args[0] === null ? null : String(args[0]).length;
    if (fnName === "TRIM") return args[0] === null ? null : String(args[0]).trim();
    if (fnName === "LTRIM") return args[0] === null ? null : String(args[0]).replace(/^\s+/, "");
    if (fnName === "RTRIM") return args[0] === null ? null : String(args[0]).replace(/\s+$/, "");
    if (fnName === "SUBSTR" || fnName === "SUBSTRING") {
      if (args[0] === null) return null;
      const s = String(args[0]);
      const start = Math.max(0, toNum(args[1] ?? 1) - 1);
      if (args.length >= 3 && args[2] !== null) {
        return s.slice(start, start + toNum(args[2]));
      }
      return s.slice(start);
    }
    if (fnName === "REPLACE") {
      if (args[0] === null || args[1] === null || args[2] === null) return null;
      return String(args[0]).split(String(args[1])).join(String(args[2]));
    }
    if (fnName === "COALESCE" || fnName === "IFNULL") {
      for (let i = 0; i < args.length; i++) {
        if (args[i] !== null) return args[i];
      }
      return null;
    }
    if (fnName === "NULLIF") {
      if (args.length < 2) return args[0] ?? null;
      return compareSqlValues(args[0], args[1]) === 0 ? null : args[0];
    }
    if (fnName === "IIF") {
      return isTruthy(args[0] ?? 0) ? (args[1] ?? null) : (args[2] ?? null);
    }
    if (fnName === "ABS") return args[0] === null ? null : Math.abs(toNum(args[0]));
    if (fnName === "ROUND") {
      if (args[0] === null) return null;
      const digits = args.length > 1 ? toNum(args[1]) : 0;
      const factor = Math.pow(10, digits);
      return Math.round(toNum(args[0]) * factor) / factor;
    }
    if (fnName === "TYPEOF") {
      const v = args[0];
      if (v === null) return "null";
      if (typeof v === "number") return Number.isInteger(v) ? "integer" : "real";
      if (typeof v === "boolean") return "integer";
      return "text";
    }
    if (fnName === "DATE" || fnName === "DATETIME") {
      return args[0] === null ? nowTimestamp() : String(args[0]);
    }
    return null;
  }
}

function evaluateExpr(exprSql: string, row: RowContext, groupRows: RowContext[] | null = null): SqlValue {
  const tokens = tokenizeSql(exprSql);
  return new ExprParser(tokens, row, groupRows).parse();
}

function containsAggregate(exprSql: string): boolean {
  const toks = tokenizeSql(exprSql);
  for (let i = 0; i < toks.length - 1; i++) {
    if (
      toks[i].type === "word" &&
      toks[i + 1].value === "(" &&
      (toks[i].upper === "COUNT" ||
        toks[i].upper === "SUM" ||
        toks[i].upper === "AVG" ||
        toks[i].upper === "MIN" ||
        toks[i].upper === "MAX" ||
        toks[i].upper === "TOTAL" ||
        toks[i].upper === "GROUP_CONCAT")
    ) {
      return true;
    }
  }
  return false;
}

function findTopLevelKeyword(sql: string, keywords: string[], startIndex = 0): { index: number; keyword: string } | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;
  const upperSql = sql.toUpperCase();

  for (let i = startIndex; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : "";
    if (ch === "'" && !inDouble && !inBacktick && !inBracket) {
      if (inSingle && next === "'") {
        i++;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && !inBacktick && !inBracket) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === "`" && !inSingle && !inDouble && !inBracket) {
      inBacktick = !inBacktick;
      continue;
    }
    if (ch === "[" && !inSingle && !inDouble && !inBacktick) {
      inBracket = true;
      continue;
    }
    if (ch === "]" && inBracket) {
      inBracket = false;
      continue;
    }
    if (inSingle || inDouble || inBacktick || inBracket) continue;

    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;

    if (i > 0 && /[A-Za-z0-9_]/.test(sql[i - 1])) continue;
    for (let k = 0; k < keywords.length; k++) {
      const kw = keywords[k];
      if (upperSql.slice(i, i + kw.length) === kw) {
        const after = i + kw.length;
        if (after >= sql.length || !/[A-Za-z0-9_]/.test(sql[after])) {
          return { index: i, keyword: kw };
        }
      }
    }
  }
  return null;
}

function splitSelectItemAlias(item: string): { expr: string; alias: string | null } {
  const toks = tokenizeSql(item);
  if (toks.length === 0) return { expr: item, alias: null };

  // Walk at depth 0 from right to left looking for AS or trailing identifier alias
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let asPos = -1;

  for (let i = 0; i < item.length; i++) {
    const ch = item[i];
    if (ch === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (ch === "`" && !inSingle && !inDouble) inBacktick = !inBacktick;
    else if (!inSingle && !inDouble && !inBacktick) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (
        depth === 0 &&
        item.slice(i, i + 2).toUpperCase() === "AS" &&
        (i === 0 || /\s/.test(item[i - 1])) &&
        (i + 2 < item.length && /\s/.test(item[i + 2]))
      ) {
        asPos = i;
      }
    }
  }

  if (asPos !== -1) {
    const expr = item.slice(0, asPos).trim();
    const alias = stripIdentifierQuotes(item.slice(asPos + 2).trim());
    return { expr, alias };
  }

  // Check implicit alias like `count(*) total` or `companyName name`
  if (toks.length >= 2) {
    const last = toks[toks.length - 1];
    const prev = toks[toks.length - 2];
    if (
      (last.type === "word" || last.type === "ident") &&
      (prev.type === "word" || prev.type === "ident" || prev.value === ")" || prev.type === "number" || prev.type === "string")
    ) {
      // Ensure prev wasn't a dot or operator
      const match = item.match(/^([\s\S]+?)\s+([A-Za-z_][A-Za-z0-9_$]*|"[^"]+"|`[^`]+`)$/);
      if (match) {
        const tailUpper = match[2].toUpperCase();
        if (tailUpper !== "ASC" && tailUpper !== "DESC" && tailUpper !== "NULL" && tailUpper !== "END") {
          return { expr: match[1].trim(), alias: stripIdentifierQuotes(match[2]) };
        }
      }
    }
  }

  return { expr: item.trim(), alias: null };
}

function inferColumnLabel(expr: string, alias: string | null): string {
  if (alias) return alias;
  const trimmed = expr.trim();
  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx !== -1 && /^[A-Za-z0-9_"`[\]]+\.[A-Za-z0-9_"`[\]]+$/.test(trimmed)) {
    return stripIdentifierQuotes(trimmed.slice(dotIdx + 1));
  }
  return stripIdentifierQuotes(trimmed);
}

interface TableSourceSpec {
  tableName: string;
  alias: string;
  joinType: "FROM" | "INNER" | "LEFT" | "CROSS";
  onExpr: string | null;
}

function parseFromClause(fromClause: string): TableSourceSpec[] {
  const specs: TableSourceSpec[] = [];
  const joinRegex = /\b(INNER\s+JOIN|LEFT\s+OUTER\s+JOIN|LEFT\s+JOIN|CROSS\s+JOIN|JOIN)\b/i;

  // Split by top-level JOIN keywords
  let cursor = 0;
  let currentJoin: "FROM" | "INNER" | "LEFT" | "CROSS" = "FROM";
  while (cursor < fromClause.length) {
    const kw = findTopLevelKeyword(
      fromClause,
      ["INNER JOIN", "LEFT OUTER JOIN", "LEFT JOIN", "CROSS JOIN", "JOIN"],
      cursor
    );
    const segment = (kw ? fromClause.slice(cursor, kw.index) : fromClause.slice(cursor)).trim();
    if (segment.length > 0) {
      // Handle comma-separated tables in FROM `a, b`
      const commaParts = currentJoin === "FROM" ? splitTopLevelCommas(segment) : [segment];
      for (let p = 0; p < commaParts.length; p++) {
        const part = commaParts[p].trim();
        let tableAndAlias = part;
        let onExpr: string | null = null;
        const onMatch = findTopLevelKeyword(part, ["ON"], 0);
        if (onMatch) {
          tableAndAlias = part.slice(0, onMatch.index).trim();
          onExpr = part.slice(onMatch.index + 2).trim();
        }
        const pieces = tableAndAlias
          .replace(/\bAS\b/i, " ")
          .trim()
          .split(/\s+/);
        const tableName = stripIdentifierQuotes(pieces[0] || "");
        const alias = pieces[1] ? stripIdentifierQuotes(pieces[1]) : tableName;
        specs.push({
          tableName,
          alias,
          joinType: p === 0 ? currentJoin : "CROSS",
          onExpr,
        });
      }
    }

    if (!kw) break;
    if (kw.keyword.indexOf("LEFT") === 0) currentJoin = "LEFT";
    else if (kw.keyword.indexOf("CROSS") === 0) currentJoin = "CROSS";
    else currentJoin = "INNER";
    cursor = kw.index + kw.keyword.length;
    void joinRegex;
  }

  return specs;
}

function getVirtualSqliteMasterRows(snapshot: SqlSnapshot): Record<string, SqlValue>[] {
  const rows: Record<string, SqlValue>[] = [];
  for (let i = 0; i < snapshot.tableOrder.length; i++) {
    const name = snapshot.tableOrder[i];
    const t = snapshot.tables[name];
    rows.push({
      type: "table",
      name: t.name,
      tbl_name: t.name,
      rootpage: i + 2,
      sql: t.createSql,
    });
  }
  for (let i = 0; i < snapshot.indices.length; i++) {
    const idx = snapshot.indices[i];
    rows.push({
      type: "index",
      name: idx.name,
      tbl_name: idx.tableName,
      rootpage: 20 + i,
      sql: idx.createSql,
    });
  }
  for (let i = 0; i < snapshot.views.length; i++) {
    const v = snapshot.views[i];
    rows.push({
      type: "view",
      name: v.name,
      tbl_name: v.name,
      rootpage: 0,
      sql: v.createSql,
    });
  }
  return rows;
}

function executeSelect(snapshot: SqlSnapshot, rawSql: string, startLine: number): StatementResult {
  const t0 = Date.now();
  const clean = stripAllComments(rawSql).trim().replace(/;+\s*$/, "").trim();
  const body = clean.slice(6).trim(); // after SELECT

  let distinct = false;
  let selectBody = body;
  if (/^DISTINCT\b/i.test(selectBody)) {
    distinct = true;
    selectBody = selectBody.slice(8).trim();
  } else if (/^ALL\b/i.test(selectBody)) {
    selectBody = selectBody.slice(3).trim();
  }

  // Find clauses in order: FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT
  const fromHit = findTopLevelKeyword(selectBody, ["FROM"], 0);
  const whereHit = findTopLevelKeyword(selectBody, ["WHERE"], fromHit ? fromHit.index + 4 : 0);
  const groupHit = findTopLevelKeyword(
    selectBody,
    ["GROUP BY"],
    whereHit ? whereHit.index + 5 : fromHit ? fromHit.index + 4 : 0
  );
  const havingHit = findTopLevelKeyword(
    selectBody,
    ["HAVING"],
    groupHit ? groupHit.index + 8 : whereHit ? whereHit.index + 5 : fromHit ? fromHit.index + 4 : 0
  );
  const orderHit = findTopLevelKeyword(
    selectBody,
    ["ORDER BY"],
    havingHit
      ? havingHit.index + 6
      : groupHit
        ? groupHit.index + 8
        : whereHit
          ? whereHit.index + 5
          : fromHit
            ? fromHit.index + 4
            : 0
  );
  const limitHit = findTopLevelKeyword(
    selectBody,
    ["LIMIT"],
    orderHit
      ? orderHit.index + 8
      : havingHit
        ? havingHit.index + 6
        : groupHit
          ? groupHit.index + 8
          : whereHit
            ? whereHit.index + 5
            : fromHit
              ? fromHit.index + 4
              : 0
  );

  const clauseBounds = [
    fromHit ? fromHit.index : -1,
    whereHit ? whereHit.index : -1,
    groupHit ? groupHit.index : -1,
    havingHit ? havingHit.index : -1,
    orderHit ? orderHit.index : -1,
    limitHit ? limitHit.index : -1,
  ].filter((x) => x !== -1);

  const firstClauseIdx = clauseBounds.length > 0 ? Math.min.apply(null, clauseBounds) : selectBody.length;
  const projectionSql = selectBody.slice(0, firstClauseIdx).trim();

  const nextBound = (after: number): number => {
    let min = selectBody.length;
    for (let i = 0; i < clauseBounds.length; i++) {
      if (clauseBounds[i] > after && clauseBounds[i] < min) min = clauseBounds[i];
    }
    return min;
  };

  const fromSql = fromHit ? selectBody.slice(fromHit.index + 4, nextBound(fromHit.index)).trim() : "";
  const whereSql = whereHit ? selectBody.slice(whereHit.index + 5, nextBound(whereHit.index)).trim() : "";
  const groupSql = groupHit ? selectBody.slice(groupHit.index + 8, nextBound(groupHit.index)).trim() : "";
  const havingSql = havingHit ? selectBody.slice(havingHit.index + 6, nextBound(havingHit.index)).trim() : "";
  const orderSql = orderHit ? selectBody.slice(orderHit.index + 8, nextBound(orderHit.index)).trim() : "";
  const limitSql = limitHit ? selectBody.slice(limitHit.index + 5).trim() : "";

  interface JoinedRow {
    ctx: RowContext;
    sourceIdx: number;
  }

  let joinedRows: JoinedRow[] = [{ ctx: {}, sourceIdx: -1 }];
  const sourceTables: { spec: TableSourceSpec; columns: ColumnSchema[]; tableKey: string }[] = [];
  let isSingleDirectTable = false;
  let singleTableName: string | undefined = undefined;

  if (fromSql.length > 0) {
    const specs = parseFromClause(fromSql);
    if (specs.length === 0) {
      return {
        sql: rawSql,
        startLine,
        ok: false,
        isQuery: true,
        columns: [],
        rows: [],
        rowsAffected: 0,
        elapsedMs: Math.max(1, Date.now() - t0),
        message: "syntax error near FROM",
        error: "syntax error near FROM",
      };
    }

    for (let s = 0; s < specs.length; s++) {
      const spec = specs[s];
      const lowerName = spec.tableName.toLowerCase();
      let tableCols: ColumnSchema[] = [];
      let tableRows: Record<string, SqlValue>[] = [];
      let resolvedName = spec.tableName;

      if (lowerName === "sqlite_master" || lowerName === "sqlite_schema") {
        tableCols = [
          { name: "type", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
          { name: "name", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
          { name: "tbl_name", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
          { name: "rootpage", type: "INT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "INT" },
          { name: "sql", type: "TEXT", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "TEXT" },
        ];
        tableRows = getVirtualSqliteMasterRows(snapshot);
      } else {
        const tKey = findTableKey(snapshot, spec.tableName);
        if (tKey) {
          resolvedName = tKey;
          tableCols = snapshot.tables[tKey].columns;
          tableRows = snapshot.tables[tKey].rows;
        } else {
          // Check views
          let foundView: ViewSchema | null = null;
          for (let vi = 0; vi < snapshot.views.length; vi++) {
            if (snapshot.views[vi].name.toLowerCase() === lowerName) {
              foundView = snapshot.views[vi];
              break;
            }
          }
          if (foundView) {
            const viewRes = executeSelect(snapshot, foundView.selectSql, startLine);
            if (!viewRes.ok) return viewRes;
            tableCols = viewRes.columns.map((c) => ({
              name: c,
              type: "TEXT",
              notNull: false,
              primaryKey: false,
              autoIncrement: false,
              defaultValue: null,
              definitionSql: "TEXT",
            }));
            tableRows = viewRes.rows.map((r) => {
              const obj: Record<string, SqlValue> = {};
              for (let ci = 0; ci < viewRes.columns.length; ci++) {
                obj[viewRes.columns[ci]] = r[ci];
              }
              return obj;
            });
          } else {
            return {
              sql: rawSql,
              startLine,
              ok: false,
              isQuery: true,
              columns: [],
              rows: [],
              rowsAffected: 0,
              elapsedMs: Math.max(1, Date.now() - t0),
              message: "no such table: " + spec.tableName,
              error: "no such table: " + spec.tableName,
            };
          }
        }
      }

      sourceTables.push({ spec, columns: tableCols, tableKey: resolvedName });

      if (s === 0) {
        joinedRows = tableRows.map((row, idx) => {
          const ctx: RowContext = {};
          for (let c = 0; c < tableCols.length; c++) {
            const colName = tableCols[c].name;
            const v = row[colName] !== undefined ? row[colName] : null;
            ctx[colName] = v;
            ctx[spec.alias + "." + colName] = v;
            ctx[resolvedName + "." + colName] = v;
          }
          return { ctx, sourceIdx: idx };
        });
      } else {
        const nextJoined: JoinedRow[] = [];
        for (let li = 0; li < joinedRows.length; li++) {
          const left = joinedRows[li];
          let matchedAny = false;
          for (let ri = 0; ri < tableRows.length; ri++) {
            const rRow = tableRows[ri];
            const combined: RowContext = deepClone(left.ctx);
            for (let c = 0; c < tableCols.length; c++) {
              const colName = tableCols[c].name;
              const v = rRow[colName] !== undefined ? rRow[colName] : null;
              if (!Object.prototype.hasOwnProperty.call(combined, colName)) {
                combined[colName] = v;
              }
              combined[spec.alias + "." + colName] = v;
              combined[resolvedName + "." + colName] = v;
            }
            const passesOn = spec.onExpr ? isTruthy(evaluateExpr(spec.onExpr, combined)) : true;
            if (passesOn) {
              matchedAny = true;
              nextJoined.push({ ctx: combined, sourceIdx: -1 });
            }
          }
          if (!matchedAny && spec.joinType === "LEFT") {
            const nullCombined: RowContext = deepClone(left.ctx);
            for (let c = 0; c < tableCols.length; c++) {
              const colName = tableCols[c].name;
              nullCombined[spec.alias + "." + colName] = null;
              nullCombined[resolvedName + "." + colName] = null;
            }
            nextJoined.push({ ctx: nullCombined, sourceIdx: -1 });
          }
        }
        joinedRows = nextJoined;
      }
    }

    if (specs.length === 1 && findTableKey(snapshot, specs[0].tableName) !== null) {
      isSingleDirectTable = true;
      singleTableName = sourceTables[0].tableKey;
    }
  }

  // Apply WHERE
  if (whereSql.length > 0) {
    joinedRows = joinedRows.filter((jr) => isTruthy(evaluateExpr(whereSql, jr.ctx)));
  }

  // Expand SELECT projection list
  const rawItems = splitTopLevelCommas(projectionSql);
  interface ProjectionCol {
    label: string;
    expr: string;
  }
  const projCols: ProjectionCol[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i].trim();
    if (item === "*") {
      for (let s = 0; s < sourceTables.length; s++) {
        const st = sourceTables[s];
        for (let c = 0; c < st.columns.length; c++) {
          const cname = st.columns[c].name;
          projCols.push({
            label: cname,
            expr: st.spec.alias + "." + cname,
          });
        }
      }
      if (sourceTables.length === 0) {
        return {
          sql: rawSql,
          startLine,
          ok: false,
          isQuery: true,
          columns: [],
          rows: [],
          rowsAffected: 0,
          elapsedMs: Math.max(1, Date.now() - t0),
          message: "no tables specified",
          error: "no tables specified",
        };
      }
    } else if (/^[A-Za-z0-9_"`[\]]+\.\*$/.test(item)) {
      const targetAlias = stripIdentifierQuotes(item.slice(0, -2)).toLowerCase();
      let matchedSt = false;
      for (let s = 0; s < sourceTables.length; s++) {
        const st = sourceTables[s];
        if (st.spec.alias.toLowerCase() === targetAlias || st.tableKey.toLowerCase() === targetAlias) {
          matchedSt = true;
          for (let c = 0; c < st.columns.length; c++) {
            const cname = st.columns[c].name;
            projCols.push({ label: cname, expr: st.spec.alias + "." + cname });
          }
        }
      }
      if (!matchedSt) {
        return {
          sql: rawSql,
          startLine,
          ok: false,
          isQuery: true,
          columns: [],
          rows: [],
          rowsAffected: 0,
          elapsedMs: Math.max(1, Date.now() - t0),
          message: "no such table: " + item.slice(0, -2),
          error: "no such table: " + item.slice(0, -2),
        };
      }
    } else {
      const { expr, alias } = splitSelectItemAlias(item);
      projCols.push({
        label: inferColumnLabel(expr, alias),
        expr,
      });
    }
  }

  // Determine grouping / aggregation
  const hasAgg = projCols.some((p) => containsAggregate(p.expr));
  const groupExprs = groupSql.length > 0 ? splitTopLevelCommas(groupSql) : [];
  const isGrouped = groupExprs.length > 0 || hasAgg;

  interface OutputRecord {
    values: SqlValue[];
    evalCtx: RowContext;
    sourceIdx: number;
  }

  let outRecords: OutputRecord[] = [];

  if (isGrouped) {
    isSingleDirectTable = false;
    const groupsMap: Record<string, RowContext[]> = {};
    const groupOrder: string[] = [];

    if (groupExprs.length === 0) {
      groupsMap["__all__"] = joinedRows.map((j) => j.ctx);
      groupOrder.push("__all__");
    } else {
      for (let i = 0; i < joinedRows.length; i++) {
        const jr = joinedRows[i];
        const keyVals = groupExprs.map((ge) => evaluateExpr(ge, jr.ctx));
        const key = JSON.stringify(keyVals);
        if (!groupsMap[key]) {
          groupsMap[key] = [];
          groupOrder.push(key);
        }
        groupsMap[key].push(jr.ctx);
      }
    }

    for (let g = 0; g < groupOrder.length; g++) {
      const gRows = groupsMap[groupOrder[g]];
      const repRow = gRows[0] || {};
      if (havingSql.length > 0 && !isTruthy(evaluateExpr(havingSql, repRow, gRows))) {
        continue;
      }
      const evalCtx: RowContext = deepClone(repRow);
      const values = projCols.map((pc) => {
        const v = evaluateExpr(pc.expr, repRow, gRows);
        evalCtx[pc.label] = v;
        return v;
      });
      outRecords.push({ values, evalCtx, sourceIdx: -1 });
    }
  } else {
    for (let i = 0; i < joinedRows.length; i++) {
      const jr = joinedRows[i];
      const evalCtx: RowContext = deepClone(jr.ctx);
      const values = projCols.map((pc) => {
        const v = evaluateExpr(pc.expr, jr.ctx);
        evalCtx[pc.label] = v;
        return v;
      });
      outRecords.push({ values, evalCtx, sourceIdx: jr.sourceIdx });
    }
  }

  if (distinct) {
    const seen: Record<string, boolean> = {};
    outRecords = outRecords.filter((rec) => {
      const k = JSON.stringify(rec.values);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  if (orderSql.length > 0) {
    const orderItems = splitTopLevelCommas(orderSql).map((oi) => {
      const m = oi.match(/^([\s\S]+?)\s+(ASC|DESC)$/i);
      return {
        expr: m ? m[1].trim() : oi.trim(),
        desc: m ? m[2].toUpperCase() === "DESC" : false,
      };
    });
    outRecords.sort((a, b) => {
      for (let i = 0; i < orderItems.length; i++) {
        const oi = orderItems[i];
        let va: SqlValue;
        let vb: SqlValue;
        if (/^\d+$/.test(oi.expr)) {
          const idx = parseInt(oi.expr, 10) - 1;
          va = a.values[idx] !== undefined ? a.values[idx] : null;
          vb = b.values[idx] !== undefined ? b.values[idx] : null;
        } else {
          va = evaluateExpr(oi.expr, a.evalCtx);
          vb = evaluateExpr(oi.expr, b.evalCtx);
        }
        const cmp = compareSqlValues(va, vb);
        if (cmp !== 0) return oi.desc ? -cmp : cmp;
      }
      return 0;
    });
  }

  if (limitSql.length > 0) {
    let limit = outRecords.length;
    let offset = 0;
    const offMatch = limitSql.match(/^(\d+)\s+OFFSET\s+(\d+)$/i);
    const commaMatch = limitSql.match(/^(\d+)\s*,\s*(\d+)$/);
    const plainMatch = limitSql.match(/^(\d+)$/);
    if (offMatch) {
      limit = parseInt(offMatch[1], 10);
      offset = parseInt(offMatch[2], 10);
    } else if (commaMatch) {
      offset = parseInt(commaMatch[1], 10);
      limit = parseInt(commaMatch[2], 10);
    } else if (plainMatch) {
      limit = parseInt(plainMatch[1], 10);
    }
    outRecords = outRecords.slice(offset, offset + limit);
  }

  const columns = projCols.map((p) => p.label);
  const rows = outRecords.map((r) => r.values);
  const elapsedMs = Math.max(1, Date.now() - t0);

  return {
    sql: rawSql,
    startLine,
    ok: true,
    isQuery: true,
    columns,
    rows,
    rowsAffected: 0,
    elapsedMs,
    message: rows.length + " row" + (rows.length === 1 ? "" : "s") + " returned in " + elapsedMs + "ms",
    editableTable: isSingleDirectTable ? singleTableName : undefined,
    sourceRowIndices: isSingleDirectTable ? outRecords.map((r) => r.sourceIdx) : undefined,
  };
}

function parseCreateTable(snapshot: SqlSnapshot, rawSql: string): { ok: boolean; message: string } {
  const clean = stripAllComments(rawSql).trim().replace(/;+\s*$/, "").trim();
  const match = clean.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_"`[\]]+)\s*\(([\s\S]+)\)$/i);
  if (!match) {
    return { ok: false, message: "near \"CREATE\": syntax error" };
  }
  const tableName = stripIdentifierQuotes(match[1]);
  const existing = findTableKey(snapshot, tableName);
  if (existing) {
    if (/IF\s+NOT\s+EXISTS/i.test(clean)) {
      return { ok: true, message: "Table " + tableName + " already exists" };
    }
    return { ok: false, message: "table " + tableName + " already exists" };
  }

  const defs = splitTopLevelCommas(match[2]);
  const columns: ColumnSchema[] = [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i].trim();
    if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(def)) {
      const pkM = def.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkM) {
        const pkCols = pkM[1].split(",").map((s) => stripIdentifierQuotes(s.trim()).toLowerCase());
        for (let c = 0; c < columns.length; c++) {
          if (pkCols.indexOf(columns[c].name.toLowerCase()) !== -1) {
            columns[c].primaryKey = true;
          }
        }
      }
      continue;
    }
    const nameMatch = def.match(/^("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_$]*)\s*([\s\S]*)$/);
    if (!nameMatch) continue;
    const colName = stripIdentifierQuotes(nameMatch[1]);
    const rest = nameMatch[2].trim();
    const typeMatch = rest.match(/^([A-Za-z]+(?:\s*\([^)]+\))?)/);
    const type = typeMatch ? typeMatch[1].toUpperCase() : "";
    const upperRest = rest.toUpperCase();
    const primaryKey = /\bPRIMARY\s+KEY\b/.test(upperRest);
    const autoIncrement = /\bAUTOINCREMENT\b/.test(upperRest);
    const notNull = /\bNOT\s+NULL\b/.test(upperRest);
    const unique = /\bUNIQUE\b/.test(upperRest);
    let defaultValue: SqlValue = null;
    const defM = rest.match(/\bDEFAULT\s+('[^']*'|-?\d+(?:\.\d+)?|NULL)/i);
    if (defM) {
      const dv = defM[1];
      if (dv.toUpperCase() === "NULL") defaultValue = null;
      else if (dv.startsWith("'")) defaultValue = dv.slice(1, -1);
      else defaultValue = Number(dv);
    }

    columns.push({
      name: colName,
      type,
      notNull,
      primaryKey,
      autoIncrement,
      defaultValue,
      unique,
      definitionSql: rest,
    });
  }

  snapshot.tables[tableName] = {
    name: tableName,
    columns,
    rows: [],
    createSql: clean,
  };
  snapshot.tableOrder.push(tableName);

  if (columns.some((c) => c.autoIncrement)) {
    let seqKey = findTableKey(snapshot, "sqlite_sequence");
    if (!seqKey) {
      seqKey = "sqlite_sequence";
      snapshot.tables[seqKey] = {
        name: "sqlite_sequence",
        createSql: "CREATE TABLE sqlite_sequence(name,seq)",
        columns: [
          { name: "name", type: "", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "" },
          { name: "seq", type: "", notNull: false, primaryKey: false, autoIncrement: false, defaultValue: null, definitionSql: "" },
        ],
        rows: [],
      };
      snapshot.tableOrder.push(seqKey);
    }
    snapshot.tables[seqKey].rows.push({ name: tableName, seq: 0 });
  }

  return { ok: true, message: "Table " + tableName + " created" };
}

function executeInsert(snapshot: SqlSnapshot, rawSql: string): { ok: boolean; rowsAffected: number; message: string } {
  const clean = stripAllComments(rawSql).trim().replace(/;+\s*$/, "").trim();
  const match = clean.match(
    /^INSERT\s+(?:OR\s+(?:IGNORE|REPLACE)\s+)?INTO\s+([A-Za-z0-9_"`[\]]+)\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]+)$/i
  );
  if (!match) {
    return { ok: false, rowsAffected: 0, message: "near \"INSERT\": syntax error" };
  }
  const tableName = stripIdentifierQuotes(match[1]);
  const tKey = findTableKey(snapshot, tableName);
  if (!tKey) {
    return { ok: false, rowsAffected: 0, message: "no such table: " + tableName };
  }
  const table = snapshot.tables[tKey];
  const targetCols: string[] = match[2]
    ? splitTopLevelCommas(match[2]).map((c) => stripIdentifierQuotes(c))
    : table.columns.map((c) => c.name);

  for (let i = 0; i < targetCols.length; i++) {
    const resolved = findColumnName(table, targetCols[i]);
    if (!resolved) {
      return { ok: false, rowsAffected: 0, message: "table " + tKey + " has no column named " + targetCols[i] };
    }
    targetCols[i] = resolved;
  }

  // Split VALUES (...), (...)
  const tupleStrings = splitTopLevelCommas(match[3]);
  let inserted = 0;

  for (let ti = 0; ti < tupleStrings.length; ti++) {
    let tup = tupleStrings[ti].trim();
    if (!tup.startsWith("(") || !tup.endsWith(")")) {
      return { ok: false, rowsAffected: inserted, message: "syntax error in VALUES clause" };
    }
    tup = tup.slice(1, -1);
    const valExprs = splitTopLevelCommas(tup);
    if (valExprs.length !== targetCols.length) {
      return {
        ok: false,
        rowsAffected: inserted,
        message: valExprs.length + " values for " + targetCols.length + " columns",
      };
    }

    const newRow: Record<string, SqlValue> = {};
    for (let c = 0; c < table.columns.length; c++) {
      newRow[table.columns[c].name] = table.columns[c].defaultValue;
    }

    for (let c = 0; c < targetCols.length; c++) {
      newRow[targetCols[c]] = evaluateExpr(valExprs[c], {});
    }

    // Handle integer PK auto-increment
    for (let c = 0; c < table.columns.length; c++) {
      const col = table.columns[c];
      if (col.primaryKey && col.type.indexOf("INT") !== -1) {
        if (newRow[col.name] === null || newRow[col.name] === undefined) {
          let maxId = 0;
          for (let r = 0; r < table.rows.length; r++) {
            const rv = toNum(table.rows[r][col.name]);
            if (rv > maxId) maxId = rv;
          }
          const seqTableKey = findTableKey(snapshot, "sqlite_sequence");
          if (seqTableKey) {
            const seqRows = snapshot.tables[seqTableKey].rows;
            for (let sr = 0; sr < seqRows.length; sr++) {
              if (String(seqRows[sr]["name"]).toLowerCase() === tKey.toLowerCase()) {
                const sv = toNum(seqRows[sr]["seq"]);
                if (sv > maxId) maxId = sv;
                seqRows[sr]["seq"] = maxId + 1;
              }
            }
          }
          newRow[col.name] = maxId + 1;
        }
      }
      if (col.notNull && newRow[col.name] === null) {
        return {
          ok: false,
          rowsAffected: inserted,
          message: "NOT NULL constraint failed: " + tKey + "." + col.name,
        };
      }
      if (col.primaryKey) {
        for (let r = 0; r < table.rows.length; r++) {
          if (compareSqlValues(table.rows[r][col.name], newRow[col.name]) === 0) {
            return {
              ok: false,
              rowsAffected: inserted,
              message: "UNIQUE constraint failed: " + tKey + "." + col.name,
            };
          }
        }
      }
    }

    table.rows.push(newRow);
    inserted++;
  }

  return { ok: true, rowsAffected: inserted, message: inserted + " row(s) affected" };
}

function executeUpdate(snapshot: SqlSnapshot, rawSql: string): { ok: boolean; rowsAffected: number; message: string } {
  const clean = stripAllComments(rawSql).trim().replace(/;+\s*$/, "").trim();
  const body = clean.slice(6).trim(); // after UPDATE
  const setHit = findTopLevelKeyword(body, ["SET"], 0);
  if (!setHit) {
    return { ok: false, rowsAffected: 0, message: "near \"UPDATE\": syntax error" };
  }
  const tableName = stripIdentifierQuotes(body.slice(0, setHit.index).trim());
  const tKey = findTableKey(snapshot, tableName);
  if (!tKey) {
    return { ok: false, rowsAffected: 0, message: "no such table: " + tableName };
  }
  const table = snapshot.tables[tKey];
  const whereHit = findTopLevelKeyword(body, ["WHERE"], setHit.index + 3);
  const setSql = (whereHit ? body.slice(setHit.index + 3, whereHit.index) : body.slice(setHit.index + 3)).trim();
  const whereSql = whereHit ? body.slice(whereHit.index + 5).trim() : "";

  const assignments = splitTopLevelCommas(setSql).map((part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) return null;
    const colRaw = stripIdentifierQuotes(part.slice(0, eqIdx).trim());
    const expr = part.slice(eqIdx + 1).trim();
    return { colRaw, expr };
  });

  if (assignments.some((a) => a === null)) {
    return { ok: false, rowsAffected: 0, message: "syntax error in SET clause" };
  }

  const resolvedAssignments: { col: string; expr: string }[] = [];
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]!;
    const col = findColumnName(table, a.colRaw);
    if (!col) {
      return { ok: false, rowsAffected: 0, message: "no such column: " + a.colRaw };
    }
    resolvedAssignments.push({ col, expr: a.expr });
  }

  let affected = 0;
  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    if (whereSql.length > 0 && !isTruthy(evaluateExpr(whereSql, row))) {
      continue;
    }
    for (let a = 0; a < resolvedAssignments.length; a++) {
      const val = evaluateExpr(resolvedAssignments[a].expr, row);
      row[resolvedAssignments[a].col] = val;
    }
    affected++;
  }

  return { ok: true, rowsAffected: affected, message: affected + " row(s) affected" };
}

function executeDelete(snapshot: SqlSnapshot, rawSql: string): { ok: boolean; rowsAffected: number; message: string } {
  const clean = stripAllComments(rawSql).trim().replace(/;+\s*$/, "").trim();
  const match = clean.match(/^DELETE\s+FROM\s+([A-Za-z0-9_"`[\]]+)([\s\S]*)$/i);
  if (!match) {
    return { ok: false, rowsAffected: 0, message: "near \"DELETE\": syntax error" };
  }
  const tableName = stripIdentifierQuotes(match[1]);
  const tKey = findTableKey(snapshot, tableName);
  if (!tKey) {
    return { ok: false, rowsAffected: 0, message: "no such table: " + tableName };
  }
  const table = snapshot.tables[tKey];
  const tail = match[2].trim();
  let whereSql = "";
  if (tail.length > 0) {
    const whereMatch = tail.match(/^WHERE\s+([\s\S]+)$/i);
    if (!whereMatch) {
      return { ok: false, rowsAffected: 0, message: "syntax error near " + tail };
    }
    whereSql = whereMatch[1].trim();
  }

  if (whereSql.length === 0) {
    const count = table.rows.length;
    table.rows = [];
    return { ok: true, rowsAffected: count, message: count + " row(s) affected" };
  }

  const kept: Record<string, SqlValue>[] = [];
  let deleted = 0;
  for (let r = 0; r < table.rows.length; r++) {
    if (isTruthy(evaluateExpr(whereSql, table.rows[r]))) {
      deleted++;
    } else {
      kept.push(table.rows[r]);
    }
  }
  table.rows = kept;
  return { ok: true, rowsAffected: deleted, message: deleted + " row(s) affected" };
}

function executePragma(snapshot: SqlSnapshot, rawSql: string, startLine: number): StatementResult {
  const t0 = Date.now();
  const clean = stripAllComments(rawSql).trim().replace(/;+\s*$/, "").trim();
  const body = clean.slice(6).trim(); // after PRAGMA

  const tiMatch = body.match(/^table_info\s*\(\s*([^)]+)\s*\)$/i);
  if (tiMatch) {
    const tbl = stripIdentifierQuotes(tiMatch[1].replace(/^'|'$/g, ""));
    const tKey = findTableKey(snapshot, tbl);
    if (!tKey) {
      return {
        sql: rawSql,
        startLine,
        ok: true,
        isQuery: true,
        columns: ["cid", "name", "type", "notnull", "dflt_value", "pk"],
        rows: [],
        rowsAffected: 0,
        elapsedMs: 1,
        message: "0 rows returned in 1ms",
      };
    }
    const cols = snapshot.tables[tKey].columns;
    const rows: SqlValue[][] = cols.map((c, idx) => [
      idx,
      c.name,
      c.type,
      c.notNull ? 1 : 0,
      c.defaultValue,
      c.primaryKey ? 1 : 0,
    ]);
    return {
      sql: rawSql,
      startLine,
      ok: true,
      isQuery: true,
      columns: ["cid", "name", "type", "notnull", "dflt_value", "pk"],
      rows,
      rowsAffected: 0,
      elapsedMs: Math.max(1, Date.now() - t0),
      message: rows.length + " rows returned in 1ms",
    };
  }

  const eqIdx = body.indexOf("=");
  const parenMatch = body.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)$/);
  if (eqIdx !== -1 || parenMatch) {
    const key = (parenMatch ? parenMatch[1] : body.slice(0, eqIdx)).trim().toLowerCase();
    const rawVal = (parenMatch ? parenMatch[2] : body.slice(eqIdx + 1)).trim().replace(/^['"]|['"]$/g, "");
    const upperVal = rawVal.toUpperCase();
    if (key === "foreign_keys") {
      snapshot.pragmas.foreign_keys = upperVal === "ON" || upperVal === "1" || upperVal === "TRUE";
    } else if (key === "journal_mode") {
      const lower = rawVal.toLowerCase();
      if (
        lower === "delete" ||
        lower === "truncate" ||
        lower === "persist" ||
        lower === "memory" ||
        lower === "wal" ||
        lower === "off"
      ) {
        snapshot.pragmas.journal_mode = lower;
      }
      return {
        sql: rawSql,
        startLine,
        ok: true,
        isQuery: true,
        columns: ["journal_mode"],
        rows: [[snapshot.pragmas.journal_mode]],
        rowsAffected: 0,
        elapsedMs: 1,
        message: "1 row returned in 1ms",
      };
    } else if (key === "synchronous") {
      if (upperVal === "0" || upperVal === "OFF") snapshot.pragmas.synchronous = "OFF";
      else if (upperVal === "1" || upperVal === "NORMAL") snapshot.pragmas.synchronous = "NORMAL";
      else if (upperVal === "2" || upperVal === "FULL") snapshot.pragmas.synchronous = "FULL";
      else if (upperVal === "3" || upperVal === "EXTRA") snapshot.pragmas.synchronous = "EXTRA";
    } else if (key === "cache_size") {
      const n = parseInt(rawVal, 10);
      if (!isNaN(n)) snapshot.pragmas.cache_size = n;
    } else if (key === "page_size") {
      const n = parseInt(rawVal, 10);
      if (!isNaN(n)) snapshot.pragmas.page_size = n;
    } else if (key === "user_version") {
      const n = parseInt(rawVal, 10);
      if (!isNaN(n)) snapshot.pragmas.user_version = n;
    } else if (key === "recursive_triggers") {
      snapshot.pragmas.recursive_triggers = upperVal === "ON" || upperVal === "1" || upperVal === "TRUE";
    }
    return {
      sql: rawSql,
      startLine,
      ok: true,
      isQuery: false,
      columns: [],
      rows: [],
      rowsAffected: 0,
      elapsedMs: 1,
      message: "PRAGMA " + key + " updated",
    };
  }

  const key = body.toLowerCase();
  let val: SqlValue = null;
  if (key === "foreign_keys") val = snapshot.pragmas.foreign_keys ? 1 : 0;
  else if (key === "journal_mode") val = snapshot.pragmas.journal_mode;
  else if (key === "synchronous") val = snapshot.pragmas.synchronous;
  else if (key === "encoding") val = snapshot.pragmas.encoding;
  else if (key === "cache_size") val = snapshot.pragmas.cache_size;
  else if (key === "page_size") val = snapshot.pragmas.page_size;
  else if (key === "temp_store") val = snapshot.pragmas.temp_store;
  else if (key === "auto_vacuum") val = snapshot.pragmas.auto_vacuum;
  else if (key === "locking_mode") val = snapshot.pragmas.locking_mode;
  else if (key === "recursive_triggers") val = snapshot.pragmas.recursive_triggers ? 1 : 0;
  else if (key === "user_version") val = snapshot.pragmas.user_version;
  else if (key === "schema_version") val = snapshot.pragmas.schema_version;

  return {
    sql: rawSql,
    startLine,
    ok: true,
    isQuery: true,
    columns: [key],
    rows: [[val]],
    rowsAffected: 0,
    elapsedMs: 1,
    message: "1 row returned in 1ms",
  };
}

function executeSqlBatchReal(
  state: DatabaseState,
  stmts: RawStatement[],
  source: "User" | "DB Browser",
  batchStart: number
): { nextState: DatabaseState; batch: BatchExecutionResult } {
  const timings: number[] = [];
  const { results: real, snapshot } = runRealBatch(
    state.working,
    stmts.map((x) => x.sql),
    (_i, _r, ms) => timings.push(ms)
  );
  const newLogs: SqlLogEntry[] = [];
  let nextLogId = state.nextLogId;
  const results: StatementResult[] = [];
  let lastQueryResult: StatementResult | null = null;
  let mutated = false;
  real.forEach((r, i) => {
    const ms = timings[i] || 1;
    let message: string;
    if (!r.ok) message = r.error || "error";
    else if (r.isQuery) message = r.rows.length + " rows returned in " + ms + "ms";
    else message = "query executed successfully. Took " + ms + "ms" + (r.rowsAffected ? ", " + r.rowsAffected + " rows affected" : "");
    const clean = stripAllComments(stmts[i].sql).trim();
    const single = clean.match(/^SELECT\s+\*\s+FROM\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s*;?$/i);
    const editable = r.ok && r.isQuery && single ? findTableKey(snapshot, stripIdentifierQuotes(single[1])) : null;
    if (r.ok && !r.isQuery && !/^(SELECT|PRAGMA)/i.test(clean)) mutated = true;
    const res: StatementResult = {
      sql: stmts[i].sql,
      startLine: stmts[i].startLine,
      ok: r.ok,
      isQuery: r.isQuery,
      columns: r.columns,
      rows: r.rows,
      rowsAffected: r.rowsAffected,
      elapsedMs: ms,
      message,
      error: r.ok ? undefined : r.error,
      editableTable: editable || undefined,
      sourceRowIndices: editable ? r.rows.map((_, idx) => idx) : undefined,
    };
    results.push(res);
    newLogs.push({ id: nextLogId++, timestamp: nowTimestamp(), source, sql: stmts[i].sql, status: r.ok ? "ok" : "error", message });
    if (r.ok && r.isQuery) lastQueryResult = res;
  });
  const allOk = results.every((r) => r.ok);
  const lastRes = results[results.length - 1];
  const summaryText = lastRes
    ? (allOk
        ? "Execution finished without errors.\nResult: " + lastRes.message
        : "Execution finished with errors.\nResult: " + (lastRes.error || lastRes.message)) +
      "\nAt line " + lastRes.startLine + ":\n" + lastRes.sql
    : "";
  return {
    nextState: {
      committed: state.committed,
      working: snapshot,
      dirty: state.dirty || mutated,
      attachedDatabases: state.attachedDatabases,
      sqlLog: state.sqlLog.concat(newLogs),
      nextLogId,
    },
    batch: { ok: allOk, statements: results, lastQueryResult, summaryText, totalElapsedMs: Math.max(1, Date.now() - batchStart) },
  };
}

export function executeSqlBatch(
  state: DatabaseState,
  script: string,
  source: "User" | "DB Browser" = "User"
): { nextState: DatabaseState; batch: BatchExecutionResult } {
  const stmts = splitSqlStatements(script);
  const working = deepClone(state.working);
  let mutated = false;
  const results: StatementResult[] = [];
  let lastQueryResult: StatementResult | null = null;
  let allOk = true;
  const newLogs: SqlLogEntry[] = [];
  let nextLogId = state.nextLogId;
  const batchStart = Date.now();

  if (stmts.length === 0) {
    return {
      nextState: state,
      batch: {
        ok: true,
        statements: [],
        lastQueryResult: null,
        summaryText: "Execution finished without errors.\nNo SQL statements to execute.",
        totalElapsedMs: 1,
      },
    };
  }

  if (hasRealSqlite()) {
    return executeSqlBatchReal(state, stmts, source, batchStart);
  }

  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    const clean = stripAllComments(stmt.sql).trim();
    const upper = clean.toUpperCase();
    let res: StatementResult;

    if (upper.indexOf("SELECT") === 0 || upper.indexOf("WITH") === 0) {
      res = executeSelect(working, stmt.sql, stmt.startLine);
    } else if (upper.indexOf("PRAGMA") === 0) {
      res = executePragma(working, stmt.sql, stmt.startLine);
      if (clean.indexOf("=") !== -1 && clean.toLowerCase().indexOf("table_info") === -1) {
        mutated = true;
      }
    } else if (upper.indexOf("INSERT") === 0) {
      const t0 = Date.now();
      const ins = executeInsert(working, stmt.sql);
      const ms = Math.max(1, Date.now() - t0);
      if (ins.ok) mutated = true;
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok: ins.ok,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: ins.rowsAffected,
        elapsedMs: ms,
        message: ins.ok ? "query executed successfully. Took " + ms + "ms, " + ins.rowsAffected + " rows affected" : ins.message,
        error: ins.ok ? undefined : ins.message,
      };
    } else if (upper.indexOf("UPDATE") === 0) {
      const t0 = Date.now();
      const upd = executeUpdate(working, stmt.sql);
      const ms = Math.max(1, Date.now() - t0);
      if (upd.ok && upd.rowsAffected > 0) mutated = true;
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok: upd.ok,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: upd.rowsAffected,
        elapsedMs: ms,
        message: upd.ok ? "query executed successfully. Took " + ms + "ms, " + upd.rowsAffected + " rows affected" : upd.message,
        error: upd.ok ? undefined : upd.message,
      };
    } else if (upper.indexOf("DELETE") === 0) {
      const t0 = Date.now();
      const del = executeDelete(working, stmt.sql);
      const ms = Math.max(1, Date.now() - t0);
      if (del.ok && del.rowsAffected > 0) mutated = true;
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok: del.ok,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: del.rowsAffected,
        elapsedMs: ms,
        message: del.ok ? "query executed successfully. Took " + ms + "ms, " + del.rowsAffected + " rows affected" : del.message,
        error: del.ok ? undefined : del.message,
      };
    } else if (/^CREATE\s+TABLE\b/i.test(clean)) {
      const t0 = Date.now();
      const ct = parseCreateTable(working, stmt.sql);
      const ms = Math.max(1, Date.now() - t0);
      if (ct.ok) mutated = true;
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok: ct.ok,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: 0,
        elapsedMs: ms,
        message: ct.ok ? "query executed successfully. Took " + ms + "ms" : ct.message,
        error: ct.ok ? undefined : ct.message,
      };
    } else if (/^DROP\s+TABLE\b/i.test(clean)) {
      const m = clean.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_"`[\]]+)\s*;?$/i);
      const tbl = m ? stripIdentifierQuotes(m[1]) : "";
      const tKey = tbl ? findTableKey(working, tbl) : null;
      if (!tKey) {
        const ignore = /IF\s+EXISTS/i.test(clean);
        res = {
          sql: stmt.sql,
          startLine: stmt.startLine,
          ok: ignore,
          isQuery: false,
          columns: [],
          rows: [],
          rowsAffected: 0,
          elapsedMs: 1,
          message: ignore ? "query executed successfully." : "no such table: " + tbl,
          error: ignore ? undefined : "no such table: " + tbl,
        };
      } else {
        delete working.tables[tKey];
        working.tableOrder = working.tableOrder.filter((n) => n !== tKey);
        working.indices = working.indices.filter((idx) => idx.tableName !== tKey);
        mutated = true;
        res = {
          sql: stmt.sql,
          startLine: stmt.startLine,
          ok: true,
          isQuery: false,
          columns: [],
          rows: [],
          rowsAffected: 0,
          elapsedMs: 1,
          message: "query executed successfully. Took 1ms",
        };
      }
    } else if (/^ALTER\s+TABLE\b/i.test(clean)) {
      const renameM = clean.match(/^ALTER\s+TABLE\s+([A-Za-z0-9_"`[\]]+)\s+RENAME\s+TO\s+([A-Za-z0-9_"`[\]]+)\s*;?$/i);
      const addColM = clean.match(/^ALTER\s+TABLE\s+([A-Za-z0-9_"`[\]]+)\s+ADD\s+(?:COLUMN\s+)?([A-Za-z0-9_"`[\]]+)\s*([\s\S]*?)\s*;?$/i);
      if (renameM) {
        const oldKey = findTableKey(working, stripIdentifierQuotes(renameM[1]));
        const newName = stripIdentifierQuotes(renameM[2]);
        if (!oldKey) {
          res = { sql: stmt.sql, startLine: stmt.startLine, ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "no such table", error: "no such table: " + renameM[1] };
        } else {
          const tbl = working.tables[oldKey];
          delete working.tables[oldKey];
          tbl.name = newName;
          working.tables[newName] = tbl;
          working.tableOrder = working.tableOrder.map((n) => (n === oldKey ? newName : n));
          mutated = true;
          res = { sql: stmt.sql, startLine: stmt.startLine, ok: true, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "query executed successfully." };
        }
      } else if (addColM) {
        const tKey = findTableKey(working, stripIdentifierQuotes(addColM[1]));
        const colName = stripIdentifierQuotes(addColM[2]);
        const rest = addColM[3].trim();
        if (!tKey) {
          res = { sql: stmt.sql, startLine: stmt.startLine, ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "no such table", error: "no such table: " + addColM[1] };
        } else {
          const typeM = rest.match(/^([A-Za-z]+(?:\s*\([^)]+\))?)/);
          const colType = typeM ? typeM[1].toUpperCase() : "TEXT";
          working.tables[tKey].columns.push({
            name: colName,
            type: colType,
            notNull: /\bNOT\s+NULL\b/i.test(rest),
            primaryKey: false,
            autoIncrement: false,
            defaultValue: null,
            definitionSql: rest || colType,
          });
          for (let r = 0; r < working.tables[tKey].rows.length; r++) {
            working.tables[tKey].rows[r][colName] = null;
          }
          working.tables[tKey].createSql = working.tables[tKey].createSql.replace(/\)\s*$/, ", " + colName + (rest ? " " + rest : "") + " )");
          mutated = true;
          res = { sql: stmt.sql, startLine: stmt.startLine, ok: true, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "query executed successfully." };
        }
      } else {
        res = { sql: stmt.sql, startLine: stmt.startLine, ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "syntax error near ALTER", error: "syntax error near ALTER" };
      }
    } else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(clean)) {
      const m = clean.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_"`[\]]+)\s+ON\s+([A-Za-z0-9_"`[\]]+)\s*\(([^)]+)\)\s*;?$/i);
      if (!m) {
        res = { sql: stmt.sql, startLine: stmt.startLine, ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "syntax error near INDEX", error: "syntax error near INDEX" };
      } else {
        const idxName = stripIdentifierQuotes(m[2]);
        const tKey = findTableKey(working, stripIdentifierQuotes(m[3]));
        if (!tKey) {
          res = { sql: stmt.sql, startLine: stmt.startLine, ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "no such table: " + m[3], error: "no such table: " + m[3] };
        } else {
          working.indices.push({
            name: idxName,
            tableName: tKey,
            columns: m[4].split(",").map((c) => stripIdentifierQuotes(c)),
            unique: Boolean(m[1]),
            createSql: clean.replace(/;$/, ""),
          });
          mutated = true;
          res = { sql: stmt.sql, startLine: stmt.startLine, ok: true, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "query executed successfully." };
        }
      }
    } else if (/^DROP\s+INDEX\b/i.test(clean)) {
      const m = clean.match(/^DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_"`[\]]+)\s*;?$/i);
      const name = m ? stripIdentifierQuotes(m[1]) : "";
      const before = working.indices.length;
      working.indices = working.indices.filter((idx) => idx.name.toLowerCase() !== name.toLowerCase());
      const removed = working.indices.length < before;
      if (removed) mutated = true;
      const ok = removed || /IF\s+EXISTS/i.test(clean);
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: 0,
        elapsedMs: 1,
        message: ok ? "query executed successfully." : "no such index: " + name,
        error: ok ? undefined : "no such index: " + name,
      };
    } else if (/^CREATE\s+VIEW\b/i.test(clean)) {
      const m = clean.match(/^CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_"`[\]]+)\s+AS\s+([\s\S]+?)\s*;?$/i);
      if (!m) {
        res = { sql: stmt.sql, startLine: stmt.startLine, ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "syntax error near VIEW", error: "syntax error near VIEW" };
      } else {
        const viewName = stripIdentifierQuotes(m[1]);
        working.views.push({ name: viewName, selectSql: m[2], createSql: clean.replace(/;$/, "") });
        mutated = true;
        res = { sql: stmt.sql, startLine: stmt.startLine, ok: true, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: "query executed successfully." };
      }
    } else if (/^DROP\s+VIEW\b/i.test(clean)) {
      const m = clean.match(/^DROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_"`[\]]+)\s*;?$/i);
      const name = m ? stripIdentifierQuotes(m[1]) : "";
      const before = working.views.length;
      working.views = working.views.filter((v) => v.name.toLowerCase() !== name.toLowerCase());
      const removed = working.views.length < before;
      if (removed) mutated = true;
      const ok = removed || /IF\s+EXISTS/i.test(clean);
      res = { sql: stmt.sql, startLine: stmt.startLine, ok, isQuery: false, columns: [], rows: [], rowsAffected: 0, elapsedMs: 1, message: ok ? "query executed successfully." : "no such view: " + name, error: ok ? undefined : "no such view: " + name };
    } else if (/^(BEGIN|COMMIT|END|ROLLBACK|VACUUM|REINDEX|ANALYZE)\b/i.test(clean)) {
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok: true,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: 0,
        elapsedMs: 1,
        message: "query executed successfully. Took 1ms",
      };
    } else {
      const firstWord = clean.split(/\s+/)[0] || clean;
      const errMsg = "near \"" + firstWord + "\": syntax error";
      res = {
        sql: stmt.sql,
        startLine: stmt.startLine,
        ok: false,
        isQuery: false,
        columns: [],
        rows: [],
        rowsAffected: 0,
        elapsedMs: 1,
        message: errMsg,
        error: errMsg,
      };
    }

    results.push(res);
    newLogs.push({
      id: nextLogId++,
      timestamp: nowTimestamp(),
      source,
      sql: stmt.sql,
      status: res.ok ? "ok" : "error",
      message: res.message,
    });

    if (res.ok && res.isQuery) {
      lastQueryResult = res;
    }

    if (!res.ok) {
      allOk = false;
      break;
    }
  }

  const totalElapsedMs = Math.max(1, Date.now() - batchStart);
  const lastRes = results[results.length - 1];
  let summaryText = "";
  if (allOk && lastRes) {
    summaryText =
      "Execution finished without errors.\n" +
      "Result: " +
      lastRes.message +
      "\n" +
      "At line " +
      lastRes.startLine +
      ":\n" +
      lastRes.sql;
  } else if (lastRes) {
    summaryText =
      "Execution finished with errors.\n" +
      "Result: " +
      (lastRes.error || lastRes.message) +
      "\n" +
      "At line " +
      lastRes.startLine +
      ":\n" +
      lastRes.sql;
  }

  const nextState: DatabaseState = {
    committed: state.committed,
    working: allOk ? working : state.working,
    dirty: allOk ? state.dirty || mutated : state.dirty,
    attachedDatabases: state.attachedDatabases,
    sqlLog: state.sqlLog.concat(newLogs),
    nextLogId,
  };

  return {
    nextState,
    batch: {
      ok: allOk,
      statements: results,
      lastQueryResult,
      summaryText,
      totalElapsedMs,
    },
  };
}

/** Table edits made in the grid (edit cell, add record, delete record) also go through the real engine, so constraints are enforced. */
function mutateReal(state: DatabaseState, sql: string, logSql: string, okMessage: string): DatabaseState {
  const { results, snapshot } = runRealBatch(state.working, [sql]);
  const res = results[0];
  const entry: SqlLogEntry = {
    id: state.nextLogId,
    timestamp: nowTimestamp(),
    source: "DB Browser",
    sql: logSql,
    status: res.ok ? "ok" : "error",
    message: res.ok ? okMessage : res.error || "error",
  };
  return {
    committed: state.committed,
    working: res.ok ? snapshot : state.working,
    dirty: res.ok ? true : state.dirty,
    attachedDatabases: state.attachedDatabases,
    sqlLog: state.sqlLog.concat([entry]),
    nextLogId: state.nextLogId + 1,
  };
}

const rowidOf = (tKey: string, rowIndex: number): string =>
  "(SELECT rowid FROM " + JSON.stringify(tKey) + " ORDER BY rowid LIMIT 1 OFFSET " + rowIndex + ")";

export function updateTableCell(
  state: DatabaseState,
  tableName: string,
  rowIndex: number,
  columnName: string,
  newValue: SqlValue
): DatabaseState {
  const working = deepClone(state.working);
  const tKey = findTableKey(working, tableName);
  if (!tKey) return state;
  const table = working.tables[tKey];
  if (rowIndex < 0 || rowIndex >= table.rows.length) return state;
  const col = findColumnName(table, columnName);
  if (!col) return state;

  if (hasRealSqlite()) {
    return mutateReal(
      state,
      "UPDATE " + JSON.stringify(tKey) + " SET " + JSON.stringify(col) + " = " + formatSqlLiteral(newValue) + " WHERE rowid = " + rowidOf(tKey, rowIndex),
      "UPDATE " + tKey + " SET " + col + " = " + formatSqlLiteral(newValue) + " WHERE rowid = " + (rowIndex + 1) + ";",
      "1 row affected"
    );
  }
  table.rows[rowIndex][col] = newValue;

  const pkCol = table.columns.find((c) => c.primaryKey);
  const wherePart = pkCol
    ? pkCol.name + " = " + formatSqlLiteral(table.rows[rowIndex][pkCol.name])
    : "rowid = " + (rowIndex + 1);

  return {
    committed: state.committed,
    working,
    dirty: true,
    attachedDatabases: state.attachedDatabases,
    sqlLog: state.sqlLog.concat([
      {
        id: state.nextLogId,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql:
          "UPDATE " +
          tKey +
          " SET " +
          col +
          " = " +
          formatSqlLiteral(newValue) +
          " WHERE " +
          wherePart +
          ";",
        status: "ok",
        message: "1 row affected",
      },
    ]),
    nextLogId: state.nextLogId + 1,
  };
}

export function insertBlankRecord(state: DatabaseState, tableName: string): DatabaseState {
  const working = deepClone(state.working);
  const tKey = findTableKey(working, tableName);
  if (!tKey) return state;
  const table = working.tables[tKey];
  if (hasRealSqlite()) {
    return mutateReal(state, "INSERT INTO " + JSON.stringify(tKey) + " DEFAULT VALUES", "INSERT INTO " + tKey + " DEFAULT VALUES;", "1 row inserted");
  }
  const row: Record<string, SqlValue> = {};

  for (let i = 0; i < table.columns.length; i++) {
    const col = table.columns[i];
    if (col.primaryKey && col.type.indexOf("INT") !== -1) {
      let maxId = 0;
      for (let r = 0; r < table.rows.length; r++) {
        const rv = toNum(table.rows[r][col.name]);
        if (rv > maxId) maxId = rv;
      }
      row[col.name] = maxId + 1;
    } else if (col.primaryKey) {
      row[col.name] = "NEW_" + (table.rows.length + 1);
    } else if (col.defaultValue !== null) {
      row[col.name] = col.defaultValue;
    } else if (col.notNull) {
      if (col.type.indexOf("INT") !== -1 || col.type.indexOf("DEC") !== -1 || col.type.indexOf("REAL") !== -1) {
        row[col.name] = 0;
      } else {
        row[col.name] = "";
      }
    } else {
      row[col.name] = null;
    }
  }

  table.rows.push(row);
  return {
    committed: state.committed,
    working,
    dirty: true,
    attachedDatabases: state.attachedDatabases,
    sqlLog: state.sqlLog.concat([
      {
        id: state.nextLogId,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql: "INSERT INTO " + tKey + " DEFAULT VALUES;",
        status: "ok",
        message: "1 row inserted",
      },
    ]),
    nextLogId: state.nextLogId + 1,
  };
}

export function deleteTableRow(state: DatabaseState, tableName: string, rowIndex: number): DatabaseState {
  const working = deepClone(state.working);
  const tKey = findTableKey(working, tableName);
  if (!tKey) return state;
  const table = working.tables[tKey];
  if (rowIndex < 0 || rowIndex >= table.rows.length) return state;

  if (hasRealSqlite()) {
    return mutateReal(
      state,
      "DELETE FROM " + JSON.stringify(tKey) + " WHERE rowid = " + rowidOf(tKey, rowIndex),
      "DELETE FROM " + tKey + " WHERE rowid = " + (rowIndex + 1) + ";",
      "1 row deleted"
    );
  }
  table.rows.splice(rowIndex, 1);
  return {
    committed: state.committed,
    working,
    dirty: true,
    attachedDatabases: state.attachedDatabases,
    sqlLog: state.sqlLog.concat([
      {
        id: state.nextLogId,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql: "DELETE FROM " + tKey + " WHERE rowid = " + (rowIndex + 1) + ";",
        status: "ok",
        message: "1 row deleted",
      },
    ]),
    nextLogId: state.nextLogId + 1,
  };
}

export function formatSqlLiteral(val: SqlValue): string {
  if (val === null) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

export function detectCellDataType(val: SqlValue): "NULL" | "Integer" | "Real" | "Text" {
  if (val === null) return "NULL";
  if (typeof val === "number") {
    return Number.isInteger(val) ? "Integer" : "Real";
  }
  if (typeof val === "boolean") return "Integer";
  return "Text";
}

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function exportResultToCsv(columns: string[], rows: SqlValue[][]): string {
  const escape = (v: SqlValue): string => {
    if (v === null) return "";
    const s = String(v);
    if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [columns.map((c) => escape(c)).join(",")];
  for (let r = 0; r < rows.length; r++) {
    lines.push(rows[r].map((v) => escape(v)).join(","));
  }
  return lines.join("\n");
}

export function exportDatabaseToSql(snapshot: SqlSnapshot): string {
  const lines: string[] = [
    "-- DB Browser for SQLite SQL Dump",
    "-- Database: " + snapshot.dbPath,
    "BEGIN TRANSACTION;",
    "",
  ];
  for (let i = 0; i < snapshot.tableOrder.length; i++) {
    const name = snapshot.tableOrder[i];
    if (name === "sqlite_sequence") continue;
    const t = snapshot.tables[name];
    lines.push(t.createSql + ";");
    for (let r = 0; r < t.rows.length; r++) {
      const row = t.rows[r];
      const vals = t.columns.map((c) => formatSqlLiteral(row[c.name] ?? null)).join(", ");
      lines.push("INSERT INTO " + t.name + " VALUES (" + vals + ");");
    }
    lines.push("");
  }
  for (let i = 0; i < snapshot.indices.length; i++) {
    lines.push(snapshot.indices[i].createSql + ";");
  }
  for (let i = 0; i < snapshot.views.length; i++) {
    lines.push(snapshot.views[i].createSql + ";");
  }
  lines.push("COMMIT;");
  return lines.join("\n");
}

export function applyPragmaUpdate<K extends keyof PragmaState>(
  state: DatabaseState,
  key: K,
  value: PragmaState[K]
): DatabaseState {
  const working = deepClone(state.working);
  working.pragmas[key] = value;
  const formatted = typeof value === "boolean" ? (value ? "ON" : "OFF") : String(value);
  return {
    committed: state.committed,
    working,
    dirty: true,
    attachedDatabases: state.attachedDatabases,
    sqlLog: state.sqlLog.concat([
      {
        id: state.nextLogId,
        timestamp: nowTimestamp(),
        source: "DB Browser",
        sql: "PRAGMA " + key + " = " + formatted + ";",
        status: "ok",
        message: "PRAGMA applied",
      },
    ]),
    nextLogId: state.nextLogId + 1,
  };
}
