// EscappProvider: boots the Escapp client (window.ESCAPP), authenticates the
// participant, and makes Escapp state available to the rest of ECHO.
//
// Escapp owns identity, the timer and the escape/puzzle state. This provider:
//  - instantiates the Escapp client and reads server/author settings,
//  - fixes the app locale from Escapp settings (appSettings.locale),
//  - starts the MirageJS simulated backend for that locale,
//  - validates the participant and only then renders the app tree,
//  - exposes the escapp client, its storage, solved-puzzle count, the final
//    outcome (success/fail, for the outro video) and a submitChallenge() helper.

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import i18n from "../i18n.jsx";
import { makeServer } from "../server.jsx";
import { ESCAPP_CLIENT_SETTINGS, ESCAPP_PUZZLES } from "../constants/escapp.js";

const SUPPORTED_LOCALES = ["en", "es", "sr", "fi"];

// Guards so the Escapp client and the Mirage server are created only once even
// under React 18 StrictMode double-mounting.
let _escappSingleton = null;
let _serverStarted = false;

const EscappContext = createContext(null);

export const useEscapp = () => {
  const ctx = useContext(EscappContext);
  if (!ctx) {
    throw new Error("useEscapp must be used within EscappProvider");
  }
  return ctx;
};

// Normalize an Escapp locale to a language ECHO ships translations/videos for.
const normalizeLocale = (locale) => {
  const base = (locale || "").split("-")[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : null;
};

// Resolve the app language, in priority order:
//   1. URL param (?locale=.. or ?lang=..) — same convention the Escapp client uses
//   2. Escapp app settings (appSettings.locale)
//   3. fallback "es"
const resolveLocale = (appSettings) => {
  let fromUrl = null;
  try {
    const params = new URLSearchParams(window.location.search);
    fromUrl = params.get("locale") || params.get("lang");
  } catch {
    /* ignore */
  }
  return normalizeLocale(fromUrl) || normalizeLocale(appSettings?.locale) || "es";
};

export const EscappProvider = ({ children }) => {
  const [escapp, setEscapp] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [storage, setStorage] = useState(null);
  const [ready, setReady] = useState(false);
  // Number of Escapp puzzles solved (drives challenge-progress restore).
  const [solvedCount, setSolvedCount] = useState(0);
  // "success" | "fail" | null — used only to pick/trigger the outro video.
  const [finalOutcome, setFinalOutcome] = useState(null);
  // Escape room start time — identifies the current run. Changes when the room is
  // (re)started, which we use to know when the intro/onboarding should replay.
  const [erStartTime, setErStartTime] = useState(null);

  const initRef = useRef(false);

  // Derive Escapp-owned state (solved count + final outcome) from the client.
  const syncFromEscapp = (client) => {
    try {
      const solved = client.getSolvedPuzzles?.() || [];
      setSolvedCount(solved.length);
      seedNavFlags(solved.length);
      if (client.getAllPuzzlesSolved?.()) {
        setFinalOutcome("success");
      }
    } catch (e) {
      console.warn("Escapp: syncFromEscapp failed", e);
    }
  };

  // Some gates are read straight from sessionStorage by components (not via React
  // state), so seed them from Escapp progress so a returning player isn't blocked at
  // an earlier step. Puzzle 2 (Challenge 1) solved => the player already passed the
  // mission briefing and social login.
  const seedNavFlags = (solved) => {
    try {
      if (solved >= 2) {
        sessionStorage.setItem("missionBriefRead", "true");
        sessionStorage.setItem("socialLoginDone", "true");
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (typeof window === "undefined" || typeof window.ESCAPP === "undefined") {
      console.error(
        "Escapp client (window.ESCAPP) not found. ECHO must be served by an Escapp escape room."
      );
      return;
    }

    // The Escapp client reads window.ESCAPP_APP_SETTINGS from its environment.
    // In production the Escapp server injects it into the page; in local dev the
    // Vite plugin injects it from config.mjs.
    // 1. Create the Escapp client (once).
    const client = _escappSingleton || new window.ESCAPP(ESCAPP_CLIENT_SETTINGS);
    _escappSingleton = client;
    setEscapp(client);
    setStorage(client.getStorage());

    // 2. Read author/server settings and fix the app locale from Escapp.
    const settings = client.getAppSettings() || {};
    setAppSettings(settings);
    const locale = resolveLocale(settings);
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }

    // 3. Start the simulated social-network backend for this locale (once).
    if (!_serverStarted) {
      makeServer({ language: locale });
      _serverStarted = true;
    }

    // 4. React to Escapp state changes (time, teammates solving puzzles, finish).
    client.registerCallback("onNewErStateCallback", (erState) => {
      try {
        syncFromEscapp(client);
        if (erState && typeof erState.startTime !== "undefined") {
          setErStartTime(erState.startTime ?? null);
        }
        // Escape room ran out of time without solving everything -> fail outro.
        if (
          erState &&
          typeof erState.remainingTime === "number" &&
          erState.remainingTime <= 0 &&
          !client.getAllPuzzlesSolved?.()
        ) {
          setFinalOutcome("fail");
        }
      } catch (e) {
        console.warn("Escapp: onNewErStateCallback failed", e);
      }
    });

    client.registerCallback("onErRestartCallback", () => {
      try {
        // The escape room was restarted/replayed: wipe ECHO's local game state so
        // the player starts completely fresh. All ECHO progress lives in
        // sessionStorage plus a couple of Escapp storage settings; the Escapp
        // client's own localStorage (auth/state) is left intact.
        const storage = client.getStorage();
        storage?.removeSetting?.("state");
        storage?.removeSetting?.("onboardingRun");
        try { sessionStorage.clear(); } catch { /* ignore */ }
        try { localStorage.removeItem("i18nextLng"); } catch { /* ignore */ }
        setSolvedCount(0);
        setFinalOutcome(null);
        // Reload to re-initialize every component from the now-empty state.
        window.location.reload();
      } catch (e) {
        console.warn("Escapp: onErRestartCallback failed", e);
      }
    });

    // 5. Validate the participant. Only render the app once validation succeeds.
    client.validate((success, erState) => {
      try {
        if (success) {
          if (erState && typeof erState.startTime !== "undefined") {
            setErStartTime(erState.startTime ?? null);
          }
          syncFromEscapp(client);
          setReady(true);
        }
      } catch (e) {
        console.warn("Escapp: validate callback failed", e);
      }
    });
  }, []);

  // Submit a puzzle answer to Escapp for server-side verification.
  //   puzzleId  - the Escapp puzzle id (1..5)
  //   solution  - the player's actual answer string; Escapp verifies it
  //   onResult(success, erState) - invoked with the server's verdict
  const lastPuzzleId = ESCAPP_PUZZLES[ESCAPP_PUZZLES.length - 1].id;
  const submitChallenge = (puzzleId, solution, onResult) => {
    if (!escapp || typeof solution !== "string") {
      onResult?.(false, null);
      return;
    }
    escapp.submitPuzzle(puzzleId, solution, {}, (success, erState) => {
      try {
        syncFromEscapp(escapp);
        if (success && puzzleId === lastPuzzleId) {
          setFinalOutcome("success");
        }
      } catch (e) {
        console.warn("Escapp: submitChallenge sync failed", e);
      }
      onResult?.(success, erState);
    });
  };

  const value = {
    escapp,
    appSettings,
    storage,
    ready,
    solvedCount,
    finalOutcome,
    erStartTime,
    submitChallenge,
  };

  // Render nothing until the participant is validated — Escapp shows its own
  // login/validation UI over the page during this phase.
  return (
    <EscappContext.Provider value={value}>
      {ready ? children : null}
    </EscappContext.Provider>
  );
};
