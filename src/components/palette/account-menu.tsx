"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";

/**
 * A steady color per person, derived from their account id so it survives visits and devices. Hue plus
 * a little lightness and chroma variation gives a couple of thousand distinct colors. That makes clashes
 * unlikely, but it can't rule them out: only storing a color on the profile could.
 */
const colorFor = (id: string) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h >>>= 0;
  const hue = h % 360;
  const lightness = [0.5, 0.55, 0.6][Math.floor(h / 360) % 3];
  const chroma = [0.12, 0.16][Math.floor(h / 1080) % 2];
  return `oklch(${lightness} ${chroma} ${hue})`;
};

/** The signed-in person, as an avatar in the header. Hidden when signed out. Profile editing comes later. */
export function AccountMenu({ onSignedOut }: { onSignedOut: () => void }) {
  const enabled = cloudEnabled();
  const [session, setSession] = React.useState<Session | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    cloud.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = cloud.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  if (!enabled || !session) return null;
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
      <PopoverTrigger
        aria-label="Account"
        title={email}
        style={{ backgroundColor: colorFor(session.user.id) }}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-(--shadow-default) transition-[color,box-shadow] outline-none hover:shadow-(--shadow-large) focus-visible:ring-2 focus-visible:ring-ring"
      >
        {initial}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-2 p-3">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="truncate text-sm font-medium">{email}</p>
        <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
          <LogOut />
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
