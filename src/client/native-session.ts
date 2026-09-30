import inspector from "virtual:visual-edit-inspector";
import {
  PROTOCOL,
  snapshotUrl,
  validSnapshot,
  type Snapshot,
  type SelectionMode,
} from "../shared/model";
import { putNote, readBoard } from "./storage";

export interface NativeState {
  enabled: boolean;
  available: boolean;
  status: "idle" | "connecting" | "ready" | "disconnected";
  picking: boolean;
  selection?: Snapshot;
  error?: string;
  mode: SelectionMode;
  comment: string;
  autoStatus?: "waiting" | "capturing" | "updated" | "error";
  autoError?: string;
  reviewId?: string;
}
export interface NativeTransport {
  url: string;
  connect(): Promise<void>;
  send(message: Record<string, unknown>): Promise<void>;
  dispose(): void;
}
export interface Webview extends HTMLElement {
  getURL(): string;
  executeJavaScript(code: string): Promise<any>;
}
/** One document/tab owns the channel, transport, pending captures and mode. */
export class NativeSession {
  readonly channel = crypto.randomUUID();
  readonly key = `__dsh_ve_${crypto.randomUUID().replaceAll("-", "")}`;
  private state: NativeState = {
    enabled: false,
    available: false,
    status: "idle",
    picking: false,
    mode: "element",
    comment: "",
  };
  private listeners = new Set<() => void>();
  private transport?: NativeTransport;
  private connecting?: Promise<void>;
  private generation = 0;
  private disposed = false;
  private visible = true;
  private broadcast?: BroadcastChannel;
  private watchTimer?: ReturnType<typeof setTimeout>;
  private autoIds = new Set<string>();
  private autoRunning = false;
  private captures: Promise<unknown> = Promise.resolve();
  constructor(private sessionId?: string) {
    if (sessionId) {
      this.broadcast = new BroadcastChannel(`dsh-visual-edit:${sessionId}`);
      this.broadcast.onmessage = () => this.scheduleWatch();
    }
  }
  private scheduleWatch = () => {
    clearTimeout(this.watchTimer);
    if (this.disposed || !this.visible || !this.transport || !this.sessionId)
      return;
    this.watchTimer = setTimeout(() => {
      void this.syncWatch().catch(this.autoFailure);
    }, 400);
  };
  private autoFailure = (error: unknown) => {
    if (!this.disposed && this.transport)
      this.update({
        autoStatus: "error",
        autoError: error instanceof Error ? error.message : "error",
      });
  };
  private async syncWatch() {
    const candidates = (await readBoard(this.sessionId!)).notes.filter(
      (n) => n.status === "queued" || n.status === "review",
    );
    if (this.disposed || !this.visible || !this.transport) return;
    if (!candidates.length) {
      if (this.state.status === "ready")
        await this.send({ type: "watch", targets: [] });
      this.update({ autoStatus: undefined, autoError: undefined });
      return;
    }
    await this.ready();
    const targets = candidates.filter(
      (n) => snapshotUrl(n.before.url) === snapshotUrl(this.transport!.url),
    );
    if (this.disposed || !this.visible) return;
    this.update({
      autoStatus: targets.length
        ? targets.some((n) => n.after)
          ? "updated"
          : "waiting"
        : undefined,
      autoError: undefined,
    });
    await this.send({
      type: "watch",
      targets: targets.map((n) => ({
        id: n.id,
        snapshot: n.after ?? n.before,
      })),
    });
  }
  private async comparePending() {
    if (
      this.autoRunning ||
      !this.visible ||
      !this.transport ||
      this.disposed ||
      !this.sessionId
    )
      return;
    this.autoRunning = true;
    try {
      while (
        this.autoIds.size &&
        this.visible &&
        this.transport &&
        !this.disposed
      ) {
        const ids = new Set(this.autoIds);
        this.autoIds.clear();
        const notes = (await readBoard(this.sessionId)).notes.filter(
          (n) =>
            ids.has(n.id) &&
            (n.status === "queued" || n.status === "review") &&
            snapshotUrl(n.before.url) === snapshotUrl(this.transport!.url),
        );
        for (const note of notes) {
          if (this.disposed || !this.visible) break;
          // A selection is short lived; retry when it is consumed instead of competing for the renderer.
          if (this.state.picking || this.state.selection) {
            this.autoIds.add(note.id);
            continue;
          }
          this.update({ autoStatus: "capturing", autoError: undefined });
          const after = await this.capture(note.before);
          const previous = note.after ?? note.before;
          if (after.pageKey !== note.before.pageKey)
            throw new Error("pageChanged");
          if (
            previous.visualKey === after.visualKey &&
            previous.image === after.image
          )
            continue;
          // Older baselines have no fingerprint. Identical rendered content still stays in waiting state.
          if (
            !previous.visualKey &&
            previous.image === after.image &&
            previous.text === after.text &&
            JSON.stringify(previous.styles) === JSON.stringify(after.styles)
          )
            continue;
          try {
            await putNote({ ...note, after, status: "review" }, note.revision);
          } catch (error) {
            if (error instanceof Error && error.message === "storageConflict")
              continue;
            throw error;
          }
          this.broadcast?.postMessage("updated");
          this.update({
            autoStatus: "updated",
            reviewId: note.id,
            enabled: true,
          });
        }
        if (this.state.picking || this.state.selection) break;
      }
      this.scheduleWatch();
    } catch (error) {
      this.autoFailure(error);
    } finally {
      this.autoRunning = false;
    }
  }
  clearSelection = () => {
    this.update({ selection: undefined, comment: "" });
    void this.comparePending();
  };
  setComment = (comment: string) => this.update({ comment });
  setMode = (mode: SelectionMode) => {
    this.update({ mode });
    this.startPick();
  };
  setVisible = (visible: boolean) => {
    this.visible = visible;
    if (!visible) this.pause();
    else {
      this.scheduleWatch();
      void this.comparePending();
    }
  };
  shouldPoll = () =>
    this.visible && (this.state.enabled || !!this.state.autoStatus);
  private pending = new Map<
    string,
    {
      resolve: (s: Snapshot) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  update(value: Partial<NativeState>) {
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }
  attach(transport: NativeTransport) {
    this.detach();
    this.transport = transport;
    this.update({ available: true, status: "idle", error: undefined });
    this.scheduleWatch();
    return () => {
      if (this.transport === transport) this.detach();
    };
  }
  invalidate = () => {
    this.generation++;
    this.connecting = undefined;
    this.update({ status: "disconnected", picking: false });
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("pageChanged"));
    }
    this.pending.clear();
    this.scheduleWatch();
  };
  private detach() {
    this.invalidate();
    this.transport?.dispose();
    this.transport = undefined;
    this.update({ available: false });
  }
  dispose = () => {
    this.disposed = true;
    clearTimeout(this.watchTimer);
    this.broadcast?.close();
    this.detach();
    this.listeners.clear();
  };
  receive = (value: any) => {
    if (
      !value ||
      value.protocol !== PROTOCOL ||
      value.channel !== this.channel ||
      !this.transport
    )
      return;
    if (value.type === "ready") {
      this.update({ status: "ready", error: undefined });
      return;
    }
    if (value.type === "page-changed" && Array.isArray(value.ids)) {
      for (const id of value.ids.slice(0, 50))
        if (typeof id === "string" && id.length <= 200) this.autoIds.add(id);
      void this.comparePending();
      return;
    }
    if (value.type === "pick-ended") {
      this.update({ picking: false });
      return;
    }
    if (value.type === "selected" || value.type === "captured") {
      if (
        !validSnapshot(value.snapshot) ||
        snapshotUrl(value.snapshot.url) !== snapshotUrl(this.transport.url)
      ) {
        const pending = this.pending.get(value.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(value.requestId);
          pending.reject(new Error("invalidSnapshot"));
        }
        this.update({ error: "invalidSnapshot", picking: false });
        return;
      }
      if (value.type === "selected") {
        if (this.state.enabled)
          this.update({
            selection: value.snapshot,
            picking: false,
            comment: "",
          });
        return;
      }
      const pending = this.pending.get(value.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(value.requestId);
        pending.resolve(value.snapshot);
      }
    }
    if (value.type === "error") {
      const key =
        typeof value.message === "string" && value.message.length < 250
          ? value.message
          : "error";
      const pending = this.pending.get(value.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(value.requestId);
        pending.reject(new Error(key));
      } else this.update({ error: key, picking: false });
    }
  };
  private async ready() {
    if (!this.transport) throw new Error("nativeUnavailable");
    if (this.state.status === "ready") return;
    if (this.connecting) return this.connecting;
    const generation = this.generation;
    const transport = this.transport;
    this.update({ status: "connecting", error: undefined });
    const task = (async () => {
      await transport.connect();
      if (generation !== this.generation || transport !== this.transport)
        throw new Error("pageChanged");
      const until = Date.now() + 8000;
      while (this.state.status !== "ready") {
        if (generation !== this.generation || transport !== this.transport)
          throw new Error("pageChanged");
        if (Date.now() > until) throw new Error("nativeConnectionFailed");
        await this.send({ type: "hello" });
        if (this.getSnapshot().status !== "ready")
          await new Promise((resolve) => setTimeout(resolve, 150));
      }
    })();
    this.connecting = task;
    try {
      await task;
    } finally {
      if (this.connecting === task) this.connecting = undefined;
    }
  }
  private send(message: Record<string, unknown>) {
    if (!this.transport) return Promise.reject(new Error("nativeUnavailable"));
    return this.transport.send({
      ...message,
      protocol: PROTOCOL,
      channel: this.channel,
    });
  }
  startPick = () => {
    this.update({ enabled: true });
    void (async () => {
      await this.ready();
      if (!this.state.enabled) return;
      await this.send({ type: "pick", enabled: true, mode: this.state.mode });
      this.update({ picking: true, error: undefined });
    })().catch(this.fail);
  };
  pick = () => {
    if (!this.state.picking) this.startPick();
    else {
      this.update({ picking: false });
      void this.send({ type: "pick", enabled: false }).catch(this.fail);
    }
  };
  toggle = () => {
    if (!this.state.enabled) {
      if (this.state.selection) this.update({ enabled: true });
      else this.startPick();
    } else {
      this.update({ enabled: false, picking: false });
      void this.send({ type: "pick", enabled: false }).catch(() => {});
    }
  };
  pause = () => {
    if (this.state.picking) {
      this.update({ picking: false });
      void this.send({ type: "pick", enabled: false }).catch(() => {});
    }
    void this.comparePending();
  };
  fail = (error: unknown) =>
    this.update({
      status: "disconnected",
      error: error instanceof Error ? error.message : "error",
      picking: false,
    });
  highlight = (snapshot: Snapshot) => {
    void this.ready()
      .then(() => this.send({ type: "highlight", snapshot }))
      .catch(this.fail);
  };
  capture = (snapshot: Snapshot): Promise<Snapshot> => {
    const next = this.captures
      .catch(() => {})
      .then(() => this.captureNow(snapshot));
    this.captures = next;
    return next;
  };
  private captureNow = async (snapshot: Snapshot): Promise<Snapshot> => {
    await this.ready();
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("timeout"));
      }, 15000);
      this.pending.set(requestId, { resolve, reject, timer });
      void this.send({ type: "capture", snapshot, requestId }).catch(
        (error) => {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(error);
        },
      );
    });
  };
}

