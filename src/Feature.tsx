import { useEffect, useMemo, useState } from "react";
import { createClockSync, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Target = {
  /** Absolute mesh-time ms — the synchronized "midnight" instant. */
  utcMs: number;
  label: string;
};

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;
const TZ_KEY = (prefix: string) => `${prefix}:tz`;

function nextNewYearUtcMs(): number {
  const now = new Date();
  const year = now.getUTCFullYear() + (now.getUTCMonth() === 11 && now.getUTCDate() === 31 ? 1 : 1);
  return Date.UTC(year, 0, 1, 0, 0, 0);
}

function fmtCountdown(ms: number): string {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / 86_400_000);
  const hours = Math.floor((safe % 86_400_000) / 3_600_000);
  const mins = Math.floor((safe % 3_600_000) / 60_000);
  const secs = Math.floor((safe % 60_000) / 1000);
  return `${days}d ${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function Feature({ room, config }: Props) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [tz, setTz] = useState(
    () => localStorage.getItem(TZ_KEY(config.storagePrefix)) ?? detectTz(),
  );
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);
  useEffect(() => {
    localStorage.setItem(TZ_KEY(config.storagePrefix), tz);
  }, [tz, config.storagePrefix]);

  const clock = useMemo(() => (room ? createClockSync(room.provider) : null), [room]);
  useEffect(() => () => clock?.destroy(), [clock]);

  useEffect(() => {
    if (!room) return;
    const target = room.doc.getMap<Target>("target");
    const peers = room.doc.getMap<{ name: string; tz: string }>("peers");
    if (peers.has(room.peerId)) {
      peers.set(room.peerId, { name: name || `peer-${room.peerId.slice(0, 4)}`, tz });
    }
    const onChange = () => rerender((n) => n + 1);
    target.observe(onChange);
    peers.observe(onChange);
    return () => {
      target.unobserve(onChange);
      peers.unobserve(onChange);
    };
  }, [room, name, tz]);

  useEffect(() => {
    if (!room) return;
    const peers = room.doc.getMap<{ name: string; tz: string }>("peers");
    peers.set(room.peerId, { name: name || `peer-${room.peerId.slice(0, 4)}`, tz });
  }, [room, name, tz]);

  useEffect(() => {
    const t = setInterval(() => rerender((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  if (!room || !clock) {
    return (
      <div className="ny-screen">
        <h1>new year, together</h1>
        <p className="ny-status">Connecting…</p>
      </div>
    );
  }

  const target = room.doc.getMap<Target>("target").get("current");
  const now = clock.meshNow();
  const remaining = target ? target.utcMs - now : 0;

  const setTarget = () => {
    if (!draftDate) {
      // Default to next Jan 1 UTC
      room.doc.getMap<Target>("target").set("current", {
        utcMs: nextNewYearUtcMs(),
        label: draftLabel.trim() || "New Year",
      });
    } else {
      const ts = new Date(draftDate).getTime();
      if (Number.isFinite(ts)) {
        room.doc.getMap<Target>("target").set("current", {
          utcMs: ts,
          label: draftLabel.trim() || "Countdown",
        });
      }
    }
  };

  const clearTarget = () => room.doc.getMap<Target>("target").delete("current");

  const peers = room.doc.getMap<{ name: string; tz: string }>("peers");
  const peerList: Array<{ id: string; name: string; tz: string }> = [];
  peers.forEach((v, id) => peerList.push({ id, name: v.name, tz: v.tz }));

  return (
    <div className="ny-screen">
      <header className="ny-header">
        <h1>new year, together</h1>
        <input
          className="ny-name"
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
        />
        <p className="ny-status">
          your timezone: <strong>{tz}</strong> · {peerList.length} peer
          {peerList.length === 1 ? "" : "s"}
        </p>
      </header>

      {!target && (
        <form
          className="ny-pick"
          onSubmit={(e) => {
            e.preventDefault();
            setTarget();
          }}
        >
          <input
            type="datetime-local"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
          />
          <input
            placeholder="label (e.g. New Year 2027)"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            maxLength={48}
          />
          <button type="submit">set countdown</button>
          <button
            type="button"
            className="ny-default"
            onClick={() => {
              setDraftDate("");
              setDraftLabel("New Year");
              setTarget();
            }}
          >
            or just next New Year (UTC)
          </button>
        </form>
      )}

      {target && (
        <>
          <div className="ny-target-label">{target.label}</div>
          <div className="ny-countdown" data-zero={remaining <= 0 ? "1" : "0"}>
            {remaining > 0 ? fmtCountdown(remaining) : "🎉 IT'S TIME 🎉"}
          </div>

          <ul className="ny-peers">
            {peerList.map((p) => {
              const localStr = (() => {
                try {
                  return new Intl.DateTimeFormat([], {
                    timeZone: p.tz,
                    dateStyle: "short",
                    timeStyle: "long",
                  }).format(new Date(target.utcMs));
                } catch {
                  return "(invalid tz)";
                }
              })();
              return (
                <li key={p.id} className={p.id === room.peerId ? "is-me" : ""}>
                  <span>{p.name}</span>
                  <span className="ny-peer-tz">{p.tz}</span>
                  <span className="ny-peer-local">{localStr}</span>
                </li>
              );
            })}
          </ul>

          <button type="button" className="ny-clear" onClick={clearTarget}>
            clear countdown
          </button>
        </>
      )}
    </div>
  );
}
