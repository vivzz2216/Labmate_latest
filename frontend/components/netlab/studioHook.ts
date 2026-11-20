"use client";

import { useEffect, useRef } from "react";

/**
 * The hook the capture service drives (backend/app/services/studio_capture.py):
 *   window.__labmate.ready    true once the page can accept state
 *   window.__labmate.load(s)  hand over everything the studio should draw
 *   window.__labmate.show(t)  display one step; `settled` is false until it has been drawn
 */
export interface StudioHook<State, Step> {
  load: (state: State) => void;
  show: (step: Step) => void;
}

declare global {
  interface Window {
    __labmatePractical?: (topic: string) => { id: string; title: string; explain: string }[];
    __labmate?: { ready: boolean; settled: boolean; load: (state: unknown) => void; show: (step: unknown) => void };
  }
}

export function useStudioHook<State, Step>(hook: StudioHook<State, Step>, drawnToken: unknown) {
  const latest = useRef(hook);
  latest.current = hook;
  useEffect(() => {
    window.__labmate = {
      ready: true,
      settled: true,
      load: (state) => {
        window.__labmate!.settled = false;
        latest.current.load(state as State);
      },
      show: (step) => {
        window.__labmate!.settled = false;
        latest.current.show(step as Step);
      },
    };
    return () => {
      delete window.__labmate;
    };
  }, []);
  // After every state change that came from the hook, wait two frames so the DOM has painted, then report settled.
  useEffect(() => {
    if (!window.__labmate || window.__labmate.settled) return;
    let first = 0;
    let second = 0;
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (window.__labmate) window.__labmate.settled = true;
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [drawnToken]);
}
