import { test, expect } from "@playwright/test";

test("native HTML: one-click selection, source, composer, reload comparison and retained page state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/native.html");
  const frame = page.frameLocator("iframe[data-html-preview]");
  await frame.locator("#counter").click();
  await expect(frame.locator("#counter")).toHaveText("Clicked 1");
  const viewport = await frame
    .locator("body")
    .evaluate(() => [innerWidth, innerHeight]);
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await frame.locator("#headline").click();
  await expect(page.locator(".ve-selection .ve-source")).toHaveText(
    "simple-page.html:6:1",
  );
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Use a clearer heading.");
  // Closing the mode preserves both an unsaved comment and the page's browsing context.
  await page.locator(".ve-native-toggle").click();
  await expect(page.locator(".ve-native-drawer")).toBeHidden();
  await page.locator(".ve-native-toggle").click();
  await expect(
    page.getByRole("textbox", { name: "What should change?" }),
  ).toHaveValue("Use a clearer heading.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(1);
  // Divider comments must be omitted from the XML clone without changing the live page.
  expect(
    await frame
      .locator("main")
      .evaluate((el) =>
        Array.from(el.childNodes).some(
          (n) =>
            n.nodeType === Node.COMMENT_NODE &&
            n.textContent?.includes("----------"),
        ),
      ),
  ).toBe(true);
  expect(
    await frame.locator("body").evaluate(() => [innerWidth, innerHeight]),
  ).toEqual(viewport);
  await expect(frame.locator("#counter")).toHaveText("Clicked 1");
  await page.getByRole("button", { name: "Add to chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Composer" })).toHaveValue(
    /Existing draft\.[\s\S]*simple-page.html/,
  );
  await page
    .getByRole("button", { name: "Update source", exact: true })
    .click();
  await expect(frame.locator("#headline")).toHaveText("Updated heading");
  await expect(page.locator(".ve-image img")).toHaveCount(2, {
    timeout: 15000,
  });
  await expect(page.locator(".ve-selection")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await expect(page.locator(".ve-status")).toHaveText("Confirmed");
  expect(errors).toEqual([]);
});

test("failed snapshots report partial results and recover after reload without replacing the baseline", async ({
  page,
}) => {
  await page.goto("/native.html");
  const frame = page.frameLocator("iframe[data-html-preview]");
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await frame.locator("body").evaluate(() => {
    (window as any).__snapshotAttempts = 0;
    HTMLCanvasElement.prototype.toDataURL = () => {
      (window as any).__snapshotAttempts++;
      throw new DOMException("Snapshot failure", "SecurityError");
    };
  });
  await frame.locator("#headline").click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Keep the original baseline.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  const beforeTime = await page
    .locator(".ve-image time")
    .first()
    .getAttribute("datetime");
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.locator(".ve-auto-status")).toContainText(
    "images are missing",
  );
  await expect(page.locator(".ve-image img")).toHaveCount(0);
  // One recovery attempt per load; a persistent failure must not cause a capture loop.
  await expect
    .poll(() =>
      frame.locator("body").evaluate(() => (window as any).__snapshotAttempts),
    )
    .toBe(3);
  await page.waitForTimeout(1500);
  expect(
    await frame
      .locator("body")
      .evaluate(() => (window as any).__snapshotAttempts),
  ).toBe(3);
  await page.reload();
  await expect(page.locator(".ve-image img")).toHaveCount(1, {
    timeout: 15000,
  });
  await expect(page.locator(".ve-image").first()).toContainText(
    "cannot be recreated",
  );
  await expect(page.locator(".ve-image time").first()).toHaveAttribute(
    "datetime",
    beforeTime!,
  );
  await expect(page.locator(".ve-image").last().locator("img")).toBeVisible();
  await expect(page.locator(".ve-auto-status")).toContainText(
    "images are missing",
  );
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(1);
});

