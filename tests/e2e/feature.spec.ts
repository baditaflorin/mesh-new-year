import { expect, test, type Page } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

// Pin a single PAGE to a timezone. `openTwoPeers` shares one browser context
// (so localStorage is shared between the two peers — setting `${prefix}:tz` on
// one page clobbers the other). The runtime timezone, by contrast, is a true
// per-page fact: we override `Intl.DateTimeFormat` so a default-constructed
// formatter (what `detectTz()` and the per-peer render use) resolves to `zone`.
// addInitScript is per-page and re-runs on reload, so each peer keeps its own
// zone across navigation.
async function pinTimezone(page: Page, zone: string): Promise<void> {
  await page.addInitScript((tz) => {
    const Orig = Intl.DateTimeFormat;
    function Patched(this: unknown, locales?: unknown, options?: Record<string, unknown>) {
      const opts = Object.assign({}, options);
      if (opts.timeZone == null) opts.timeZone = tz;
      return new (Orig as unknown as new (l?: unknown, o?: unknown) => Intl.DateTimeFormat)(
        locales,
        opts,
      );
    }
    Patched.prototype = Orig.prototype;
    (Patched as unknown as { supportedLocalesOf: unknown }).supportedLocalesOf = (
      Orig as unknown as { supportedLocalesOf: unknown }
    ).supportedLocalesOf;
    (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = Patched;
  }, zone);
}

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

// Load-bearing cross-peer + cross-TIMEZONE assertion for the advertised core
// action: "Synced new-year countdown across timezones — everyone hits local
// 00:00 together". Two peers in DIFFERENT timezones must converge on the SAME
// shared absolute instant. We prove that the per-timezone local rendering of
// that one instant is (a) different between the two zones, yet (b) byte-for-byte
// identical for a given peer when read on EITHER browser — i.e. the instant is
// a single shared value crossing the mesh, not recomputed locally.
test("one shared instant renders per-timezone the same on both peers", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Pin each peer to a distinct runtime timezone, then reload so the Feature
    // re-detects it on mount. We pin at the Intl layer (not the shared
    // `${prefix}:tz` localStorage key) precisely because the two peers share one
    // browser context — a localStorage write on one would clobber the other.
    await pinTimezone(a, "America/New_York");
    await pinTimezone(b, "Asia/Tokyo");
    await Promise.all([a.reload(), b.reload()]);

    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // Alice sets the shared "next New Year (UTC)" target — one absolute instant.
    await a.getByRole("button", { name: /next New Year/ }).click();
    await expect(a.locator(".ny-countdown")).toBeVisible();
    await expect(b.locator(".ny-countdown")).toBeVisible();

    // Each peer row carries its own timezone label; both must reach BOTH peers.
    const rowAliceOnB = b.locator(".ny-peers li", { hasText: "alice" });
    const rowBobOnB = b.locator(".ny-peers li", { hasText: "bob" });
    const rowAliceOnA = a.locator(".ny-peers li", { hasText: "alice" });
    const rowBobOnA = a.locator(".ny-peers li", { hasText: "bob" });

    await expect(rowAliceOnB.locator(".ny-peer-tz")).toHaveText("America/New_York");
    await expect(rowBobOnB.locator(".ny-peer-tz")).toHaveText("Asia/Tokyo");

    // The shared instant rendered in NY vs Tokyo must differ (timezones matter).
    const aliceLocalOnB = (await rowAliceOnB.locator(".ny-peer-local").innerText()).trim();
    const bobLocalOnB = (await rowBobOnB.locator(".ny-peer-local").innerText()).trim();
    expect(aliceLocalOnB).not.toBe("");
    expect(bobLocalOnB).not.toBe("");
    expect(aliceLocalOnB).not.toBe(bobLocalOnB);

    // …and crucially the SAME instant is shared: alice's NY rendering is
    // identical whether read on peer A or peer B; likewise bob's Tokyo one.
    // If each peer computed its own target instead of sharing one over the
    // mesh, these would diverge.
    const aliceLocalOnA = (await rowAliceOnA.locator(".ny-peer-local").innerText()).trim();
    const bobLocalOnA = (await rowBobOnA.locator(".ny-peer-local").innerText()).trim();
    expect(aliceLocalOnA).toBe(aliceLocalOnB);
    expect(bobLocalOnA).toBe(bobLocalOnB);
  } finally {
    await cleanup();
  }
});
