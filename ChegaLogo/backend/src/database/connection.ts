import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const databaseFolder = path.resolve(
  process.cwd(),
  "data"
);

if (!fs.existsSync(databaseFolder)) {
  fs.mkdirSync(databaseFolder, {
    recursive: true
  });
}

const databasePath = path.join(
  databaseFolder,
  "chegalogo.db"
);

export const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("SQLite conectado:", databasePath);
