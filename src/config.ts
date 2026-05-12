import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-new-year",
  description: "Synced new-year countdown across timezones — everyone hits local 00:00 together",
  accentHex: "#ff5e7a",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
