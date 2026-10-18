import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.APP_URL || "http://127.0.0.1:5173";
const live = process.argv.includes("--live");
const output = new URL("../../docs/browser/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [],
  errors = [],
  external = [];
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    external.push(url.href);
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const check = async (name, fn) => {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
};
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "A little curiosity. A lot of clarity." })
    .waitFor();
  await check("No horizontal overflow at 320, 360, 768 and 1280", async () => {
    for (const width of [320, 360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: new URL(`light-${width}.png`, output).pathname.replace(
          /^\/(\w:)/,
          "$1",
        ),
      });
    }
  });
  await check("Theme toggle and persisted dark theme", async () => {
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.screenshot({
      path: new URL("dark-1280.png", output).pathname.replace(/^\/(\w:)/, "$1"),
    });
    await page.getByRole("button", { name: "Switch to light theme" }).click();
  });
  await check("Mobile menu keyboard dismissal and focus return", async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.click();
    await page.keyboard.press("Escape");
    assert.equal(
      await menu.evaluate((el) => el === document.activeElement),
      true,
    );
    await menu.click();
    await page.getByRole("button", { name: "Settings & models" }).click();
    await page
      .getByRole("heading", { name: "Intelligence, on your terms." })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByRole("switch", { name: "Reduce motion" }).check();
    assert.equal(
      await page.locator("html").getAttribute("data-motion"),
      "reduce",
    );
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await check("Knowledge library and explicit document approval", async () => {
    await page.getByRole("button", { name: /Knowledge library/ }).click();
    await page
      .getByRole("heading", { name: "Good answers start with good sources." })
      .waitFor();
    assert.equal(
      await page.getByLabel("Choose an approved document").isDisabled(),
      true,
    );
    await page.getByRole("checkbox").check();
    assert.equal(
      await page.getByLabel("Choose an approved document").isEnabled(),
      true,
    );
    await page.screenshot({
      path: new URL("library.png", output).pathname.replace(/^\/(\w:)/, "$1"),
    });
  });
  await check("Real API abstention and history persistence", async () => {
    await page.getByRole("button", { name: "New conversation" }).click();
    await page
      .getByRole("textbox", { name: "Ask about Apptunix" })
      .fill("What is Apptunix's exact internal payroll?");
    await page.getByRole("button", { name: "Send question" }).click();
    await page
      .getByText("I couldn't find that in the available Apptunix sources.", {
        exact: false,
      })
      .waitFor();
    await page.getByRole("button", { name: "Copy answer" }).waitFor();
    await page.reload();
    await page.locator(".history button").first().click();
    await page
      .getByText("I couldn't find that in the available Apptunix sources.", {
        exact: false,
      })
      .waitFor();
  });
  await check(
    "Clear history requires confirmation; dialog returns focus",
    async () => {
      const trigger = page.getByRole("button", {
        name: "Clear conversation history",
        exact: true,
      });
      await trigger.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await trigger.evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(await page.locator(".history button").count(), 1);
      await trigger.click();
      await page
        .getByRole("button", { name: "Clear history", exact: true })
        .click();
      assert.equal(await page.locator(".history button").count(), 0);
    },
  );
  await check(
    "Backend failure message, retained retry control, no stuck spinner",
    async () => {
      await page.route("**/api/chat", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Test backend outage: restart the Python server.",
          }),
        }),
      );
      await page
        .getByRole("textbox", { name: "Ask about Apptunix" })
        .fill("What services does Apptunix offer?");
      await page.getByRole("button", { name: "Send question" }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Test backend outage" })
        .waitFor();
      await page.getByRole("button", { name: "Retry question" }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Stop generation" }).count(),
        0,
      );
      await page.unroute("**/api/chat");
    },
  );
  if (live) {
    await check(
      "Live local RAG, streaming completion and expandable citations",
      async () => {
        await page.getByRole("button", { name: "New conversation" }).click();
        await page
          .getByRole("textbox", { name: "Ask about Apptunix" })
          .fill("Does Apptunix develop Android and iOS applications?");
        await page.getByRole("button", { name: "Send question" }).click();
        await page.getByRole("button", { name: "Stop generation" }).waitFor();
        await page
          .locator(".source-chips button")
          .first()
          .waitFor({ timeout: 240000 });
        await page.locator(".source-chips button").first().click();
        await page
          .getByRole("heading", { name: "Behind the answer" })
          .waitFor();
        assert.ok((await page.locator("blockquote").innerText()).length > 30);
        assert.ok(
          (
            await page
              .getByRole("link", { name: "Open original source" })
              .getAttribute("href")
          ).startsWith("https://www.apptunix.com/"),
        );
        await page.screenshot({
          path: new URL("source-passage.png", output).pathname.replace(
            /^\/(\w:)/,
            "$1",
          ),
        });
        await page.keyboard.press("Escape");
        await page.screenshot({
          path: new URL("live-answer.png", output).pathname.replace(
            /^\/(\w:)/,
            "$1",
          ),
        });
      },
    );
    await check(
      "Stop aborts a live generation and permits a new conversation",
      async () => {
        await page.getByRole("button", { name: "New conversation" }).click();
        await page
          .getByRole("textbox", { name: "Ask about Apptunix" })
          .fill("Explain all Apptunix services in detail.");
        await page.getByRole("button", { name: "Send question" }).click();
        await page
          .getByText("Writing from retrieved sources", { exact: true })
          .waitFor({ timeout: 240000 });
        await page.getByRole("button", { name: "Stop generation" }).click();
        await page.getByText("Generation stopped.", { exact: false }).waitFor();
        await page.getByRole("button", { name: "New conversation" }).click();
        await page
          .getByRole("heading", {
            name: "A little curiosity. A lot of clarity.",
          })
          .waitFor();
      },
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  results.push({
    name: "No browser errors or external runtime requests",
    passed: true,
  });
} catch (error) {
  results.push({ name: "Failure", passed: false, error: String(error) });
  await page.screenshot({
    path: new URL("failure.png", output).pathname.replace(/^\/(\w:)/, "$1"),
  });
  throw error;
} finally {
  await writeFile(
    new URL(live ? "live-report.json" : "report.json", output),
    JSON.stringify({ base, live, results, errors, external }, null, 2),
  );
  await browser.close();
}
