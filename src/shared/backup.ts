import {
  MAX_NOTES,
  validSnapshot,
  type ReviewNote,
  type Snapshot,
} from "./model";

export const MAX_BACKUP_BYTES = 70_000_000;
export interface Backup {
  exportedAt: string;
  notes: ReviewNote[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const date = (value: unknown): value is string =>
  text(value, 50) && Number.isFinite(Date.parse(value));

function boundedPng(image: string): boolean {
  // Read the PNG header before any image is decoded. A tiny compressed file
  // must not expand into an unbounded image when a backup is opened.
  try {
    const header = atob(
      image.slice(
        "data:image/png;base64,".length,
        "data:image/png;base64,".length + 44,
      ),
    );
    if (
      header.slice(0, 8) !== "\x89PNG\r\n\x1a\n" ||
      header.slice(12, 16) !== "IHDR"
    )
      return false;
    const number = (offset: number) =>
      Array.from(header.slice(offset, offset + 4)).reduce(
        (n, ch) => n * 256 + ch.charCodeAt(0),
        0,
      );
    return (
      header.length >= 33 &&
      number(8) === 13 &&
      [number(16), number(20)].every((n) => n > 0 && n <= 1600)
    );
  } catch {
    return false;
  }
}
function snapshot(value: unknown): Snapshot {
  if (
    !validSnapshot(value) ||
    !date(value.capturedAt) ||
    !/^[a-f0-9]{64}$/.test(value.pageKey) ||
    !/^[a-z][a-z0-9-]{0,39}$/.test(value.locator.tag) ||
    value.rect.width < 0 ||
    value.rect.height < 0 ||
    Object.keys(value.styles).some((k) => !/^[a-zA-Z][\w-]{0,63}$/.test(k)) ||
    (value.image && !boundedPng(value.image))
  )
    throw new Error("invalidBackup");
  const url = new URL(value.url);
  const { selector, tag, id, testId, source } = value.locator;
  // Only known fields enter storage, and query/hash data stays out of exports
  // and feedback even when an imported file was authored elsewhere.
  return {
    url: url.origin + url.pathname,
    pageKey: value.pageKey,
    capturedAt: new Date(value.capturedAt).toISOString(),
    viewport: { width: value.viewport.width, height: value.viewport.height },
    rect: {
      width: value.rect.width,
      height: value.rect.height,
      x: value.rect.x,
      y: value.rect.y,
    },
    locator: {
      selector,
      tag,
      ...(id !== undefined ? { id } : {}),
      ...(testId !== undefined ? { testId } : {}),
      ...(source
        ? {
            source: {
              file: source.file,
              line: source.line,
              column: source.column,
            },
          }
        : {}),
    },
    text: value.text,
    styles: Object.fromEntries(Object.entries(value.styles)),
    ...(value.image ? { image: value.image } : {}),
    ...(value.warning ? { warning: value.warning } : {}),
  };
}
export function parseBackup(input: string): Backup {
  if (
    input.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES
  )
    throw new Error("backupTooLarge");
  let data: unknown;
  try {
    data = JSON.parse(input.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("invalidBackup");
  }
  if (
    !object(data) ||
    data.format !== "dsh-visual-edit/v1" ||
    !date(data.exportedAt) ||
    !Array.isArray(data.notes) ||
    data.notes.length > MAX_NOTES
  )
    throw new Error("invalidBackup");
  if (!data.notes.length) throw new Error("backupEmpty");
  const ids = new Set<string>();
  const notes = data.notes.map((raw): ReviewNote => {
    if (
      !object(raw) ||
      !text(raw.id, 200) ||
      !text(raw.sessionId, 200) ||
      !text(raw.comment, 3000) ||
      !raw.comment.trim() ||
      !["draft", "queued", "review", "confirmed"].includes(
        raw.status as string,
      ) ||
      !Number.isSafeInteger(raw.revision) ||
      (raw.revision as number) < 0 ||
      !date(raw.updatedAt) ||
      ids.has(raw.id)
    )
      throw new Error("invalidBackup");
    ids.add(raw.id);
    const before = snapshot(raw.before);
    const after = raw.after === undefined ? undefined : snapshot(raw.after);
    if (
      (["review", "confirmed"].includes(raw.status as string) && !after) ||
      (after &&
        (after.pageKey !== before.pageKey ||
          after.viewport.width !== before.viewport.width ||
          after.viewport.height !== before.viewport.height))
    )
      throw new Error("invalidBackup");
    return {
      id: raw.id,
      sessionId: raw.sessionId,
      comment: raw.comment,
      status: raw.status as ReviewNote["status"],
      revision: raw.revision as number,
      updatedAt: new Date(raw.updatedAt).toISOString(),
      before,
      ...(after ? { after } : {}),
    };
  });
  return { exportedAt: new Date(data.exportedAt).toISOString(), notes };
}
export function serializeBackup(notes: ReviewNote[]): string {
  return JSON.stringify(
    {
      format: "dsh-visual-edit/v1",
      exportedAt: new Date().toISOString(),
      notes,
    },
    null,
    2,
  );
}
