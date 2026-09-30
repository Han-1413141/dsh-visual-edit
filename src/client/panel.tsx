import React, {
  useEffect,
  useRef,
  useState,
  useId,
  type FormEvent,
} from "react";
import { version } from "../../package.json";
import {
  compareSnapshots,
  createNote,
  feedbackText,
  previewUrl,
  MAX_NOTES,
  type ReviewNote,
  type Snapshot,
} from "../shared/model";
import {
  deleteNote,
  putNote,
  readBoard,
  saveConfig,
  queueNotes,
  importNotes,
} from "./storage";
import { type Backup } from "../shared/backup";
import { BackupControls } from "./backup-controls";
import { NoteList } from "./note-list";
import { useBridge } from "./bridge";
import { en, type CopyKey, type Translate } from "./locales";
import { Icon, CursorIcon } from "./icons";
import { ComparisonDialog, ImageCard } from "./comparison";
import styles from "./styles.css?raw";
export { CursorIcon } from "./icons";

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
  external?: Pick<
    ReturnType<typeof useBridge>,
    "status" | "picking" | "pick" | "startPick" | "highlight" | "capture"
  > & {
    available: boolean;
    selection?: Snapshot;
    error?: string;
    comment?: string;
    setComment?(comment: string): void;
    clearSelection?(): void;
    autoStatus?: "waiting" | "capturing" | "updated" | "error";
    autoError?: string;
    reviewId?: string;
  };
}
type View = "preview" | "feedback";
const NEXT: Record<ReviewNote["status"], CopyKey> = {
  draft: "nextStepDraft",
  queued: "nextStepQueued",
  review: "nextStepReview",
  confirmed: "nextStepConfirmed",
};
const order = (a: ReviewNote, b: ReviewNote) =>
  a.before.capturedAt.localeCompare(b.before.capturedAt) ||
  a.id.localeCompare(b.id);
