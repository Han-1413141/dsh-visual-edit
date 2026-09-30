import React, { useState, type ReactNode } from "react";
import { type ReviewNote } from "../shared/model";
import { type CopyKey, type Translate } from "./locales";
import { Icon } from "./icons";
const STATUS: Record<ReviewNote["status"], CopyKey> = {
  draft: "stateDraft",
  queued: "stateQueued",
  review: "stateReview",
  confirmed: "stateConfirmed",
};

export function NoteList({
  notes,
  matching,
  currentId,
  t,
  disabled,
  canInsert,
  batch,
  setBatch,
  onActivate,
  onAdd,
  onCopy,
  source,
}: {
  notes: ReviewNote[];
  matching: ReviewNote[];
  currentId?: string;
  t: Translate;
  disabled: boolean;
  canInsert: boolean;
  batch: boolean;
  setBatch: (value: boolean) => void;
  onActivate: (id: string) => void;
  onAdd: (notes: ReviewNote[]) => Promise<boolean>;
  onCopy: (notes: ReviewNote[]) => Promise<boolean>;
  source: (note: ReviewNote) => ReactNode;
}) {
  // Keep the selected revisions, not just IDs, so a background refresh cannot
  // silently change the feedback the user has chosen to send.
  const [picked, setPicked] = useState<ReviewNote[]>([]);
  const visible = matching.filter((n) => n.status !== "confirmed");
  const allVisible =
    !!visible.length && visible.every((n) => picked.some((p) => p.id === n.id));
  const conflict = picked.some((p) => {
    const latest = notes.find((n) => n.id === p.id);
    return (
      !latest || latest.revision !== p.revision || latest.status === "confirmed"
    );
  });
  const ordered = [...picked].sort(
    (a, b) =>
      a.before.capturedAt.localeCompare(b.before.capturedAt) ||
      a.id.localeCompare(b.id),
  );
  const toggle = (note: ReviewNote) =>
    setPicked((items) =>
      items.some((n) => n.id === note.id)
        ? items.filter((n) => n.id !== note.id)
        : [...items, note],
    );
  return (
    <>
      <div className="ve-batch-toggle">
        <button
          className={batch ? "ve-tool-action" : ""}
          disabled={disabled}
          aria-pressed={batch}
          onClick={() => {
            setBatch(!batch);
            setPicked([]);
          }}
        >
          <Icon name="checklist" width="14" height="14" />
          {t(batch ? "finishSelecting" : "selectSeveral")}
        </button>
        {batch && (
          <label className="ve-check-label">
            <input
              type="checkbox"
              aria-label={t("selectVisible")}
              disabled={disabled || !visible.length}
              checked={allVisible}
              onChange={() =>
                setPicked((items) =>
                  allVisible
                    ? items.filter((n) => !visible.some((v) => v.id === n.id))
                    : [
                        ...items.filter(
                          (n) => !visible.some((v) => v.id === n.id),
                        ),
                        ...visible,
                      ],
                )
              }
            />
            {t("selectVisible")}
          </label>
        )}
      </div>
      {batch && (
        <div
          className="ve-batch-bar"
          role="group"
          aria-label={t("batchActions")}
        >
          <span>
            {t("batchCount").replace("{count}", String(picked.length))}
          </span>
          <button
            className="ve-primary"
            disabled={disabled || !canInsert || !picked.length || conflict}
            onClick={async () => {
              if (await onAdd(ordered)) {
                setPicked([]);
                setBatch(false);
              }
            }}
          >
            <Icon name="arrow" width="14" height="14" />
            {t("addSelected")}
          </button>
          <button
            className="ve-icon"
            aria-label={t("copySelected")}
            title={t("copySelected")}
            disabled={disabled || !picked.length || conflict}
            onClick={() => void onCopy(ordered)}
          >
            <Icon name="copy" width="14" height="14" />
          </button>
          <button
            className="ve-icon"
            aria-label={t("clearSelection")}
            title={t("clearSelection")}
            disabled={disabled || !picked.length}
            onClick={() => setPicked([])}
          >
            <Icon name="close" width="14" height="14" />
          </button>
        </div>
      )}
      {batch && conflict && (
        <p className="ve-batch-conflict" role="alert">
          {t("batchConflict")}
        </p>
      )}
      <div className="ve-list">
        {matching.map((note, index) => (
          <div className="ve-note-row" key={note.id}>
            {batch && (
              <input
                type="checkbox"
                className="ve-note-checkbox"
                aria-label={`${t("selectNote")} ${index + 1}: ${note.comment.slice(0, 80)}`}
                checked={picked.some((n) => n.id === note.id)}
                disabled={disabled || note.status === "confirmed"}
                onChange={() => toggle(note)}
              />
            )}
            <button
              className={`ve-note ${currentId === note.id ? "is-active" : ""}`}
              aria-pressed={currentId === note.id}
              onClick={() => onActivate(note.id)}
            >
              <span className="ve-note-status-icon">
                <Icon
                  name={note.status === "confirmed" ? "check" : "notes"}
                  width="15"
                  height="15"
                />
              </span>
              <span className="ve-note-content">
                <span>{note.comment}</span>
                {source(note)}
              </span>
              <span className={`ve-status ve-status-${note.status}`}>
                {t(STATUS[note.status])}
              </span>
            </button>
          </div>
        ))}
        {!matching.length && <p className="ve-no-matches">{t("noMatches")}</p>}
      </div>
    </>
  );
}