export function bootSource(
  session: NativeSession,
  kind: "frame" | "webview",
  pageUrl: string,
): string {
  const boot = {
    kind,
    channel: session.channel,
    key: session.key,
    pageUrl,
    parentOrigin: location.origin,
  };
  return `globalThis.__DSH_VE_BOOT__=${JSON.stringify(boot)};\n${inspector}`;
}

export function htmlTransport(
  frame: HTMLIFrameElement,
  url: string,
  session: NativeSession,
): NativeTransport {
  const receive = (event: MessageEvent) => {
    if (event.source === frame.contentWindow && event.origin === "null")
      session.receive(event.data);
  };
  window.addEventListener("message", receive);
  const reload = () => session.invalidate();
  frame.addEventListener("load", reload);
  return {
    url,
    connect: async () => {},
    // An opaque sandbox has no target origin; source-window and channel checks remain exact.
    send: async (message) => {
      frame.contentWindow?.postMessage(message, "*");
    },
    dispose: () => {
      window.removeEventListener("message", receive);
      frame.removeEventListener("load", reload);
    },
  };
}

export function webviewTransport(
  view: Webview,
  session: NativeSession,
): NativeTransport {
  let polling: ReturnType<typeof setInterval> | undefined;
  let reading = false;
  let disposed = false;
  let connected = false;
  let generation = 0;
  const key = JSON.stringify(session.key);
  const changed = (event: Event) => {
    if ((event as Event & { isMainFrame?: boolean }).isMainFrame === false)
      return;
    connected = false;
    generation++;
    session.invalidate();
  };
  view.addEventListener("did-start-navigation", changed);
  const loaded = () => session.invalidate();
  view.addEventListener("did-finish-load", loaded);
  const transport: NativeTransport = {
    url: "",
    async connect() {
      const url = view.getURL();
      const parsed = new URL(url);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error("nativeUnavailable");
      transport.url = url;
      const current = generation;
      const ok = await view.executeJavaScript(
        `(()=>{if(location.href!==${JSON.stringify(url)})return false;${bootSource(session, "webview", url)};return true;})()`,
      );
      if (!ok || disposed || generation !== current || view.getURL() !== url)
        throw new Error("pageChanged");
      connected = true;
      if (!polling)
        polling = setInterval(() => {
          if (reading || disposed || !connected || !session.shouldPoll())
            return;
          reading = true;
          const before = generation;
          void view
            .executeJavaScript(`globalThis[${key}]?.take() ?? []`)
            .then((events) => {
              if (!disposed && before === generation && Array.isArray(events))
                events.slice(0, 12).forEach(session.receive);
            })
            .catch(() => {
              if (!disposed) {
                connected = false;
                session.invalidate();
              }
            })
            .finally(() => {
              reading = false;
            });
        }, 180);
    },
    async send(message) {
      if (!connected || disposed) throw new Error("pageChanged");
      const current = generation;
      const events = await view.executeJavaScript(
        `(async()=>{const api=globalThis[${key}];if(!api)throw Error('pageChanged');await api.command(${JSON.stringify(message)});return api.take();})()`,
      );
      if (current !== generation || disposed) throw new Error("pageChanged");
      if (Array.isArray(events)) events.slice(0, 12).forEach(session.receive);
    },
    dispose() {
      disposed = true;
      if (polling) clearInterval(polling);
      view.removeEventListener("did-start-navigation", changed);
      view.removeEventListener("did-finish-load", loaded);
      void view
        .executeJavaScript(`globalThis[${key}]?.dispose()`)
        .catch(() => {});
    },
  };
  return transport;
}