function Source({
  snapshot,
  t,
  onCopy,
}: {
  snapshot: Snapshot;
  t: Translate;
  onCopy?: () => void;
}) {
  const source = snapshot.locator.source;
  return (
    <span className="ve-source-row">
      <Icon name="code" width="13" height="13" />
      <code className="ve-source" title={source?.file}>
        {source
          ? `${source.file}:${source.line}:${source.column}`
          : t("noSource")}
      </code>
      {source && onCopy && (
        <button
          className="ve-icon ve-small-icon"
          title={t("copySource")}
          aria-label={t("copySource")}
          onClick={onCopy}
        >
          <Icon name="copy" width="13" height="13" />
        </button>
      )}
    </span>
  );
}
export function VisualEditPanel(props: PanelProps) {
  return <Board key={props.sessionId} {...props} />;
}
function Board({ sessionId, inputActions, t, external }: PanelProps) {
  const uid = useId();
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadEpoch, setLoadEpoch] = useState(0);
  const [draftUrl, setDraftUrl] = useState("http://localhost:5173");
  const [url, setUrl] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [actualSize, setActualSize] = useState(false);
  const [view, setView] = useState<View>(external ? "feedback" : "preview");
  const [selected, setSelected] = useState<Snapshot>();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<ReviewNote>();
  const [active, setActive] = useState<string>();
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [search, setSearch] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const busy = !!busyAction;
  const lock = useRef(false);
  const [notice, setNotice] = useState<{
    key: CopyKey;
    error: boolean;
    count?: number;
  }>();
  const [showSetup, setShowSetup] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [expanded, setExpanded] = useState<ReviewNote>();
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const comparison = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const broadcast = useRef<BroadcastChannel>();
  const [stageWidth, setStageWidth] = useState(500);
  function reportError(value: unknown) {
    const key = value instanceof Error ? value.message : String(value);
    if (alive.current)
      setNotice({ key: key in en ? (key as CopyKey) : "error", error: true });
  }
  const frameBridge = useBridge(
    frame,
    external ? "" : url,
    (s) => {
      setSelected(s);
      setComment("");
      setEditing(undefined);
      setNotice(undefined);
      setView("preview");
    },
    reportError,
  );
  const bridge = external ? { ...frameBridge, ...external } : frameBridge;
  useEffect(() => {
    if (!external?.selection) return;
    setSelected(external.selection);
    setComment(external.comment ?? "");
    setEditing(undefined);
    setNotice(undefined);
    setView("preview");
  }, [external?.selection]);
  useEffect(() => {
    if (external?.reviewId) {
      setActive(external.reviewId);
      setView("feedback");
    }
  }, [external?.reviewId]);
  useEffect(() => {
    if (external?.error) reportError(external.error);
  }, [external?.error]);
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
            /* Ignore invalid saved origins. */
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
  }, [sessionId, loadEpoch]);
  useEffect(() => {
    const target = stage.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) =>
      setStageWidth(entries[0].contentRect.width),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selected) {
      editor.current?.focus();
      setBatchMode(false);
    }
  }, [selected]);
  function changeView(next: View) {
    if (next === "preview") setBatchMode(false);
    setView(next);
    setDeleting(undefined);
    scroll.current?.scrollTo({ top: 0 });
    if (bridge.picking) bridge.pick();
  }
  function cancelEdit() {
    external?.clearSelection?.();
    setSelected(undefined);
    setEditing(undefined);
    setComment("");
  }
  async function refresh() {
    const data = await readBoard(sessionId);
    if (alive.current) setNotes(data.notes);
  }
  async function run(task: () => Promise<void>, action = "working") {
    if (lock.current) return false;
    lock.current = true;
    setBusyAction(action);
    setNotice(undefined);
    try {
      await task();
      return true;
    } catch (error) {
      reportError(error);
      if (error instanceof Error && error.message === "storageConflict")
        await refresh().catch(reportError);
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setBusyAction(undefined);
    }
  }
  async function store(note: ReviewNote, expected: number | null) {
    const saved = await putNote(note, expected);
    if (alive.current) {
      setNotes((items) =>
        [...items.filter((n) => n.id !== saved.id), saved].sort(order),
      );
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
      setShowSetup(false);
      changeView("preview");
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
  function save(event?: FormEvent, continuePicking = false, insert = false) {
    event?.preventDefault();
    void run(async () => {
      if (!selected) return;
      const newNote = createNote(sessionId, selected, comment);
      // Use the revision captured when editing began, even after a broadcast refresh.
      const saved = await store(
        editing
          ? {
              ...editing,
              comment: newNote.comment,
              status: "draft",
              after: undefined,
            }
          : newNote,
        editing?.revision ?? null,
      );
      cancelEdit();
      setFilter("all");
      setSearch("");
      changeView(continuePicking ? "preview" : "feedback");
      if (continuePicking) bridge.startPick();
      setNotice({ key: "saved", error: false });
      if (insert) await insertNotes([saved]);
    }, "save");
  }
  async function copy(text: string, key: CopyKey = "copied") {
    await navigator.clipboard.writeText(text);
    setNotice({ key, error: false });
  }
  function addToChat(items: ReviewNote[]) {
    return run(() => insertNotes(items));
  }
  async function insertNotes(items: ReviewNote[]) {
    if (!inputActions || !items.length) throw new Error("inputBusy");
    const span = inputActions.captureInsertion();
    const latest = (await readBoard(sessionId)).notes;
    if (
      items.some(
        (note) =>
          note.sessionId !== sessionId ||
          note.status === "confirmed" ||
          latest.find((n) => n.id === note.id)?.revision !== note.revision,
      )
    )
      throw new Error("storageConflict");
    if (!alive.current) return;
    if (
      !inputActions.insertText(`\n\n${feedbackText(items)}\n`, {
        ...span,
        end: span.start,
      })
    )
      throw new Error("inputBusy");
    try {
      await queueNotes(items);
      await refresh();
      broadcast.current?.postMessage("updated");
      setNotice({ key: external ? "addedAuto" : "added", error: false });
    } catch {
      await refresh().catch(() => {});
      setNotice({ key: "insertedNotSaved", error: true });
    }
  }
  function restore(backup: Backup) {
    return run(async () => {
      const result = await importNotes(sessionId, backup.notes);
      await refresh();
      broadcast.current?.postMessage("updated");
      if (!alive.current) return;
      setFilter("all");
      setSearch("");
      setActive(result.added[0]?.id);
      setNotice({ key: "imported", error: false, count: result.added.length });
    }, "restore");
  }
  const matching = notes.filter(
    (n) =>
      (filter === "all" ||
        (filter === "done"
          ? n.status === "confirmed"
          : n.status !== "confirmed")) &&
      `${n.comment} ${n.before.locator.source?.file ?? ""} ${n.before.text}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const current = matching.find((n) => n.id === active) ?? matching[0];
  useEffect(() => {
    if (!external || selected || !current?.after) return;
    const request = requestAnimationFrame(() => {
      const parent = scroll.current,
        target = comparison.current;
      if (parent && target)
        parent.scrollTo({
          top:
            parent.scrollTop +
            target.getBoundingClientRect().top -
            parent.getBoundingClientRect().top -
            8,
        });
    });
    return () => cancelAnimationFrame(request);
  }, [external?.reviewId, current?.after?.capturedAt, selected]);
  const confirmedCount = notes.filter((n) => n.status === "confirmed").length;
  const editConflict =
    editing &&
    notes.find((n) => n.id === editing.id)?.revision !== editing.revision;
  const size =
    viewport === "desktop"
      ? { width: 1024, height: 640 }
      : { width: 390, height: 720 };
  const scale = actualSize
    ? 1
    : Math.min(1, Math.max(0.1, stageWidth / size.width), 460 / size.height);
  const configCode = `import { visualEdit } from 'dsh-visual-edit/vite';\n\n// Add to your existing Vite plugins:\nvisualEdit({\n  allowedOrigins: [${JSON.stringify(location.origin)}]\n})`;
  const installCommand = `npm install -D https://github.com/Han-1413141/dsh-visual-edit/releases/download/v${version}/dsh-visual-edit-${version}.tgz`;
  const changes = current?.after
    ? compareSnapshots(current.before, current.after)
    : [];
  const ready = external ? external.available : bridge.status === "ready";
  const newFeedback = () =>
    external ? bridge.startPick() : changeView("preview");
  const handleTabKeys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      changeView(view === "preview" ? "feedback" : "preview");
      (
        e.currentTarget.parentElement?.querySelector(
          `[data-view="${view === "preview" ? "feedback" : "preview"}"]`,
        ) as HTMLElement
      )?.focus();
    }
  };
  return (
    <section className="ve-root" aria-label={t("title")}>
      <style>{styles}</style>
      {!external && (
        <>
          <form className="ve-address" onSubmit={open}>
            <Icon name="globe" />
            <input
              aria-label={t("url")}
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="http://localhost:5173"
              spellCheck={false}
              required
              disabled={!!selected}
            />
            <button
              type="submit"
              className="ve-icon"
              title={t("connect")}
              aria-label={t("connect")}
              disabled={busy || !loaded || !!selected}
            >
              <Icon name="arrow" />
            </button>
            <button
              type="button"
              className="ve-icon"
              title={t("reload")}
              aria-label={t("reload")}
              disabled={!url || busy || !!selected}
              onClick={() => {
                if (frame.current) frame.current.src = url;
              }}
            >
              <Icon name="refresh" />
            </button>
            <button
              type="button"
              className="ve-icon"
              title={t("setup")}
              aria-label={t("setup")}
              aria-expanded={showSetup}
              onClick={() => setShowSetup(!showSetup)}
            >
              <Icon name="help" />
            </button>
          </form>
          <div className="ve-navigation">
            <div className="ve-tabs" role="tablist" aria-label={t("title")}>
              <button
                role="tab"
                data-view="preview"
                disabled={busyAction === "capture"}
                id={`${uid}-preview-tab`}
                aria-selected={view === "preview"}
                tabIndex={view === "preview" ? 0 : -1}
                onKeyDown={handleTabKeys}
                onClick={() => changeView("preview")}
              >
                <Icon name="globe" />
                {t("previewTab")}
              </button>
              <button
                role="tab"
                data-view="feedback"
                disabled={busyAction === "capture"}
                id={`${uid}-feedback-tab`}
                aria-selected={view === "feedback"}
                tabIndex={view === "feedback" ? 0 : -1}
                onKeyDown={handleTabKeys}
                onClick={() => changeView("feedback")}
              >
                <Icon name="notes" />
                {t("feedbackTab")}
                <span className="ve-count">{notes.length}</span>
              </button>
            </div>
            <span
              className={`ve-connection ${ready ? "is-ready" : ""}`}
              title={t(
                ready
                  ? "ready"
                  : bridge.status === "connecting"
                    ? "loading"
                    : "disconnected",
              )}
            >
              <i />
              {t(
                ready
                  ? "ready"
                  : bridge.status === "connecting"
                    ? "loading"
                    : "disconnected",
              )}
            </span>
          </div>
        </>
      )}
      {notice && (
        <div
          className={`ve-notice ${notice.error ? "ve-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          <span>
            {t(notice.key).replace("{count}", String(notice.count ?? ""))}
          </span>
          <button
            className="ve-icon"
            aria-label={t("cancel")}
            onClick={() => setNotice(undefined)}
          >
            <Icon name="close" width="14" height="14" />
          </button>
        </div>
      )}
      {!loaded && notice?.error && (
        <button className="ve-retry" onClick={() => setLoadEpoch((v) => v + 1)}>
          {t("storageRetry")}
        </button>
      )}
      <div className="ve-scroll" ref={scroll}>
        {!external && (showSetup || bridge.status === "disconnected") && (
          <section className="ve-setup" aria-label={t("setup")}>
            <header>
              <h3>{t("setup")}</h3>
              <a
                href="https://github.com/Han-1413141/dsh-visual-edit#quick-start"
                target="_blank"
                rel="noreferrer"
              >
                {t("openDocs")} ↗
              </a>
            </header>
            <p>{t("setupHint")}</p>
            <h4>{t("setupInstall")}</h4>
            <div className="ve-code-block">
              <pre>{installCommand}</pre>
              <button
                className="ve-icon"
                aria-label={t("copyCommand")}
                title={t("copyCommand")}
                onClick={() => void run(() => copy(installCommand))}
              >
                <Icon name="copy" />
              </button>
            </div>
            <h4>{t("setupConfigure")}</h4>
            <div className="ve-code-block">
              <pre>{configCode}</pre>
              <button
                className="ve-icon"
                aria-label={t("copyConfig")}
                title={t("copyConfig")}
                onClick={() => void run(() => copy(configCode))}
              >
                <Icon name="copy" />
              </button>
            </div>
            <p>{t("setupRestart")}</p>
          </section>
        )}
        {!external && (
          <div
            className={`ve-preview ${view !== "preview" ? "ve-stashed" : ""}`}
            role="tabpanel"
            aria-labelledby={`${uid}-preview-tab`}
            aria-hidden={view !== "preview"}
          >
            <div className="ve-preview-tools">
              <button
                className={bridge.picking ? "ve-primary" : "ve-tool-action"}
                aria-pressed={bridge.picking}
                disabled={!ready || busy || !!selected}
                onClick={bridge.pick}
              >
                <CursorIcon />
                {t("pick")}
              </button>
              <div className="ve-preview-options">
                <div className="ve-segment">
                  <button
                    aria-label={t("desktop")}
                    title={t("desktop")}
                    aria-pressed={viewport === "desktop"}
                    disabled={busy || !!selected}
                    onClick={() => void run(() => changeViewport("desktop"))}
                  >
                    <Icon name="desktop" />
                  </button>
                  <button
                    aria-label={t("mobile")}
                    title={t("mobile")}
                    aria-pressed={viewport === "mobile"}
                    disabled={busy || !!selected}
                    onClick={() => void run(() => changeViewport("mobile"))}
                  >
                    <Icon name="mobile" />
                  </button>
                </div>
                <button
                  className="ve-icon"
                  aria-label={t(actualSize ? "fit" : "actualSize")}
                  title={t(actualSize ? "fit" : "actualSize")}
                  aria-pressed={actualSize}
                  disabled={busy}
                  onClick={() => setActualSize(!actualSize)}
                >
                  <Icon name="expand" />
                </button>
              </div>
            </div>
            {bridge.picking && (
              <div className="ve-picking" role="status">
                <CursorIcon width="14" height="14" />
                {t("picking")}
                <button onClick={bridge.pick}>{t("cancel")}</button>
              </div>
            )}
            <div
              className={`ve-stage ${actualSize ? "ve-stage-actual" : ""} ${!url ? "ve-stage-empty" : ""}`}
              ref={stage}
              aria-busy={busyAction === "capture"}
            >
              {url ? (
                <div
                  className="ve-frame-space"
                  style={{
                    width: size.width * scale,
                    height: size.height * scale,
                  }}
                >
                  <iframe
                    ref={frame}
                    title={t("active")}
                    src={url}
                    onLoad={bridge.onLoad}
                    tabIndex={view === "preview" && !busy ? 0 : -1}
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
                <div className="ve-empty">
                  <span className="ve-empty-icon">
                    <Icon name="cursor" width="26" height="26" />
                  </span>
                  <h3>{t("pickFirst")}</h3>
                  <p>{t("pickFirstHint")}</p>
                  <button onClick={() => setShowSetup(true)}>
                    {t("openDocs")}
                    <Icon name="arrow" width="14" height="14" />
                  </button>
                </div>
              )}
            </div>
            {url && (
              <div className="ve-preview-caption">
                <code>
                  {size.width} × {size.height}
                </code>
                <span>{Math.round(scale * 100)}%</span>
                <span>{t("localOnly")}</span>
              </div>
            )}
            {!selected && url && (
              <div
                className="ve-preview-hint"
                role={busyAction === "capture" ? "status" : undefined}
              >
                <Icon
                  name={busyAction === "capture" ? "refresh" : "cursor"}
                  className={busyAction === "capture" ? "ve-spin" : undefined}
                />
                <span>
                  {t(busyAction === "capture" ? "captureBusy" : "empty")}
                </span>
              </div>
            )}
          </div>
        )}
        {selected && (
          <form
            className="ve-selection"
            onSubmit={(e) => save(e, false, !!external && !!inputActions)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (!busy && !editConflict)
                  save(undefined, false, !!external && !!inputActions);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
              }
            }}
          >
            <header>
              <span className="ve-element-tag">
                &lt;{selected.locator.tag}&gt;
              </span>
              <strong>
                {t(
                  editing
                    ? "edit"
                    : selected.annotation?.kind === "arrow"
                      ? "arrowMode"
                      : selected.annotation?.kind === "region"
                        ? "regionMode"
                        : "selected",
                )}
              </strong>
              <button
                className="ve-icon"
                type="button"
                aria-label={t("closeSelection")}
                onClick={cancelEdit}
              >
                <Icon name="close" />
              </button>
            </header>
            <Source snapshot={selected} t={t} />
            <label htmlFor={`${uid}-comment`}>{t("comment")}</label>
            <textarea
              ref={editor}
              id={`${uid}-comment`}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                external?.setComment?.(e.target.value);
              }}
              placeholder={t("placeholder")}
              maxLength={3000}
              required
              rows={3}
            />
            {selected.warning && (
              <p className="ve-hint">
                {t(
                  selected.warning in en
                    ? (selected.warning as CopyKey)
                    : "noImage",
                )}
              </p>
            )}
            {editConflict && (
              <div className="ve-edit-conflict" role="alert">
                <p>{t("editConflict")}</p>
                <button
                  type="button"
                  onClick={() => {
                    const latest = notes.find((n) => n.id === editing?.id);
                    if (latest) {
                      setEditing(latest);
                      setSelected(latest.before);
                      setComment(latest.comment);
                    } else cancelEdit();
                  }}
                >
                  {t("reloadNote")}
                </button>
              </div>
            )}
            <footer>
              <small>{t("saveShortcut")}</small>
              <button type="button" onClick={cancelEdit}>
                {t("cancel")}
              </button>
              {!editing && (
                <button
                  type="button"
                  className="ve-outline"
                  disabled={
                    busy ||
                    !ready ||
                    !comment.trim() ||
                    notes.length >= MAX_NOTES - 1
                  }
                  onClick={() => save(undefined, true)}
                >
                  {t("saveContinue")}
                </button>
              )}
              {external && inputActions && (
                <button
                  type="button"
                  className="ve-outline"
                  disabled={busy || !comment.trim() || !!editConflict}
                  onClick={() => save()}
                >
                  {t("save")}
                </button>
              )}
              <button
                className="ve-primary"
                disabled={busy || !comment.trim() || !!editConflict}
              >
                {t(
                  busyAction === "save"
                    ? "saving"
                    : external && inputActions
                      ? "submitCompare"
                      : editing
                        ? "saveEdit"
                        : "save",
                )}
              </button>
            </footer>
          </form>
        )}
        {(external ? !selected : view === "feedback") && (
          <div
            className="ve-feedback"
            role="tabpanel"
            aria-labelledby={external ? undefined : `${uid}-feedback-tab`}
          >
            {external?.autoStatus && (
              <p className="ve-auto-status" role="status">
                <Icon
                  name={
                    external.autoStatus === "capturing"
                      ? "refresh"
                      : external.autoStatus === "updated"
                        ? "check"
                        : "globe"
                  }
                  className={
                    external.autoStatus === "capturing" ? "ve-spin" : undefined
                  }
                />
                <span>
                  {t(
                    external.autoStatus === "waiting"
                      ? "autoWaiting"
                      : external.autoStatus === "capturing"
                        ? "autoCapturing"
                        : external.autoStatus === "updated"
                          ? "autoUpdated"
                          : "autoError",
                  )}
                  {external.autoStatus === "error" &&
                  external.autoError &&
                  external.autoError in en
                    ? ` ${t(external.autoError as CopyKey)}`
                    : ""}
                </span>
              </p>
            )}
            <div className="ve-feedback-toolbar">
              <h3>
                {t("notes")}
                <span>
                  {confirmedCount}/{notes.length} {t("completed")}
                </span>
              </h3>
              <button
                className="ve-icon"
                title={t("newFeedback")}
                aria-label={t("newFeedback")}
                onClick={newFeedback}
              >
                <Icon name="cursor" />
              </button>
              <BackupControls
                notes={notes}
                t={t}
                disabled={busy || !loaded || !!selected}
                error={notice?.error ? notice.key : undefined}
                onError={reportError}
                onRestore={restore}
              />
            </div>
            {!!notes.length && (
              <div className="ve-filters">
                <div className="ve-segment">
                  {(["all", "pending", "done"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => {
                        setFilter(value);
                        setDeleting(undefined);
                      }}
                    >
                      {t(value)}
                    </button>
                  ))}
                </div>
                <label className="ve-search">
                  <Icon name="search" width="14" height="14" />
                  <input
                    type="search"
                    aria-label={t("searchNotes")}
                    placeholder={t("searchNotes")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
            )}
            {!notes.length ? (
              <div className="ve-empty">
                <span className="ve-empty-icon">
                  <Icon name="notes" width="26" height="26" />
                </span>
                <h3>{t("startReview")}</h3>
                <p>{t(external ? "nativeStartHint" : "startReviewHint")}</p>
                <button onClick={newFeedback}>
                  {t("newFeedback")}
                  <Icon name="arrow" width="14" height="14" />
                </button>
              </div>
            ) : (
              <NoteList
                batch={batchMode}
                setBatch={setBatchMode}
                notes={notes}
                matching={matching}
                currentId={current?.id}
                t={t}
                disabled={busy || !!selected}
                canInsert={!!inputActions}
                source={(note) => <Source snapshot={note.before} t={t} />}
                onActivate={(id) => {
                  setActive(id);
                  setDeleting(undefined);
                }}
                onAdd={addToChat}
                onCopy={(items) => run(() => copy(feedbackText(items)))}
              />
            )}
            {current && (
              <article className="ve-review" aria-label={t("reviews")}>
                <header className="ve-review-heading">
                  <div>
                    <h3>{t("reviewResult")}</h3>
                    <Source
                      snapshot={current.before}
                      t={t}
                      onCopy={() =>
                        void run(() =>
                          copy(
                            `${current.before.locator.source!.file}:${current.before.locator.source!.line}:${current.before.locator.source!.column}`,
                            "sourceCopied",
                          ),
                        )
                      }
                    />
                  </div>
                  <button
                    className="ve-icon"
                    title={t("locate")}
                    aria-label={t("locate")}
                    disabled={!ready || busy}
                    onClick={() => {
                      changeView("preview");
                      requestAnimationFrame(() =>
                        bridge.highlight(current.before),
                      );
                    }}
                  >
                    <Icon name="locate" />
                  </button>
                </header>
                <p className="ve-next-step">
                  {t(
                    external && current.status === "queued"
                      ? "autoWaiting"
                      : NEXT[current.status],
                  )}
                </p>
                <div className="ve-actions" hidden={batchMode}>
                  <button
                    className={
                      current.status === "draft" ? "ve-primary" : "ve-outline"
                    }
                    disabled={
                      busy ||
                      current.status === "confirmed" ||
                      !inputActions ||
                      !!selected
                    }
                    onClick={() => void addToChat([current])}
                  >
                    <Icon name="arrow" />
                    {t("addToChat")}
                  </button>
                  <button
                    className={
                      current.status === "queued" ? "ve-primary" : "ve-outline"
                    }
                    disabled={busy || !ready || !!selected}
                    onClick={() =>
                      void run(async () => {
                        // Chromium suspends animation frames inside a hidden iframe. Show
                        // the live preview for capture, then return to the same review.
                        changeView("preview");
                        try {
                          await new Promise<void>((resolve) =>
                            requestAnimationFrame(() => resolve()),
                          );
                          const result = await bridge.capture(current.before);
                          if (
                            result.pageKey !== current.before.pageKey ||
                            (!external &&
                              (result.viewport.width !==
                                current.before.viewport.width ||
                                result.viewport.height !==
                                  current.before.viewport.height))
                          )
                            throw new Error("pageOrViewportChanged");
                          await store(
                            { ...current, after: result, status: "review" },
                            current.revision,
                          );
                          setNotice({ key: "captured", error: false });
                        } finally {
                          if (alive.current) changeView("feedback");
                        }
                      }, "capture")
                    }
                  >
                    <Icon
                      name="refresh"
                      className={
                        busyAction === "capture" ? "ve-spin" : undefined
                      }
                    />
                    {t(busyAction === "capture" ? "captureBusy" : "capture")}
                  </button>
                </div>
                <div className="ve-comparison" ref={comparison}>
                  <ImageCard
                    snapshot={current.before}
                    label={t("before")}
                    t={t}
                    onExpand={() => setExpanded(current)}
                  />
                  {current.after ? (
                    <ImageCard
                      snapshot={current.after}
                      label={t("after")}
                      t={t}
                      onExpand={() => setExpanded(current)}
                    />
                  ) : (
                    <div className="ve-after-placeholder">
                      <Icon name="refresh" width="22" height="22" />
                      <p>
                        {t(
                          external && current.status === "queued"
                            ? "autoWaiting"
                            : "captureHint",
                        )}
                      </p>
                    </div>
                  )}
                </div>
                {current.after && (
                  <>
                    <details className="ve-changes">
                      <summary>
                        {t("differences")}
                        <span>{changes.length}</span>
                      </summary>
                      {changes.length ? (
                        <dl>
                          {changes.map((c) => (
                            <React.Fragment key={c.field}>
                              <dt>{c.field}</dt>
                              <dd>
                                <del>{c.before}</del>
                                <Icon name="arrow" width="12" height="12" />
                                <ins>{c.after}</ins>
                              </dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      ) : (
                        <p>{t("noChanges")}</p>
                      )}
                    </details>
                    {current.status === "confirmed" ? (
                      <div className="ve-confirmed">
                        <Icon name="check" />
                        {t("confirmed")}
                      </div>
                    ) : (
                      <button
                        className="ve-primary ve-confirm"
                        disabled={busy || !!selected}
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
                        <Icon name="check" />
                        {t("confirm")}
                      </button>
                    )}
                  </>
                )}
                <div className="ve-secondary-actions">
                  <button
                    disabled={busy || !!selected}
                    onClick={() => {
                      setSelected(current.before);
                      setComment(current.comment);
                      setEditing(current);
                      setDeleting(undefined);
                    }}
                  >
                    <Icon name="edit" width="14" height="14" />
                    {t(current.status === "confirmed" ? "reopen" : "edit")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() => copy(feedbackText([current])))
                    }
                  >
                    <Icon name="copy" width="14" height="14" />
                    {t("copy")}
                  </button>
                  <button
                    className="ve-icon ve-delete"
                    aria-label={t("remove")}
                    title={t("remove")}
                    disabled={busy || !!selected}
                    aria-expanded={deleting === current.id}
                    onClick={() =>
                      setDeleting(
                        deleting === current.id ? undefined : current.id,
                      )
                    }
                  >
                    <Icon name="trash" width="14" height="14" />
                  </button>
                </div>
                {deleting === current.id && (
                  <div
                    className="ve-delete-confirm"
                    role="group"
                    aria-label={t("confirmDelete")}
                  >
                    <strong>{t("confirmDelete")}</strong>
                    <p>{t("deleteDetail")}</p>
                    <div>
                      <button onClick={() => setDeleting(undefined)}>
                        {t("cancel")}
                      </button>
                      <button
                        className="ve-danger"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await deleteNote(current);
                            await refresh();
                            setDeleting(undefined);
                            broadcast.current?.postMessage("updated");
                          })
                        }
                      >
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                )}
                <small className="ve-hint">
                  {t(external ? "nativeComparisonHint" : "sameViewport")}
                </small>
              </article>
            )}
          </div>
        )}
      </div>
      <footer className="ve-footer" title={t("privacy")}>
        <Icon name="shield" width="13" height="13" />
        <span>{t("localData")}</span>
        <span className="ve-footer-count">
          {notes.length - confirmedCount} {t("remaining")}
        </span>
      </footer>
      {expanded && (
        <ComparisonDialog
          note={expanded}
          t={t}
          onClose={() => setExpanded(undefined)}
        />
      )}
    </section>
  );
}
