import React, {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { VisualEditPanel, type InputActions } from "./panel";
import { Icon, CursorIcon } from "./icons";
import { type Translate } from "./locales";
import {
  NativeSession,
  bootSource,
  htmlTransport,
  webviewTransport,
  type Webview,
} from "./native-session";
import { prepareHtml } from "./native-html";
import styles from "./native.css?raw";

const BROWSER = "@deepseek-ai/dsh-client-ui-sidebar-browser";
const HTML = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/html";
interface TabProps {
  sessionId: string;
  inputActions?: InputActions;
  useTabInfo(): { tab: { id: string; signal: AbortSignal; visible: boolean } };
}
interface HtmlProps extends TabProps {
  content: { kind: string; data?: Uint8Array<ArrayBuffer> };
  resourceAddress: string;
  useInteractivePreview(selector: (value: boolean) => boolean): boolean;
  setResources(addresses: string[]): void;
}
interface Entry {
  component: ComponentType<any>;
  options: { key?: string; priority?: number };
  store?: unknown;
  locale?: string;
  inject?: unknown;
}

/** A tab owns its controller even when the HTML body and toolbar mount separately. */
export function createNativeIntegration(t: Translate) {
  const sessions = new Map<string, NativeSession>();
  const aborts = new Set<() => void>();
  function useSession(props: TabProps) {
    const { tab } = props.useTabInfo();
    const key = JSON.stringify([props.sessionId, tab.id]);
    let session = sessions.get(key);
    if (!session) {
      session = new NativeSession(props.sessionId);
      sessions.set(key, session);
      const close = () => {
        session!.dispose();
        sessions.delete(key);
        off();
      };
      const off = () => {
        tab.signal.removeEventListener("abort", close);
        aborts.delete(off);
      };
      tab.signal.addEventListener("abort", close, { once: true });
      aborts.add(off);
    }
    return session;
  }
  function Toggle({ session }: { session: NativeSession }) {
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
    return (
      <>
        <style>{styles}</style>
        <button
          type="button"
          className="ve-native-toggle"
          title={t(
            state.available
              ? state.enabled
                ? "nativeExit"
                : "nativeEnter"
              : "nativeUnavailable",
          )}
          aria-label={t(state.enabled ? "nativeExit" : "nativeEnter")}
          aria-pressed={state.enabled}
          disabled={!state.available}
          onClick={session.toggle}
        >
          <CursorIcon width="15" height="15" />
          <span>{t("nativeEnter")}</span>
        </button>
      </>
    );
  }
  function Overlay({
    session,
    props,
  }: {
    session: NativeSession;
    props: TabProps;
  }) {
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
    const mounted = useRef(false);
    if (state.enabled) mounted.current = true;
    const { tab } = props.useTabInfo();
    useEffect(() => {
      session.setVisible(tab.visible);
    }, [tab.visible, session]);
    return (
      <>
        {state.enabled && state.picking && (
          <div
            className="ve-native-picking"
            role="toolbar"
            aria-label={t("selectionMode")}
          >
            {(["element", "arrow", "region"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={state.mode === mode}
                title={t(
                  mode === "element"
                    ? "picking"
                    : mode === "arrow"
                      ? "arrowHint"
                      : "regionHint",
                )}
                onClick={() => session.setMode(mode)}
              >
                {mode === "element" ? (
                  <CursorIcon width="14" height="14" />
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    {mode === "arrow" ? (
                      <path d="M4 16L16 4M7 4H16V13" />
                    ) : (
                      <rect
                        x="3"
                        y="4"
                        width="14"
                        height="12"
                        rx="1"
                        strokeDasharray="3 2"
                      />
                    )}
                  </svg>
                )}
                {t(
                  mode === "element"
                    ? "elementMode"
                    : mode === "arrow"
                      ? "arrowMode"
                      : "regionMode",
                )}
              </button>
            ))}
            <button type="button" onClick={session.pause}>
              {t("cancel")}
            </button>
          </div>
        )}
        {mounted.current && (
          <aside
            className="ve-native-drawer"
            hidden={!state.enabled || state.picking}
            aria-label={t("title")}
          >
            <header className="ve-native-heading">
              <CursorIcon width="15" height="15" />
              <strong>{t("nativeEnter")}</strong>
              <button
                type="button"
                aria-label={t("nativeExit")}
                title={t("nativeExit")}
                onClick={session.toggle}
              >
                <Icon name="close" />
              </button>
            </header>
            <VisualEditPanel
              sessionId={props.sessionId}
              inputActions={props.inputActions}
              t={t}
              external={{
                ...state,
                pick: session.pick,
                startPick: session.startPick,
                highlight: session.highlight,
                capture: session.capture,
                clearSelection: session.clearSelection,
                setComment: session.setComment,
              }}
            />
          </aside>
        )}
      </>
    );
  }
  function HtmlAction(props: TabProps) {
    return <Toggle session={useSession(props)} />;
  }
  function htmlBody(Original: ComponentType<any>) {
    return function NativeHtml(props: HtmlProps) {
      const session = useSession(props);
      const root = useRef<HTMLDivElement>(null);
      const interactive = props.useInteractivePreview((value) => value);
      const data = props.content.data;
      const prepared = useMemo(() => {
        if (props.content.kind !== "bytes" || !data) return;
        try {
          return prepareHtml(
            data,
            props.resourceAddress,
            bootSource(session, "frame", props.resourceAddress),
            interactive,
            session.channel,
          );
        } catch {
          return undefined;
        }
      }, [
        data,
        props.content.kind,
        props.resourceAddress,
        interactive,
        session,
      ]);
      const srcDoc = useMemo(
        () =>
          !interactive && prepared
            ? new TextDecoder().decode(prepared)
            : undefined,
        [interactive, prepared],
      );
      useEffect(() => {
        if (!interactive) props.setResources([]);
      }, [interactive, props.setResources]);
      useEffect(() => {
        const node = root.current;
        if (!node || !prepared) return;
        let frame: HTMLIFrameElement | null = null;
        let detach: (() => void) | undefined;
        const scan = () => {
          const next = node.querySelector<HTMLIFrameElement>(
            "iframe[data-html-preview]",
          );
          if (frame === next) return;
          detach?.();
          frame = next;
          detach = frame
            ? session.attach(
                htmlTransport(frame, props.resourceAddress, session),
              )
            : undefined;
        };
        scan();
        const observer = new MutationObserver(scan);
        observer.observe(node, { childList: true, subtree: true });
        return () => {
          observer.disconnect();
          detach?.();
        };
      }, [prepared, props.resourceAddress, session]);
      return (
        <div className="ve-native ve-native-html" ref={root}>
          <style>{styles}</style>
          <div className="ve-native-page">
            {!prepared ? (
              <Original {...props} />
            ) : interactive ? (
              <Original
                {...props}
                content={{ kind: "bytes", data: prepared }}
              />
            ) : (
              <iframe
                data-html-preview
                sandbox="allow-scripts"
                srcDoc={srcDoc}
                title={t("active")}
              />
            )}
          </div>
          <Overlay session={session} props={props} />
        </div>
      );
    };
  }
  function browserBody(Original: ComponentType<any>) {
    return function NativeBrowser(props: TabProps) {
      const session = useSession(props);
      const root = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const node = root.current;
        if (!node) return;
        let view: Webview | null = null;
        let detach: (() => void) | undefined;
        const scan = () => {
          const next = node.querySelector<Webview>(
            'webview[data-sidebar-browser-frame="webview"]',
          );
          if (view === next) return;
          detach?.();
          view = next;
          detach = view
            ? session.attach(webviewTransport(view, session))
            : undefined;
        };
        scan();
        const observer = new MutationObserver(scan);
        observer.observe(node, { childList: true, subtree: true });
        return () => {
          observer.disconnect();
          detach?.();
        };
      }, [session]);
      return (
        <div className="ve-native ve-native-browser" ref={root}>
          <style>{styles}</style>
          <div className="ve-native-page">
            <Original {...props} />
          </div>
          <div className="ve-native-browser-action">
            <Toggle session={session} />
          </div>
          <Overlay session={session} props={props} />
        </div>
      );
    };
  }
  return {
    HtmlAction,
    htmlBody,
    browserBody,
    dispose() {
      for (const off of aborts) off();
      for (const session of sessions.values()) session.dispose();
      sessions.clear();
    },
  };
}

