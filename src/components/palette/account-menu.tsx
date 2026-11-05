"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleVariants } from "@/components/ui/toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Hint } from "./hint";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import {
  type Accent,
  type Color,
  accentColor,
  accentL,
  accentContrast,
  accentOn,
  colorCss,
  parseAccent,
  sameColor,
  getAccent,
  setAccent,
  useAccent,
} from "@/lib/accent";

const MAX_C = 0.3;
const COLS = 13;
const COLOR_ROWS = 7;
const ROWS = COLOR_ROWS + 2; // a white row on top, the color rows, then a black row
const STEP = 1 / (ROWS - 1);
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

type Point = { x: number; y: number };
type Handle = { id: "bg" | "fg"; label: string; point: Point; color: string };

const toPoint = (c: Color): Point => ({
  x: c.h / 360,
  y:
    c.k === "white"
      ? 0
      : c.k === "black"
        ? 1
        : STEP * (1 + (1 - c.c / MAX_C) * (COLOR_ROWS - 1)),
});
const fromPoint = (p: Point): Color => {
  const h = Math.round(p.x * 360);
  if (p.y < STEP / 2) return { h, c: 0, k: "white" };
  if (p.y > 1 - STEP / 2) return { h, c: 0, k: "black" };
  const t = (p.y / STEP - 1) / (COLOR_ROWS - 1);
  return { h, c: +(clamp(1 - t, 0, 1) * MAX_C).toFixed(3) };
};

/**
 * An Arc-style field of dots, hue across and vividness down, with up to two draggable dots: one for the
 * background and one for the foreground. Press anywhere to move the nearest dot, or focus a dot and use the
 * arrow keys.
 */
