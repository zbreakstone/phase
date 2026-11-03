"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { getCloud } from "./client";

/**
 * The signed-in session, and whether we've heard back yet. `ready` is true right away when cloud
 * saving is off, with no session, so callers can treat "off" and "signed out" the same.
 */
export function useSession(): { session: Session | null; ready: boolean } {
  const [state, setState] = React.useState<{ session: Session | null; ready: boolean }>({ session: null, ready: false });

  React.useEffect(() => {
    const cloud = getCloud();
    let canceled = false;
    if (!cloud) {
      Promise.resolve().then(() => {
        if (!canceled) setState({ session: null, ready: true });
      });
      return () => {
        canceled = true;
      };
    }
    cloud.auth.getSession().then(({ data }) => {
      if (!canceled) setState({ session: data.session, ready: true });
    });
    const { data } = cloud.auth.onAuthStateChange((_event, next) => setState({ session: next, ready: true }));
    return () => {
      canceled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
