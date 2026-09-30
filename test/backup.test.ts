import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBackup,
  serializeBackup,
  MAX_BACKUP_BYTES,
} from "../src/shared/backup";
import { createNote, feedbackText, type Snapshot } from "../src/shared/model";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK3sAAAAASUVORK5CYII=";
const sample: Snapshot = {
  url: "http://localhost:5173/pricing",
  pageKey: "a".repeat(64),
  capturedAt: "2026-09-30T08:00:00.000Z",
  viewport: { width: 1024, height: 640 },
  locator: {
    selector: "#cta",
    tag: "button",
    source: { file: "src/App.tsx", line: 2, column: 1 },
  },
  text: "Try now",
  styles: { color: "black" },
  rect: { width: 80, height: 20, x: 0, y: 0 },
  image: png,
};
const note = () =>
  createNote("original-session", sample, "Make this button wider.");
test("v1 backups preserve notes and snapshots while stripping unknown and private URL fields", () => {
  const original = {
    ...note(),
    status: "confirmed" as const,
    after: { ...sample, text: "Try free" },
  };
  const data = JSON.parse(serializeBackup([original]));
  data.notes[0].extra = "discard";
  data.notes[0].before.locator.extra = "discard";
  data.notes[0].before.url += "?secret=value#private";
  const restored = parseBackup("\uFEFF" + JSON.stringify(data));
  assert.deepEqual(restored.notes, [original]);
  assert.equal(restored.notes[0].after?.image, png);
});
test("invalid backup records, identities and mismatched comparisons are rejected together", () => {
  const original = note();
  for (const bad of [
    { ...original, comment: "" },
    { ...original, revision: -1 },
    { ...original, status: "confirmed" },
    { ...original, id: "" },
    { ...original, before: { ...sample, capturedAt: "invalid" } },
    { ...original, before: { ...sample, pageKey: "not-a-hash" } },
    {
      ...original,
      before: { ...sample, image: "https://example.com/image.png" },
    },
    {
      ...original,
      before: {
        ...sample,
        locator: {
          ...sample.locator,
          source: { file: "../private", line: 1, column: 1 },
        },
      },
    },
    { ...original, after: { ...sample, pageKey: "b".repeat(64) } },
    {
      ...original,
      after: { ...sample, viewport: { width: 390, height: 720 } },
    },
  ])
    assert.throws(
      () =>
        parseBackup(
          JSON.stringify({
            format: "dsh-visual-edit/v1",
            exportedAt: sample.capturedAt,
            notes: [bad],
          }),
        ),
      /invalidBackup/,
    );
  assert.throws(
    () => parseBackup(serializeBackup([original, original])),
    /invalidBackup/,
  );
  assert.throws(
    () =>
      parseBackup(JSON.stringify({ format: "other/v1", notes: [original] })),
    /invalidBackup/,
  );
  assert.throws(() => parseBackup(serializeBackup([])), /backupEmpty/);
  assert.throws(
    () => parseBackup("x".repeat(MAX_BACKUP_BYTES + 1)),
    /backupTooLarge/,
  );
  assert.throws(
    () => parseBackup(serializeBackup(Array.from({ length: 51 }, note))),
    /invalidBackup/,
  );
});
test("PNG headers are bounded before decoding imported images", () => {
  const bytes = Buffer.from(png.split(",")[1], "base64");
  bytes.writeUInt32BE(100000, 16);
  assert.throws(
    () =>
      parseBackup(
        serializeBackup([
          {
            ...note(),
            before: {
              ...sample,
              image: "data:image/png;base64," + bytes.toString("base64"),
            },
          },
        ]),
      ),
    /invalidBackup/,
  );
  assert.throws(
    () =>
      parseBackup(
        serializeBackup([
          {
            ...note(),
            before: { ...sample, image: "data:image/png;base64,YQ==" },
          },
        ]),
      ),
    /invalidBackup/,
  );
});
test("multiple requests share one prompt and keep query, hash and PNG bytes out", () => {
  const a = note(),
    b = {
      ...note(),
      comment: "Shorten this label.",
      before: { ...sample, url: sample.url + "?secret=value#private" },
    };
  const text = feedbackText([a, b]);
  assert.equal(text.match(/^# Visual Edit feedback/gm)?.length, 1);
  assert.equal(text.match(/^## \d+\. User request/gm)?.length, 2);
  assert(text.includes(a.comment) && text.includes(b.comment));
  for (const privateValue of ["secret=value", "#private", "base64"])
    assert(!text.includes(privateValue));
});

test("annotation backups retain bounded document coordinates and explicit viewport differences", () => {
  const original = {
    ...note(),
    before: {
      ...sample,
      annotation: {
        kind: "arrow" as const,
        region: { x: 10, y: 20, width: 200, height: 100 },
        from: { x: 20, y: 30 },
        to: { x: 180, y: 90 },
      },
      scroll: { x: 0, y: 30 },
    },
    after: {
      ...sample,
      viewportChanged: true,
      fallbackRegion: true,
      viewport: { width: 800, height: 700 },
    },
  };
  assert.deepEqual(parseBackup(serializeBackup([original])).notes[0], original);
  assert(feedbackText([original]).includes('"kind": "arrow"'));
  const invalid = {
    ...original,
    before: {
      ...original.before,
      annotation: { ...original.before.annotation, to: { x: 10000, y: 0 } },
    },
  };
  assert.throws(() => parseBackup(serializeBackup([invalid])), /invalidBackup/);
});