function ColorPad({
  handles,
  onMove,
  onCommit,
}: {
  handles: Handle[];
  onMove: (id: Handle["id"], p: Point) => void;
  onCommit: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const active = React.useRef<Handle["id"] | null>(null);

  const point = (e: React.PointerEvent): Point => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left - 12) / (r.width - 24), 0, 1),
      y: clamp((e.clientY - r.top - 12) / (r.height - 24), 0, 1),
    };
  };

  const nearest = (p: Point): Handle["id"] => {
    let best: Handle["id"] = "bg";
    let dist = Infinity;
    for (const h of handles) {
      const d = (h.point.x - p.x) ** 2 + (h.point.y - p.y) ** 2;
      if (d < dist) {
        dist = d;
        best = h.id;
      }
    }
    return best;
  };

  const onKey = (h: Handle) => (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? 3 : 1;
    const d: Record<string, Point> = {
      ArrowLeft: { x: (h.point.x - 0.025 * big + 1) % 1, y: h.point.y },
      ArrowRight: { x: (h.point.x + 0.025 * big) % 1, y: h.point.y },
      ArrowUp: { x: h.point.x, y: clamp(h.point.y - 1 / (ROWS - 1), 0, 1) },
      ArrowDown: { x: h.point.x, y: clamp(h.point.y + 1 / (ROWS - 1), 0, 1) },
    };
    const next = d[e.key];
    if (!next) return;
    e.preventDefault();
    onMove(h.id, next);
    onCommit();
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = point(e);
        active.current = handles.length ? nearest(p) : "bg";
        onMove(active.current, p);
      }}
      onPointerMove={(e) =>
        active.current && e.buttons && onMove(active.current, point(e))
      }
      onPointerUp={() => {
        if (active.current) onCommit();
        active.current = null;
      }}
      className="relative h-32 cursor-crosshair touch-none rounded-xl bg-muted p-3 select-none"
    >
      <div
        className="grid h-full w-full place-items-center"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const h = ((i % COLS) / (COLS - 1)) * 360;
          const row = Math.floor(i / COLS);
          const color: Color =
            row === 0
              ? { h, c: 0, k: "white" }
              : row === ROWS - 1
                ? { h, c: 0, k: "black" }
                : { h, c: (1 - (row - 1) / (COLOR_ROWS - 1)) * MAX_C };
          return (
            <span
              key={i}
              className={
                "size-1.5 rounded-full" +
                (color.k === "white" ? " ring-1 ring-border" : "")
              }
              style={{ backgroundColor: colorCss(color) }}
            />
          );
        })}
      </div>
      {handles.map((h) => (
        <span
          key={h.id}
          role="slider"
          tabIndex={0}
          aria-label={`${h.label}. Arrow keys change hue and vividness.`}
          aria-valuetext={`hue ${Math.round(h.point.x * 360)}`}
          aria-valuenow={Math.round(h.point.x * 360)}
          onKeyDown={onKey(h)}
          className={
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-(--shadow-large) outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (h.id === "bg" ? "size-6" : "size-4")
          }
          style={{
            left: `calc(0.75rem + (100% - 1.5rem) * ${h.point.x})`,
            top: `calc(0.75rem + (100% - 1.5rem) * ${h.point.y})`,
            backgroundColor: h.color,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A steady color per person, derived from their account id so it survives visits and devices. Hue plus
 * a little lightness and chroma variation gives a couple of thousand distinct colors. That makes clashes
 * unlikely, but it can't rule them out: only storing a color on the profile could.
 */
const colorFor = (id: string) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h >>>= 0;
  const hue = h % 360;
  const chroma = [0.14, 0.18][Math.floor(h / 1080) % 2];
  return `oklch(${accentL(hue)} ${chroma} ${hue})`;
};

/** The signed-in person, as an avatar in the header. Hidden when signed out. Profile editing comes later. */
export function AccountMenu({ onSignedOut }: { onSignedOut: () => void }) {
  const enabled = cloudEnabled();
  const [session, setSession] = React.useState<Session | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const accent = useAccent();

  React.useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    cloud.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const saved = parseAccent(data.session?.user.user_metadata?.accent);
      if (saved) setAccent(saved);
    });
    const { data } = cloud.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  if (!enabled || !session) return null;
  // Supabase reports most failures as a returned error rather than a throw, so handle both. A fixed toast id
  // keeps a drag of failing saves from stacking up.
  const saveAccent = async (next: Accent | null) => {
    const cloud = getCloud();
    if (!cloud) return;
    try {
      const { error } = await cloud.auth.updateUser({ data: { accent: next } });
      if (error) throw error;
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Couldn't save your theme color: ${e.message}`
          : "Couldn't save your theme color.",
        { id: "accent-save" },
      );
    }
  };
  const email = session.user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  const signOut = async () => {
    setBusy(true);
    try {
      await getCloud()?.auth.signOut();
      onSignedOut();
      setOpen(false);
      toast.success("Signed out. Your palettes are still in your account.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign out.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label={email}>
        <PopoverTrigger
          aria-label="Account"
          className={toggleVariants({ variant: "outline", size: "sm", className: "size-7 min-w-0 rounded-full! p-0" })}
        >
          <span
            style={{
              backgroundColor: accent
                ? accentColor(accent)
                : colorFor(session.user.id),
              color: accent ? accentOn(accent) : undefined,
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          >
            {initial}
          </span>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-72 gap-2 p-3">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="truncate text-sm font-medium">{email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Theme color: drag the large dot for the background and the small one
          for text and icons.
        </p>
        <ColorPad
          handles={
            accent
              ? [
                  {
                    id: "bg",
                    label: "Background color",
                    point: toPoint(accent),
                    color: accentColor(accent),
                  },
                  {
                    id: "fg",
                    label: "Foreground color",
                    point: toPoint(
                      accent.fg ?? {
                        h: accent.h,
                        c: 0,
                        k: accentOn(accent) === "white" ? "white" : "black",
                      },
                    ),
                    color: accentOn(accent),
                  },
                ]
              : []
          }
          onMove={(id, p) => {
            const next: Accent =
              id === "bg"
                ? { ...fromPoint(p), ...(accent?.fg && { fg: accent.fg }) }
                : { ...(accent ?? { h: 0, c: 0 }), fg: fromPoint(p) };
            // Background and foreground are never allowed to be the same color.
            if (next.fg && sameColor(next, next.fg)) return;
            setAccent(next);
          }}
          onCommit={() => void saveAccent(getAccent())}
        />
        {accent?.fg && accentContrast(accent) < 4.5 && (
          <p className="text-xs text-destructive">
            Low contrast ({accentContrast(accent).toFixed(1)}:1). Text may be
            hard to read.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={!accent}
            onClick={() => {
              setAccent(null);
              void saveAccent(null);
            }}
          >
            Use default
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
          <LogOut />
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
