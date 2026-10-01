import type { Snapshot } from "../shared/model";
import { prepareHtml } from "./native-html";
import { NativeSession, bootSource, htmlTransport } from "./native-session";

/** Re-render a user-selected historical file in an isolated, script-free preview. */
export async function recoverBaseline(
  file: File,
  before: Snapshot,
): Promise<Snapshot> {
  if (file.size > 2_000_000 || !/\.html?$/i.test(file.name))
    throw new Error("baselineFileInvalid");
  const session = new NativeSession();
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("data-visual-edit-overlay", "");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    left: "-30000px",
    top: "0",
    border: "0",
    width: `${before.viewport.width}px`,
    height: `${before.viewport.height}px`,
  });
  try {
    const prepared = prepareHtml(
      new Uint8Array(await file.arrayBuffer()),
      before.url,
      bootSource(session, "frame", before.url),
      false,
      session.channel,
    );
    frame.srcdoc = new TextDecoder().decode(prepared);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      frame.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      document.body.append(frame);
    });
    session.attach(htmlTransport(frame, before.url, session));
    const result = await session.capture(before);
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    if (
      !normalize(before.text) ||
      !normalize(result.text).includes(normalize(before.text)) ||
      result.fallbackRegion
    )
      throw new Error("baselineMismatch");
    if (!result.image) throw new Error(result.warning ?? "snapshotUnavailable");
    return {
      ...before,
      image: result.image,
      warning: undefined,
      imageRect: result.imageRect,
      selectionBounds: result.selectionBounds,
      selectionTargets: result.selectionTargets,
      restoredFromHtml: true,
    };
  } finally {
    session.dispose();
    frame.remove();
  }
}
