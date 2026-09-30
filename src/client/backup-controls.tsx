import React, { useEffect, useRef, useState } from "react";
import {
  MAX_BACKUP_BYTES,
  parseBackup,
  serializeBackup,
  type Backup,
} from "../shared/backup";
import { MAX_NOTES, pageLabel, type ReviewNote } from "../shared/model";
import { type Translate, type CopyKey } from "./locales";
import { Icon } from "./icons";

export function BackupControls({
  notes,
  t,
  disabled,
  error,
  onError,
  onRestore,
}: {
  notes: ReviewNote[];
  t: Translate;
  disabled: boolean;
  error?: CopyKey;
  onError: (error: unknown) => void;
  onRestore: (backup: Backup) => Promise<boolean>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const [reading, setReading] = useState(false);
  const [backup, setBackup] = useState<Backup>();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function open(file?: File) {
    if (!file) return;
    setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("backupTooLarge");
      const parsed = parseBackup(await file.text());
      if (alive.current) setBackup(parsed);
    } catch (error) {
      if (alive.current) onError(error);
    } finally {
      if (alive.current) setReading(false);
    }
  }
  return (
    <>
      <button
        className="ve-icon"
        disabled={disabled || !notes.length || reading}
        title={t("export")}
        aria-label={t("export")}
        onClick={() => {
          const href = URL.createObjectURL(
            new Blob([serializeBackup(notes)], { type: "application/json" }),
          );
          const link = document.createElement("a");
          link.href = href;
          link.download = "visual-edit-feedback.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(href), 1000);
        }}
      >
        <Icon name="download" />
      </button>
      <button
        ref={trigger}
        className="ve-icon"
        disabled={disabled || reading}
        title={t("importBackup")}
        aria-label={t("importBackup")}
        onClick={() => input.current?.click()}
      >
        <Icon
          name={reading ? "refresh" : "upload"}
          className={reading ? "ve-spin" : undefined}
        />
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label={t("backupFile")}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void open(file);
        }}
      />
      {backup && (
        <RestoreDialog
          backup={backup}
          notes={notes}
          t={t}
          error={error}
          onClose={() => setBackup(undefined)}
          returnFocus={() => trigger.current?.focus()}
          onRestore={async () => {
            const restored = await onRestore(backup);
            if (restored) {
              if (alive.current) setBackup(undefined);
            }
            return restored;
          }}
        />
      )}
    </>
  );
}
function RestoreDialog({
  backup,
  notes,
  t,
  onClose,
  onRestore,
  returnFocus,
  error,
}: {
  backup: Backup;
  notes: ReviewNote[];
  t: Translate;
  onClose: () => void;
  onRestore: () => Promise<boolean>;
  returnFocus: () => void;
  error?: CopyKey;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => {
      el.close();
      returnFocus();
    };
  }, []);
  const ids = new Set(notes.map((n) => n.id));
  const fresh = backup.notes.filter((n) => !ids.has(n.id));
  const skipped = backup.notes.length - fresh.length;
  const full = notes.length + fresh.length > MAX_NOTES;
  return (
    <dialog
      ref={dialog}
      className="ve-dialog ve-restore-dialog"
      aria-label={t("restoreTitle")}
      onCancel={(e) => {
        e.preventDefault();
        if (!lock.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !lock.current) onClose();
      }}
    >
      <div className="ve-dialog-surface">
        <header>
          <div>
            <strong>{t("restoreTitle")}</strong>
            <p>{t("restoreHint")}</p>
          </div>
          <button
            className="ve-icon"
            aria-label={t("cancel")}
            disabled={saving}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <p className="ve-restore-summary">
          {t("restoreSummary")
            .replace("{count}", String(fresh.length))
            .replace("{skipped}", String(skipped))}
        </p>
        <ul className="ve-restore-list">
          {backup.notes.map((note) => (
            <li key={note.id}>
              <span>{note.comment}</span>
              <small>
                {pageLabel(note.before.url)}
                {ids.has(note.id) ? ` · ${t("alreadySaved")}` : ""}
              </small>
            </li>
          ))}
        </ul>
        <p className="ve-hint">{t("restoreQueuedHint")}</p>
        {full && (
          <p className="ve-error-text" role="alert">
            {t("importLimit")}
          </p>
        )}
        {failed && error && !full && (
          <p className="ve-error-text" role="alert">
            {t(error)}
          </p>
        )}
        <div className="ve-restore-actions">
          <button autoFocus disabled={saving} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="ve-primary"
            disabled={saving || full || !fresh.length}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setSaving(true);
              setFailed(false);
              try {
                if (!(await onRestore())) setFailed(true);
              } finally {
                lock.current = false;
                setSaving(false);
              }
            }}
          >
            {t(saving ? "restoring" : "restore")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
