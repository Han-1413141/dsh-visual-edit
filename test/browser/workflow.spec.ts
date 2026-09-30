import { test, expect, type Page } from "@playwright/test";

async function connect(page: Page, path = "/") {
  await page.goto(path);
  await page
    .getByRole("textbox", { name: "Local preview URL" })
    .fill("http://127.0.0.1:5179/?test=secret-query#private-hash");
  await page.getByRole("button", { name: "Open page", exact: true }).click();
  await expect(page.getByText("Page connected", { exact: true })).toBeVisible();
}
async function annotate(page: Page) {
  await page
    .getByRole("button", { name: "Pick an element", exact: true })
    .click();
  await page.frameLocator("iframe").locator("#studio-cta").click();
  await expect(
    page.getByText("Selected element", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Shorten to Start free trial and make the button fill its card.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  await expect(page.locator(".ve-note")).toHaveCount(1);
}
test("select → source → composer → compare → confirm → restore, retaining page state", async ({
  page,
}) => {
  await connect(page);
  const app = page.frameLocator("iframe");
  await app.getByRole("button", { name: "Yearly" }).click();
  await annotate(page);
  await expect(page.locator(".ve-note .ve-source")).toContainText(
    "src/App.tsx:",
  );
  await expect(page.locator(".ve-image img")).toHaveCount(1);
  const color = await page
    .locator(".ve-image img")
    .evaluate(async (node: HTMLImageElement) => {
      await node.decode();
      const canvas = document.createElement("canvas");
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(node, 0, 0);
      return Array.from(ctx.getImageData(3, 3, 1, 1).data);
    });
  expect(color).toEqual([128, 150, 99, 255]);
  await page.getByRole("button", { name: "Add to chat", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Composer" });
  // Insertion follows an asynchronous IndexedDB revision check. Wait for the
  // visible update instead of reading the old draft immediately after a click.
  await expect(composer).toHaveValue(/src\/App\.tsx/);
  const text = await composer.inputValue();
  expect(text).toContain("Existing draft.");
  expect(text).toContain("src/App.tsx");
  expect(text).not.toContain("secret-query");
  expect(text).not.toContain("private-hash");
  expect(text).not.toContain("base64");
  await expect(app.getByRole("button", { name: "Yearly" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A controlled DOM change tests the inspector; the separate DSH smoke run uses real file HMR.
  await app.locator("#studio-cta").evaluate((node) => {
    node.textContent = "Start free trial";
    (node as HTMLElement).style.width = "100%";
  });
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(2);
  await page.locator(".ve-changes summary").click();
  await expect(page.locator(".ve-changes")).toContainText("Start free trial");
  await page
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await expect(page.locator(".ve-status")).toHaveText("Confirmed");
  await page.reload();
  await page.getByRole("tab", { name: /Feedback/ }).click();
  await expect(page.locator(".ve-status")).toHaveText("Confirmed");
  await expect(page.locator(".ve-image img")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Session" })
    .selectOption("session-two");
  await expect(page.locator(".ve-note")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Session" })
    .selectOption("session-one");
  await page.getByRole("tab", { name: /Feedback/ }).click();
  await expect(page.locator(".ve-note")).toHaveCount(1);
});
test("capture rejects a different viewport and a missing element", async ({
  page,
}) => {
  await connect(page);
  await annotate(page);
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.getByRole("tab", { name: /Feedback/ }).click();
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Restore the original page address and viewport",
  );
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  await page.getByRole("tab", { name: /Feedback/ }).click();
  await page
    .frameLocator("iframe")
    .locator("#studio-cta")
    .evaluate((node) => node.remove());
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "original element is missing",
  );
  await expect(page.locator(".ve-image img")).toHaveCount(1);
});
test("private content is excluded and unrelated windows cannot inject a selection", async ({
  page,
}) => {
  await connect(page);
  await page.evaluate(() =>
    window.postMessage(
      {
        type: "selected",
        protocol: "dsh-visual-edit/v1",
        channel: "forged-not-the-real-channel",
        snapshot: { text: "injected" },
      },
      location.origin,
    ),
  );
  await expect(page.locator(".ve-selection")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pick an element", exact: true })
    .click();
  await page.frameLocator("iframe").getByTestId("private-input").click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Improve this field.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(0);
  await page.getByRole("button", { name: "Add to chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Composer" })).toHaveValue(
    /\[private element\]/,
  );
  const prompt = await page
    .getByRole("textbox", { name: "Composer" })
    .inputValue();
  expect(prompt).toContain("[private element]");
  expect(prompt).not.toContain("private-demo-value");
});
test("storage revision guard does not overwrite a newer edit", async ({
  page,
  context,
}) => {
  await connect(page);
  await annotate(page);
  const other = await context.newPage();
  // Suppress cross-tab notifications in this tab so it really holds a stale revision.
  await other.addInitScript(() => {
    window.BroadcastChannel = class extends EventTarget {
      name = "test";
      onmessage = null;
      onmessageerror = null;
      postMessage() {}
      close() {}
    } as unknown as typeof BroadcastChannel;
  });
  await other.goto("/");
  await other.getByRole("tab", { name: /Feedback/ }).click();
  await expect(other.locator(".ve-note")).toHaveCount(1);
  await other
    .getByRole("button", { name: "Edit feedback", exact: true })
    .click();
  await other
    .getByRole("textbox", { name: "What should change?" })
    .fill("Stale edit from tab two.");
  await page
    .getByRole("button", { name: "Edit feedback", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("New feedback from tab one.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await other
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(other.locator(".ve-notice")).toContainText(
    "changed in another tab",
  );
  await expect(other.locator(".ve-note")).toContainText(
    "New feedback from tab one.",
  );
  await other.close();
});

test("DSH theme overrides the OS theme and narrow sidebars stay usable", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await connect(page);
  await expect(page.locator(".ve-root")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("combobox", { name: "DSH theme" }).selectOption("dark");
  await expect(page.locator(".ve-root")).toHaveCSS(
    "background-color",
    "rgb(21, 21, 23)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".ve-root")).toHaveCSS(
    "background-color",
    "rgb(21, 21, 23)",
  );
  await page.getByRole("spinbutton", { name: "Sidebar width" }).fill("340");
  await annotate(page);
  const overflow = await page
    .locator(".ve-root")
    .evaluate((root) =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          ".ve-navigation,.ve-filters,.ve-review",
        ),
      ).some((el) => el.scrollWidth > el.clientWidth + 2),
    );
  expect(overflow).toBe(false);
  await expect(
    page.getByRole("button", { name: "Add to chat", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  expect(
    await page
      .frameLocator("iframe")
      .locator("body")
      .evaluate(() => innerWidth),
  ).toBe(1024);
});

test("enlarged comparison, search, filters and inline deletion", async ({
  page,
}) => {
  await connect(page);
  await annotate(page);
  await page
    .frameLocator("iframe")
    .locator("#studio-cta")
    .evaluate((node) => {
      node.textContent = "Start free trial";
    });
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.locator(".ve-review .ve-image img")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Enlarge snapshot · Before", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Compare snapshots" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Overlay", exact: true }).click();
  const slider = dialog.getByRole("slider", { name: "Reveal result" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("51");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator(".ve-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmed", exact: true }).click();
  await expect(page.locator(".ve-note")).toHaveCount(1);
  const search = page.getByRole("searchbox", { name: "Search feedback" });
  await search.fill("no matches");
  await expect(page.locator(".ve-note")).toHaveCount(0);
  await search.fill("free trial");
  await expect(page.locator(".ve-note")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("group", { name: "Delete this note?" });
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.locator(".ve-note")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator(".ve-note")).toHaveCount(0);
});

test("a live broadcast cannot silently overwrite an in-progress edit", async ({
  page,
  context,
}) => {
  await connect(page);
  await annotate(page);
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("tab", { name: /Feedback/ }).click();
  await other
    .getByRole("button", { name: "Edit feedback", exact: true })
    .click();
  await other
    .getByRole("textbox", { name: "What should change?" })
    .fill("My unfinished text.");
  await page
    .getByRole("button", { name: "Edit feedback", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Latest text from another tab.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(other.locator(".ve-edit-conflict")).toBeVisible();
  await expect(
    other.getByRole("textbox", { name: "What should change?" }),
  ).toHaveValue("My unfinished text.");
  await expect(
    other.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await other
    .getByRole("button", { name: "Load latest note", exact: true })
    .click();
  await expect(
    other.getByRole("textbox", { name: "What should change?" }),
  ).toHaveValue("Latest text from another tab.");
  await other.close();
});
