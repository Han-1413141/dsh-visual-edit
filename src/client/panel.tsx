import React, { useEffect, useRef, useState, type FormEvent } from "react";
import {
  compareSnapshots,
  createNote,
  feedbackText,
  previewUrl,
  type ReviewNote,
  type Snapshot,
} from "../shared/model";
import { deleteNote, putNote, readBoard, saveConfig } from "./storage";
import { useBridge } from "./bridge";
import { en, type CopyKey, type Translate } from "./locales";
import styles from "./styles.css?raw";

export interface InputActions {
  captureInsertion(): { start: number; end: number; draftRev: number };
  insertText(
    text: string,
    span: { start: number; end: number; draftRev: number },
  ): boolean;
}
export interface PanelProps {
  sessionId: string;
  t: Translate;
  inputActions?: InputActions;
}
const STATUS: Record<ReviewNote["status"], CopyKey> = {
  draft: "stateDraft",
  queued: "stateQueued",
  review: "stateReview",
  confirmed: "stateConfirmed",
};
export function CursorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      {...props}
      aria-hidden="true"
    >
      <path
        d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4M10 9l4 12 2-5 5-2-11-5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Source({ snapshot, t }: { snapshot: Snapshot; t: Translate }) {
  const source = snapshot.locator.source;
  return (
    <code className="ve-source" title={source?.file}>
      {source
        ? `${source.file}:${source.line}:${source.column}`
        : t("noSource")}
    </code>
  );
}
function ImageCard({
  snapshot,
  label,
  t,
}: {
  snapshot: Snapshot;
  label: string;
  t: Translate;
}) {
  return (
    <figure className="ve-image">
      <figcaption>
        {label}
        <small>{new Date(snapshot.capturedAt).toLocaleTimeString()}</small>
      </figcaption>
      <div>
        {snapshot.image ? (
          <img src={snapshot.image} alt={`${label} · ${t("snapshotLabel")}`} />
        ) : (
          <p>
            {t(
              snapshot.warning && snapshot.warning in en
                ? (snapshot.warning as CopyKey)
                : "noImage",
            )}
          </p>
        )}
      </div>
    </figure>
  );
}
export function VisualEditPanel(props: PanelProps) {
  return <Board key={props.sessionId} {...props} />;
}
function Board({ sessionId, inputActions, t }: PanelProps) {
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draftUrl, setDraftUrl] = useState("http://localhost:5173");
  const [url, setUrl] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [selected, setSelected] = useState<Snapshot>();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<string>();
  const [active, setActive] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ key: CopyKey; error: boolean }>();
  const [showSetup, setShowSetup] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const broadcast = useRef<BroadcastChannel>();
  const [stageWidth, setStageWidth] = useState(500);
  const reportError = (value: unknown) => {
    const key = value instanceof Error ? value.message : String(value);
    if (alive.current)
      setNotice({ key: key in en ? (key as CopyKey) : "error", error: true });
  };
  const bridge = useBridge(
    frame,
    url,
    (s) => {
      setSelected(s);
      setComment("");
      setEditing(undefined);
      setNotice(undefined);
    },
    reportError,
  );
  useEffect(() => {
    alive.current = true;
    readBoard(sessionId)
      .then((board) => {
        if (!alive.current) return;
        setNotes(board.notes);
        setActive(board.notes.at(-1)?.id);
        if (board.config) {
          try {
            const saved = previewUrl(board.config.url, location.origin);
            setUrl(saved);
            setDraftUrl(saved);
          } catch {
            /* Ignore an invalid saved URL. */
          }
          setViewport(
            board.config.viewport === "mobile" ? "mobile" : "desktop",
          );
        }
        setLoaded(true);
      })
      .catch(reportError);
    const channel = new BroadcastChannel(`dsh-visual-edit:${sessionId}`);
    broadcast.current = channel;
    channel.onmessage = () => {
      readBoard(sessionId)
        .then((board) => {
          if (alive.current) setNotes(board.notes);
        })
        .catch(reportError);
    };
    return () => {
      alive.current = false;
      channel.close();
      broadcast.current = undefined;
    };
  }, [sessionId]);
  useEffect(() => {
    const target = stage.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) =>
      setStageWidth(entries[0].contentRect.width),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loaded]);
  async function refresh() {
    const data = await readBoard(sessionId);
    if (alive.current) setNotes(data.notes);
  }
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await task();
    } catch (error) {
      reportError(error);
      if (error instanceof Error && error.message === "storageConflict")
        await refresh().catch(reportError);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function store(note: ReviewNote, expected: number | null) {
    const saved = await putNote(note, expected);
    if (alive.current) {
      setNotes((items) => [...items.filter((n) => n.id !== saved.id), saved]);
      setActive(saved.id);
    }
    broadcast.current?.postMessage("updated");
    return saved;
  }
  function open(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const next = previewUrl(draftUrl.trim(), location.origin);
      await saveConfig({
        sessionId,
        url: next,
        viewport,
        updatedAt: new Date().toISOString(),
      });
      if (next === url && frame.current) frame.current.src = next;
      setUrl(next);
      setDraftUrl(next);
      setSelected(undefined);
      setShowSetup(false);
    });
  }
  async function changeViewport(value: "desktop" | "mobile") {
    await saveConfig({
      sessionId,
      url: url || draftUrl,
      viewport: value,
      updatedAt: new Date().toISOString(),
    });
    setViewport(value);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const original = notes.find((n) => n.id === editing);
      if (editing && !original) throw new Error("storageConflict");
      if (!selected) return;
      const newNote = createNote(sessionId, selected, comment);
      await store(
        original
          ? {
              ...original,
              comment: newNote.comment,
              status: "draft",
              after: undefined,
            }
          : newNote,
        original?.revision ?? null,
      );
      setSelected(undefined);
      setComment("");
      setEditing(undefined);
    });
  }
  const current = notes.find((n) => n.id === active);
  const size =
    viewport === "desktop"
      ? { width: 1024, height: 640 }
      : { width: 390, height: 720 };
  const scale = Math.min(
    1,
    Math.max(0.1, stageWidth / size.width),
    430 / size.height,
  );
  const configCode = `import { visualEdit } from 'dsh-visual-edit/vite';\n\n// Add to your existing Vite plugins:\nplugins: [react(), visualEdit({\n  allowedOrigins: [${JSON.stringify(location.origin)}]\n})]`;
  const changes = current?.after
    ? compareSnapshots(current.before, current.after)
    : [];
  const ready = bridge.status === "ready";
  return (
    <section className="ve-root" aria-label={t("title")}>
      <style>{styles}</style>
      <header className="ve-header">
        <span className="ve-brand">
          <CursorIcon />
          <strong>Visual Edit</strong>
        </span>
        <span className="ve-kicker">{t("description")}</span>
        <button
          className="ve-icon"
          title={t("setup")}
          aria-label={t("setup")}
          onClick={() => setShowSetup(!showSetup)}
        >
          ?
        </button>
      </header>
      <form className="ve-address" onSubmit={open}>
        <input
          aria-label={t("url")}
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="http://localhost:5173"
          spellCheck={false}
          required
        />
        <button disabled={busy || !loaded} type="submit">
          {t("connect")}
        </button>
      </form>
      {notice && (
        <div
          className={`ve-notice ${notice.error ? "ve-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {t(notice.key)}
          <button aria-label={t("cancel")} onClick={() => setNotice(undefined)}>
            ×
          </button>
        </div>
      )}
      {(showSetup || bridge.status === "disconnected" || !url) && (
        <details
          className="ve-setup"
          open={showSetup || !url || bridge.status === "disconnected"}
        >
          <summary>{t("setup")}</summary>
          <p>{t("setupHint")}</p>
          <a
            href="https://github.com/Han-1413141/dsh-visual-edit#quick-start"
            target="_blank"
            rel="noreferrer"
          >
            {t("openDocs")} ↗
          </a>
          <pre>{configCode}</pre>
        </details>
      )}
      <div className="ve-tools">
        <span
          className={`ve-connection ${ready ? "is-ready" : ""}`}
          role="status"
        >
          {t(
            ready
              ? "ready"
              : bridge.status === "connecting"
                ? "loading"
                : "disconnected",
          )}
        </span>
        <div className="ve-segment">
          <button
            aria-pressed={viewport === "desktop"}
            onClick={() => void run(() => changeViewport("desktop"))}
            disabled={busy}
          >
            {t("desktop")}
          </button>
          <button
            aria-pressed={viewport === "mobile"}
            onClick={() => void run(() => changeViewport("mobile"))}
            disabled={busy}
          >
            {t("mobile")}
          </button>
        </div>
        <button
          className={bridge.picking ? "ve-primary" : ""}
          disabled={!ready || busy}
          onClick={bridge.pick}
        >
          <CursorIcon width="15" height="15" />
          {t("pick")}
        </button>
        <button
          className="ve-icon"
          title={t("reload")}
          aria-label={t("reload")}
          disabled={!url || busy}
          onClick={() => {
            if (frame.current) frame.current.src = url;
          }}
        >
          ↻
        </button>
      </div>
      {bridge.picking && (
        <div className="ve-picking" role="status">
          {t("picking")}
        </div>
      )}
      <div
        className="ve-stage"
        ref={stage}
        style={{ minHeight: url ? undefined : 90 }}
      >
        {url ? (
          <div
            className="ve-frame-space"
            style={{ width: size.width * scale, height: size.height * scale }}
          >
            <iframe
              ref={frame}
              title={t("active")}
              src={url}
              onLoad={bridge.onLoad}
              sandbox="allow-scripts allow-same-origin allow-forms"
              referrerPolicy="no-referrer"
              style={{
                width: size.width,
                height: size.height,
                transform: `scale(${scale})`,
              }}
            />
          </div>
        ) : (
          <div className="ve-stage-placeholder">
            <CursorIcon width="26" height="26" />
            <span>{t("localOnly")}</span>
          </div>
        )}
        {url && (
          <span className="ve-dimensions">
            {size.width} × {size.height}
          </span>
        )}
      </div>
      {selected && (
        <form className="ve-selection" onSubmit={save}>
          <div className="ve-row">
            <strong>
              {t(editing ? "edit" : "selected")}{" "}
              <code>&lt;{selected.locator.tag}&gt;</code>
            </strong>
            <button
              className="ve-icon"
              type="button"
              aria-label={t("closeSelection")}
              onClick={() => {
                setSelected(undefined);
                setEditing(undefined);
              }}
            >
              ×
            </button>
          </div>
          <Source snapshot={selected} t={t} />
          <label>
            {t("comment")}
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("placeholder")}
              maxLength={3000}
              required
              rows={3}
            />
          </label>
          {selected.warning && (
            <small>
              {t(
                selected.warning in en
                  ? (selected.warning as CopyKey)
                  : "noImage",
              )}
            </small>
          )}
          <button className="ve-primary" disabled={busy || !comment.trim()}>
            {t(editing ? "saveEdit" : "save")}
          </button>
        </form>
      )}
      <div className="ve-feedback-header">
        <h2>
          {t("notes")} <span>{notes.length}</span>
        </h2>
        <button
          disabled={!notes.length}
          onClick={() => {
            const blob = new Blob(
              [
                JSON.stringify(
                  {
                    format: "dsh-visual-edit/v1",
                    exportedAt: new Date().toISOString(),
                    notes,
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            );
            const link = document.createElement("a");
            const href = URL.createObjectURL(blob);
            link.href = href;
            link.download = "visual-edit-feedback.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(href), 1000);
          }}
        >
          {t("export")}
        </button>
      </div>
      {!notes.length && <p className="ve-empty">{t("empty")}</p>}
      <div className="ve-list">
        {notes.map((note, index) => (
          <button
            className={`ve-note ${active === note.id ? "is-active" : ""}`}
            aria-pressed={active === note.id}
            key={note.id}
            onClick={() => setActive(note.id)}
          >
            <span className="ve-number">{index + 1}</span>
            <span className="ve-note-content">
              <span>{note.comment}</span>
              <Source snapshot={note.before} t={t} />
            </span>
            <span className={`ve-status ve-status-${note.status}`}>
              {t(STATUS[note.status])}
            </span>
          </button>
        ))}
      </div>
      {current && (
        <article className="ve-review" aria-label={t("reviews")}>
          <div className="ve-actions">
            <button
              className="ve-primary"
              disabled={busy || current.status === "confirmed" || !inputActions}
              onClick={() =>
                void run(async () => {
                  if (!inputActions) throw new Error("inputBusy");
                  const span = inputActions.captureInsertion();
                  if (
                    !inputActions.insertText(
                      `\n\n${feedbackText([current])}\n`,
                      { ...span, end: span.start },
                    )
                  )
                    throw new Error("inputBusy");
                  await store(
                    { ...current, status: "queued" },
                    current.revision,
                  );
                  setNotice({ key: "added", error: false });
                })
              }
            >
              {t("addToChat")}
            </button>
            <button
              disabled={busy || !ready}
              onClick={() =>
                void run(async () => {
                  const result = await bridge.capture(current.before);
                  if (
                    result.pageKey !== current.before.pageKey ||
                    result.viewport.width !== current.before.viewport.width ||
                    result.viewport.height !== current.before.viewport.height
                  )
                    throw new Error("pageOrViewportChanged");
                  await store(
                    { ...current, after: result, status: "review" },
                    current.revision,
                  );
                  setNotice({ key: "captured", error: false });
                })
              }
            >
              {t(busy ? "captureBusy" : "capture")}
            </button>
            <button
              disabled={!ready || busy}
              onClick={() => bridge.highlight(current.before)}
            >
              {t("locate")}
            </button>
          </div>
          <div className="ve-comparison">
            <ImageCard snapshot={current.before} label={t("before")} t={t} />
            {current.after ? (
              <ImageCard snapshot={current.after} label={t("after")} t={t} />
            ) : (
              <div className="ve-after-placeholder">
                <span>→</span>
                <p>{t("captureHint")}</p>
              </div>
            )}
          </div>
          {current.after && (
            <>
              <details className="ve-changes">
                <summary>
                  {t("differences")} · {changes.length}
                </summary>
                {changes.length ? (
                  <dl>
                    {changes.map((c) => (
                      <React.Fragment key={c.field}>
                        <dt>{c.field}</dt>
                        <dd>
                          <del>{c.before}</del>
                          <span>→</span>
                          <ins>{c.after}</ins>
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>
                ) : (
                  <p>{t("noChanges")}</p>
                )}
              </details>
              <button
                className="ve-confirm"
                disabled={busy || current.status === "confirmed"}
                onClick={() =>
                  void run(async () => {
                    await store(
                      { ...current, status: "confirmed" },
                      current.revision,
                    );
                    setNotice({ key: "confirmed", error: false });
                  })
                }
              >
                {current.status === "confirmed" ? "✓ " : ""}
                {t("confirm")}
              </button>
            </>
          )}
          <div className="ve-secondary-actions">
            <button
              disabled={busy}
              onClick={() => {
                setSelected(current.before);
                setComment(current.comment);
                setEditing(current.id);
              }}
            >
              {t(current.status === "confirmed" ? "reopen" : "edit")}
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(feedbackText([current]));
                  setNotice({ key: "copied", error: false });
                })
              }
              disabled={busy}
            >
              {t("copy")}
            </button>
            <button
              className="ve-delete"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("removeConfirm")))
                  void run(async () => {
                    await deleteNote(current);
                    await refresh();
                    broadcast.current?.postMessage("updated");
                  });
              }}
            >
              {t("remove")}
            </button>
          </div>
          <small className="ve-hint">
            {t("sameViewport")} {t("resetBaseline")}
          </small>
        </article>
      )}
      <footer className="ve-footer">{t("privacy")}</footer>
    </section>
  );
}
