import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("setting a target on A shows the countdown on B with both peers listed", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // Alice picks the default "next New Year (UTC)" target
    await a.getByRole("button", { name: /next New Year/ }).click();

    // Both peers see the countdown
    await expect(a.locator(".ny-countdown")).toBeVisible();
    await expect(b.locator(".ny-countdown")).toBeVisible();

    // Both peers listed
    await expect(b.locator(".ny-peers").getByText("alice")).toBeVisible();
    await expect(a.locator(".ny-peers").getByText("bob")).toBeVisible();
  } finally {
    await cleanup();
  }
});