/** Shadow the public slot reversibly while forwarding the native renderer's store and injections. */
export function registerNativeIntegration(ctx: any, t: Translate): void {
  const integration = createNativeIntegration(t);
  ctx.effect(
    () => () => integration.dispose(),
    "dsh-visual-edit.native-sessions",
  );
  for (const [name, key, wrap] of [
    ["sidebar.right.pane.tab", BROWSER, integration.browserBody],
    ["sidebar.right.tab.document", HTML, integration.htmlBody],
  ] as const)
    ctx.effect(() => {
      let original: Entry | undefined;
      let unregister: (() => void) | undefined;
      let disposed = false;
      const refresh = () => {
        if (disposed) return;
        const next = (ctx.slots.entries(name) as Entry[]).find(
          (entry) =>
            entry.options.key === key && (entry.options.priority ?? 0) >= 0,
        );
        if (next === original) return;
        unregister?.();
        unregister = undefined;
        original = next;
        if (next)
          unregister = ctx.slots.register(
            {
              name,
              key,
              priority: -10,
              store: next.store,
              locale: next.locale,
              inject: next.inject,
            },
            wrap(next.component),
          );
      };
      const off = ctx.on("slots/changed", (changed: string) => {
        if (changed === name) queueMicrotask(refresh);
      });
      refresh();
      return () => {
        disposed = true;
        off();
        unregister?.();
      };
    }, `dsh-visual-edit.native:${key}`);
  ctx.effect(
    () =>
      ctx.slots.inject("sidebar.right.tab.document.action", () =>
        ctx.slots.register(
          {
            name: "sidebar.right.tab.document.action",
            key: HTML,
            locale: "dshVisualEdit",
            priority: -10,
          },
          integration.HtmlAction,
        ),
      ),
    "dsh-visual-edit.html-action",
  );
}
