/**
 * DuckDB SQL quoting shared by every module that generates SQL text.
 *
 * Uploaded column names, worksheet names, virtual file paths and mapped values
 * are user-controlled, so they must never be interpolated into SQL unquoted.
 * DuckDB follows the SQL standard: double quotes delimit identifiers and single
 * quotes delimit string literals; an embedded delimiter is escaped by doubling.
 *
 * Keep this module dependency-free: it is imported by the accounting pipeline,
 * evidence capture, diagnostics and the legacy compatibility adapter alike.
 */

/** Quotes an identifier (table, column or schema name): `a"b` → `"a""b"`. */
export const quoteIdentifier = (value: string) =>
  `"${value.replaceAll('"', '""')}"`

/** Quotes a string literal (text value or file path): `it's` → `'it''s'`. */
export const quoteLiteral = (value: string) =>
  `'${value.replaceAll("'", "''")}'`
