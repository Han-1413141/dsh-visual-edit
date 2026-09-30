import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  PROTOCOL,
  validSnapshot,
  type FrameMessage,
  type Snapshot,
} from "../shared/model";

type Pending = {
  resolve: (value: Snapshot) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export function useBridge(
  frame: RefObject<HTMLIFrameElement>,
  url: string,
  onSelect: (s: Snapshot) => void,
  onError: (key: string) => void,
) {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "ready" | "disconnected"
  >("idle");
  const [picking, setPicking] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const callbacks = useRef({ onSelect, onError });
  callbacks.current = { onSelect, onError };
  const connection = useRef<{ channel: string; origin: string }>();
  const pending = useRef(new Map<string, Pending>());
  const send = useCallback(
    (message: Record<string, unknown>) => {
      const c = connection.current;
      if (c)
        frame.current?.contentWindow?.postMessage(
          { ...message, protocol: PROTOCOL, channel: c.channel },
          c.origin,
        );
    },
    [frame],
  );
  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    const origin = new URL(url).origin;
    const channel = crypto.randomUUID();
    connection.current = { channel, origin };
    setStatus("connecting");
    setPicking(false);
    let ready = false;
    const hello = () => send({ type: "hello" });
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== origin
      )
        return;
      const m = event.data as FrameMessage;
      if (!m || m.protocol !== PROTOCOL || m.channel !== channel) return;
      if (m.type === "ready") {
        ready = true;
        setStatus("ready");
        clearInterval(retry);
        clearTimeout(timeout);
        return;
      }
      if (!ready) return;
      if (m.type === "pick-ended") {
        setPicking(false);
        return;
      }
      if (m.type === "selected") {
        setPicking(false);
        if (validSnapshot(m.snapshot)) callbacks.current.onSelect(m.snapshot);
        else callbacks.current.onError("invalidSnapshot");
      }
      if (m.type === "captured" || m.type === "error") {
        const item = m.requestId && pending.current.get(m.requestId);
        if (item && m.requestId) {
          clearTimeout(item.timer);
          pending.current.delete(m.requestId);
          if (m.type === "captured" && validSnapshot(m.snapshot))
            item.resolve(m.snapshot);
          else
            item.reject(
              new Error(m.type === "error" ? m.message : "invalidSnapshot"),
            );
        } else if (m.type === "error") callbacks.current.onError(m.message);
      }
    };
    window.addEventListener("message", receive);
    const retry = setInterval(hello, 700);
    const timeout = setTimeout(() => {
      clearInterval(retry);
      if (!ready) setStatus("disconnected");
    }, 8000);
    hello();
    return () => {
      send({ type: "disconnect" });
      connection.current = undefined;
      clearInterval(retry);
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      for (const item of pending.current.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("pageChanged"));
      }
      pending.current.clear();
    };
  }, [url, epoch, frame, send]);
  return {
    status,
    picking,
    onLoad: useCallback(() => setEpoch((e) => e + 1), []),
    pick: () => {
      send({ type: "pick", enabled: !picking });
      setPicking(!picking);
    },
    highlight: (snapshot: Snapshot) => send({ type: "highlight", snapshot }),
    capture: (snapshot: Snapshot): Promise<Snapshot> =>
      new Promise((resolve, reject) => {
        if (status !== "ready") {
          reject(new Error("disconnected"));
          return;
        }
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pending.current.delete(requestId);
          reject(new Error("timeout"));
        }, 15000);
        pending.current.set(requestId, { resolve, reject, timer });
        send({ type: "capture", snapshot, requestId });
      }),
  };
}
