// better-sqlite3-multiple-ciphers is an API-compatible fork of better-sqlite3
// (adds cipher/key pragma support) with no published types of its own.
declare module 'better-sqlite3-multiple-ciphers' {
  import Database = require('better-sqlite3');
  export = Database;
}
