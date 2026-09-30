import React, { useEffect, useRef, useState } from "react";
import { type ReviewNote, type Snapshot } from "../shared/model";
import { en, type CopyKey, type Translate } from "./locales";
import { Icon } from "./icons";

export function ImageCard({
  snapshot,
  label,
  t,
  onExpand,
}: {
  snapshot: Snapshot;
  label: string;
  t: Translate;
  onExpand?: () => void;
}) {
  return (
    <figure className="ve-image">
      <figcaption>
        <span>{label}</span>
        <time dateTime={snapshot.capturedAt}>
          {new Date(snapshot.capturedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </figcaption>
      {snapshot.image ? (
        <button
          type="button"
          className="ve-image-open"
          disabled={!onExpand}
          onClick={onExpand}
          aria-label={`${t("enlarge")} · ${label}`}
        >
          <img src={snapshot.image} alt={`${label} · ${t("snapshotLabel")}`} />
          {onExpand && (
            <span className="ve-image-zoom">
              <Icon name="expand" />
            </span>
          )}
        </button>
      ) : (
        <div className="ve-image-unavailable">
          <Icon name="code" />
          <p>
            {t(
              snapshot.warning && snapshot.warning in en
                ? (snapshot.warning as CopyKey)
                : "noImage",
            )}
          </p>
        </div>
      )}
    </figure>
  );
}
export function ComparisonDialog({
  note,
  t,
  onClose,
}: {
  note: ReviewNote;
  t: Translate;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [split, setSplit] = useState(50);
  useEffect(() => {
    const el = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      trigger?.focus();
    };
  }, []);
  const width = Math.max(
    1,
    note.before.rect.width,
    note.after?.rect.width ?? 0,
  );
  const height = Math.max(
    1,
    note.before.rect.height,
    note.after?.rect.height ?? 0,
  );
  return (
    <dialog
      ref={dialog}
      className="ve-dialog"
      aria-label={t("imageComparison")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ve-dialog-surface">
        <header>
          <div>
            <strong>{t("imageComparison")}</strong>
            <p>{note.comment}</p>
          </div>
          <button
            autoFocus
            className="ve-icon"
            aria-label={t("closeComparison")}
            title={t("closeComparison")}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="ve-dialog-tools">
          <div className="ve-segment" aria-label={t("comparisonMode")}>
            <button
              aria-pressed={mode === "side"}
              onClick={() => setMode("side")}
            >
              {t("sideBySide")}
            </button>
            <button
              aria-pressed={mode === "overlay"}
              disabled={!note.before.image || !note.after?.image}
              onClick={() => setMode("overlay")}
            >
              {t("overlay")}
            </button>
          </div>
          <small>{t("snapshotLabel")}</small>
        </div>
        {mode === "side" ? (
          <div className="ve-dialog-images ve-comparison">
            <ImageCard snapshot={note.before} label={t("before")} t={t} />
            {note.after && (
              <ImageCard snapshot={note.after} label={t("after")} t={t} />
            )}
          </div>
        ) : (
          <div className="ve-overlay-view">
            <div
              className="ve-overlay-canvas"
              style={{ aspectRatio: `${width}/${height}`, maxWidth: width }}
            >
              <img
                src={note.before.image}
                alt={t("before")}
                style={{ width: `${(note.before.rect.width / width) * 100}%` }}
              />
              <div
                className="ve-overlay-layer"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              >
                <img
                  src={note.after!.image}
                  alt={t("after")}
                  style={{
                    width: `${(note.after!.rect.width / width) * 100}%`,
                  }}
                />
              </div>
              <span
                className="ve-overlay-divider"
                style={{ left: `${split}%` }}
              />
            </div>
            <label className="ve-slider-label">
              <span>{t("after")}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={split}
                aria-label={t("revealResult")}
                onChange={(e) => setSplit(Number(e.target.value))}
              />
              <span>{t("before")}</span>
            </label>
          </div>
        )}
        <footer>{t("comparisonHint")}</footer>
      </div>
    </dialog>
  );
}