test("static preview keeps page scripts blocked while the bundled inspector works", async ({
  page,
}) => {
  await page.goto("/native.html?static");
  const frame = page.frameLocator("iframe[data-html-preview]");
  await expect(frame.locator("#script-status")).toHaveText("Static");
  await frame.locator("#counter").click();
  await expect(frame.locator("#counter")).toHaveText("Click me");
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await frame.locator("#headline").click();
  await expect(
    page.getByRole("textbox", { name: "What should change?" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Static inspection works.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(1);
  await expect(frame.locator("#script-status")).toHaveText("Static");
});

test("preview channels are isolated and cannot be started by a forged message", async ({
  page,
}) => {
  await page.goto("/native.html");
  await page.getByRole("button", { name: "Second preview" }).click();
  const first = page.locator('[data-preview="0"]');
  const second = page.locator('[data-preview="1"]');
  await first.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(first.locator(".ve-native-picking")).toBeVisible();
  await second.locator("iframe").evaluate((element: HTMLIFrameElement) => {
    element.contentWindow!.postMessage(
      {
        protocol: "dsh-visual-edit/v1",
        channel: "forged-but-long-enough",
        type: "pick",
        enabled: true,
      },
      "*",
    );
  });
  await second.frameLocator("iframe").locator("#counter").click();
  await expect(second.frameLocator("iframe").locator("#counter")).toHaveText(
    "Clicked 1",
  );
  await first.frameLocator("iframe").locator("#headline").click();
  await expect(first.locator(".ve-selection")).toBeVisible();
  await expect(second.locator(".ve-selection")).toHaveCount(0);
});

for (const mode of ["Arrow", "Rectangle"]) {
  test(`native ${mode}: drag, annotated image, one-click composer and automatic comparison`, async ({
    page,
  }) => {
    await page.goto("/native.html");
    const frame = page.frameLocator("iframe[data-html-preview]");
    await page
      .getByRole("button", { name: "Visual Edit", exact: true })
      .click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    const box = (await frame.locator("#headline").boundingBox())!;
    const start = { x: box.x - 22, y: box.y - 22 };
    const end =
      mode === "Arrow"
        ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        : { x: box.x + box.width + 15, y: box.y + box.height + 15 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    await page
      .getByRole("textbox", { name: "What should change?" })
      .fill("Improve this highlighted area.");
    await page
      .getByRole("button", { name: "Add to chat & compare", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "Composer" })).toHaveValue(
      new RegExp(`"kind": "${mode === "Arrow" ? "arrow" : "region"}"`),
    );
    await expect(page.locator(".ve-image img")).toHaveCount(1);
    // Region output must contain the page, not a blank crop with an annotation over it.
    const pixels = await page
      .locator(".ve-image img")
      .evaluate((img: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const context = c.getContext("2d")!;
        context.drawImage(img, 0, 0);
        const values = context.getImageData(
          8,
          8,
          c.width - 16,
          c.height - 16,
        ).data;
        let light = 0,
          dark = 0;
        for (let i = 0; i < values.length; i += 4) {
          if (values[i] > 200 && values[i + 1] > 200 && values[i + 2] > 200)
            light++;
          if (values[i] < 100 && values[i + 2] > values[i]) dark++;
        }
        return { light, dark, width: c.width, height: c.height };
      });
    expect(pixels.light).toBeGreaterThan(20);
    expect(pixels.dark).toBeGreaterThan(100);
    expect(pixels.width).toBeLessThanOrEqual(1600);
    expect(pixels.height).toBeLessThanOrEqual(1600);
    await page
      .getByRole("button", { name: "Update source", exact: true })
      .click();
    await expect(page.locator(".ve-image img")).toHaveCount(2, {
      timeout: 15000,
    });
    await expect(page.locator(".ve-changes")).toContainText("Updated heading");
    await page.screenshot({
      path: `test-results/native-${mode.toLowerCase()}.png`,
    });
  });
}

test("native comparison follows DOM changes, ignores unrelated updates and stops at confirmation", async ({
  page,
}) => {
  await page.goto("/native.html");
  const frame = page.frameLocator("iframe[data-html-preview]");
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await frame.locator("#headline").click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Update the heading.");
  await page
    .getByRole("button", { name: "Add to chat & compare", exact: true })
    .click();
  await frame.locator("#script-status").evaluate((el) => {
    el.textContent = "An unrelated clock tick";
  });
  await page.waitForTimeout(1500);
  await expect(page.locator(".ve-image img")).toHaveCount(1);
  await frame.locator("#headline").evaluate((el) => {
    el.textContent = "Live HMR update";
  });
  await expect(page.locator(".ve-image img")).toHaveCount(2, {
    timeout: 15000,
  });
  await expect(page.locator(".ve-changes")).toContainText("Live HMR update");
  await page
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await frame.locator("#headline").evaluate((el) => {
    el.textContent = "Later unrelated edit";
  });
  await page.waitForTimeout(1500);
  await expect(page.locator(".ve-status")).toHaveText("Confirmed");
  await expect(page.locator(".ve-changes")).not.toContainText(
    "Later unrelated edit",
  );
});

test("manual comparison survives viewport changes and a deleted element", async ({
  page,
}) => {
  await page.goto("/native.html");
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await page
    .frameLocator("iframe[data-html-preview]")
    .locator("#headline")
    .click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Remove this heading.");
  await page
    .getByRole("button", { name: "Save feedback", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove heading", exact: true })
    .click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Capture result", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(2);
  await expect(page.locator(".ve-image").last()).toContainText("original area");
  await expect(page.locator(".ve-image").last()).toContainText("size changed");
});

test("unique native targets survive shifted source lines and animated cards keep their content", async ({
  page,
}) => {
  await page.goto("/native.html");
  const frame = page.frameLocator("iframe[data-html-preview]");
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await frame.locator("main").click({ position: { x: 15, y: 15 } });
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Update this card.");
  await page
    .getByRole("button", { name: "Add to chat & compare", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move source and animate", exact: true })
    .click();
  await expect(page.locator(".ve-image img")).toHaveCount(2, {
    timeout: 15000,
  });
  await expect(page.locator(".ve-image").last()).not.toContainText(
    "original area",
  );
  const light = await page
    .locator(".ve-image img")
    .last()
    .evaluate((img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < rgba.length; i += 4)
        if (rgba[i] > 210 && rgba[i + 1] > 210 && rgba[i + 2] > 210) count++;
      return count;
    });
  expect(light).toBeGreaterThan(100);
});
