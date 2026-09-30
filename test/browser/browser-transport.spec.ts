import { test, expect } from "@playwright/test";

test("Browser adapter injects without a Vite bridge and resumes automatic comparison after navigation", async ({
  page,
}) => {
  await page.goto("/browser.html");
  const frame = page.frameLocator("iframe");
  await expect(frame.locator("#headline")).toHaveText("Browser preview");
  await page.getByRole("button", { name: "Visual Edit", exact: true }).click();
  await expect(page.locator(".ve-native-picking")).toBeVisible();
  await frame.locator("#headline").click();
  await page
    .getByRole("textbox", { name: "What should change?" })
    .fill("Change the heading.");
  await page
    .getByRole("button", { name: "Add to chat & compare", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Composer" })).toHaveValue(
    /Existing draft\.[\s\S]*Change the heading/,
  );
  await frame.locator("#headline").evaluate((el) => {
    el.textContent = "Browser updated";
  });
  await expect(page.locator(".ve-image img")).toHaveCount(2, {
    timeout: 15000,
  });
  await expect(page.locator(".ve-changes")).toContainText("Browser updated");
  await frame.locator("body").evaluate(() => location.reload());
  await expect(frame.locator("#headline")).toHaveText("Browser preview");
  await expect(page.locator(".ve-changes")).not.toContainText(
    "Browser updated",
    { timeout: 15000 },
  );
  await expect(
    page.getByRole("button", { name: "Capture result", exact: true }),
  ).toBeEnabled();
});
