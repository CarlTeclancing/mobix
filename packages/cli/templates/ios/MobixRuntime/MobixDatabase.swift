import Foundation
import CoreFoundation
import SQLite3

/// Small, dependency-free SQLite wrapper used by the Mobix iOS runtime.
/// It mirrors the Android `SQLite.execute` / `SQLite.query` contract.
final class MobixDatabase {
    private var handle: OpaquePointer?
    private let queue = DispatchQueue(label: "dev.mobix.sqlite")

    init?(path: URL) {
        guard sqlite3_open_v2(path.path, &handle, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            sqlite3_close(handle)
            handle = nil
            return nil
        }
    }

    deinit { sqlite3_close(handle) }

    private var errorMessage: String {
        guard let handle, let message = sqlite3_errmsg(handle) else { return "SQLite error" }
        return String(cString: message)
    }

    private static func isReadOnly(_ sql: String) -> Bool {
        return sql.range(of: "(?is)^SELECT\\s+.*", options: .regularExpression) != nil
    }

    private func validated(_ sql: String) -> String? {
        let trimmed = sql.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 10_000, !trimmed.contains(";") else { return nil }
        let pattern = MobixDatabase.isReadOnly(trimmed)
            ? "(?is)^SELECT\\s+.*"
            : "(?is)^(INSERT|UPDATE|DELETE|CREATE TABLE|CREATE INDEX|DROP TABLE)\\s+.*"
        return trimmed.range(of: pattern, options: .regularExpression) != nil ? trimmed : nil
    }

    private func bind(_ statement: OpaquePointer?, _ args: [Any]) {
        for (offset, arg) in args.prefix(100).enumerated() {
            let index = Int32(offset + 1)
            switch arg {
            case is NSNull:
                sqlite3_bind_null(statement, index)
            case let value as NSNumber:
                if CFGetTypeID(value) == CFBooleanGetTypeID() {
                    sqlite3_bind_int(statement, index, Int32(value.boolValue ? 1 : 0))
                } else if value.doubleValue == value.doubleValue.rounded() && abs(value.doubleValue) < 9.2e18 {
                    sqlite3_bind_int64(statement, index, value.int64Value)
                } else {
                    sqlite3_bind_double(statement, index, value.doubleValue)
                }
            case let value as String:
                sqlite3_bind_text(statement, index, value, -1, SQLITE_TRANSIENT)
            default:
                sqlite3_bind_text(statement, index, String(describing: arg), -1, SQLITE_TRANSIENT)
            }
        }
    }

    func execute(sql: String, args: [Any]) -> Result<Int, MobixDatabaseError> {
        queue.sync { () -> Result<Int, MobixDatabaseError> in
            guard let sql = validated(sql) else { return .failure(.invalidStatement) }
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
                return .failure(.sqlite(errorMessage))
            }
            defer { sqlite3_finalize(statement) }
            bind(statement, args)
            guard sqlite3_step(statement) == SQLITE_DONE else { return .failure(.sqlite(errorMessage)) }
            return .success(Int(sqlite3_changes(handle)))
        }
    }

    func query(sql: String, args: [Any]) -> Result<[[String: Any]], MobixDatabaseError> {
        queue.sync { () -> Result<[[String: Any]], MobixDatabaseError> in
            guard let sql = validated(sql) else { return .failure(.invalidStatement) }
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
                return .failure(.sqlite(errorMessage))
            }
            defer { sqlite3_finalize(statement) }
            bind(statement, args)
            var rows: [[String: Any]] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                guard rows.count < 1000 else { return .failure(.tooManyRows) }
                var row: [String: Any] = [:]
                for column in 0..<sqlite3_column_count(statement) {
                    let name = String(cString: sqlite3_column_name(statement, column))
                    switch sqlite3_column_type(statement, column) {
                    case SQLITE_NULL:
                        row[name] = NSNull()
                    case SQLITE_INTEGER:
                        row[name] = Int(sqlite3_column_int64(statement, column))
                    case SQLITE_FLOAT:
                        row[name] = sqlite3_column_double(statement, column)
                    case SQLITE_BLOB:
                        if let bytes = sqlite3_column_blob(statement, column) {
                            let count = Int(sqlite3_column_bytes(statement, column))
                            row[name] = Data(bytes: bytes, count: count).base64EncodedString()
                        } else {
                            row[name] = ""
                        }
                    default:
                        if let text = sqlite3_column_text(statement, column) {
                            row[name] = String(cString: text)
                        } else {
                            row[name] = NSNull()
                        }
                    }
                }
                rows.append(row)
            }
            return .success(rows)
        }
    }
}

enum MobixDatabaseError: Error {
    case invalidStatement
    case tooManyRows
    case sqlite(String)

    var code: String {
        switch self {
        case .invalidStatement: return "INVALID_REQUEST"
        case .tooManyRows: return "INVALID_REQUEST"
        case .sqlite: return "NATIVE_ERROR"
        }
    }

    var message: String {
        switch self {
        case .invalidStatement: return "SQL statement not permitted"
        case .tooManyRows: return "Query result limit exceeded"
        case .sqlite(let message): return message
        }
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
