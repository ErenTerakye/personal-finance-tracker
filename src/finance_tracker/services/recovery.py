"""Complete-ledger backup, verification, and restore workflows."""

import os
import sqlite3
import tempfile
from dataclasses import dataclass
from pathlib import Path

from finance_tracker.database import (
    SCHEMA_VERSION,
    initialize_database,
    schema_contract_violations,
)
from finance_tracker.exceptions import ValidationError


@dataclass(frozen=True)
class LedgerVerification:
    path: Path
    schema_version: int
    integrity: str


class LedgerRecoveryService:
    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)

    @staticmethod
    def verify(path: Path | str) -> LedgerVerification:
        candidate = Path(path)
        if not candidate.is_file():
            raise ValidationError(f"Ledger file does not exist: {candidate}")
        try:
            connection = sqlite3.connect(
                f"file:{candidate.resolve()}?mode=ro",
                uri=True,
                autocommit=True,
            )
            try:
                integrity = str(connection.execute("PRAGMA integrity_check").fetchone()[0])
                schema_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
                foreign_key_rows = connection.execute("PRAGMA foreign_key_check").fetchall()
                schema_violations = schema_contract_violations(connection, schema_version)
            finally:
                connection.close()
        except sqlite3.Error as exc:
            raise ValidationError(f"Cannot read ledger backup: {exc}") from exc
        if integrity != "ok":
            raise ValidationError(f"Ledger integrity check failed: {integrity}")
        if schema_version != SCHEMA_VERSION:
            raise ValidationError(
                f"Unsupported ledger schema version {schema_version}; "
                f"this app requires schema version {SCHEMA_VERSION}. Back up old "
                "ledgers, then rebuild or import their activity data into a new ledger."
            )
        if foreign_key_rows:
            first = foreign_key_rows[0]
            raise ValidationError(
                "Ledger foreign key check failed: "
                f"table {first[0]}, row {first[1]}, parent {first[2]}."
            )
        if schema_violations:
            raise ValidationError(
                "Ledger schema does not match its declared version: " + "; ".join(schema_violations)
            )
        return LedgerVerification(candidate, schema_version, integrity)

    def backup(self, destination: Path | str, *, overwrite: bool = False) -> LedgerVerification:
        initialize_database(self.db_path)
        target = Path(destination)
        if target.resolve() == self.db_path.resolve():
            raise ValidationError("Backup destination must differ from the active ledger.")
        if target.exists() and not overwrite:
            raise ValidationError(
                f"Backup already exists: {target}. Use --overwrite to replace it."
            )
        target.parent.mkdir(parents=True, exist_ok=True)

        source = sqlite3.connect(self.db_path, autocommit=True)
        temporary_path: Path | None = None
        try:
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
            )
            os.close(descriptor)
            temporary_path = Path(temporary_name)
            backup = sqlite3.connect(temporary_path, autocommit=True)
            try:
                source.backup(backup)
            finally:
                backup.close()
            self.verify(temporary_path)
            temporary_path.replace(target)
            temporary_path = None
        finally:
            source.close()
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
        return self.verify(target)

    def restore(self, backup_path: Path | str) -> LedgerVerification:
        source_path = Path(backup_path)
        self.verify(source_path)
        if source_path.resolve() == self.db_path.resolve():
            raise ValidationError("Backup source must differ from the active ledger.")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        source = sqlite3.connect(f"file:{source_path.resolve()}?mode=ro", uri=True, autocommit=True)
        temporary_path: Path | None = None
        try:
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{self.db_path.name}.", suffix=".restore", dir=self.db_path.parent
            )
            os.close(descriptor)
            temporary_path = Path(temporary_name)
            restored = sqlite3.connect(temporary_path, autocommit=True)
            try:
                source.backup(restored)
            finally:
                restored.close()
            self.verify(temporary_path)
            initialize_database(temporary_path)
            prepared = self.verify(temporary_path)
            temporary_path.replace(self.db_path)
            temporary_path = None
        finally:
            source.close()
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
        return LedgerVerification(self.db_path, prepared.schema_version, prepared.integrity)
