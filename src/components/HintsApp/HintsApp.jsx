import React, { useState, useMemo, useRef, useEffect } from "react";
import "./HintsApp.css";
// Import OS context for app management (open, close, minimize)
import { useOS } from "../../contexts/OSProvider";
// Import stats context to check player challenge completion progress
import { useStats } from "../../contexts/StatsProvider";
// Import translation hook for multi-language support
import { useTranslation } from "react-i18next";
// Import UI icons for the hints interface
import { FaTimes, FaMinus, FaLightbulb, FaChevronLeft, FaPlay } from "react-icons/fa";
// Import hints data in multiple languages (JSON format)
import hintsDataRaw from "./HintsData.json";
// Import utility function to resolve asset paths
import { assetPath } from "../../utils/assetPath";

/**
 * HintsApp Component - Escape Room Hints Application
 * 
 * Displays contextual hints and clues for the current puzzle based on player progress.
 * Features include:
 * - Dynamic hint display based on active challenge
 * - Multi-language support (English, Spanish)
 * - Intro video playback with language-specific content
 * - Context-based hint organization
 * 
 * @returns {JSX.Element} The hints app window or intro video overlay
 */
export const HintsApp = () => {
  // Get app management functions from OS context
  const { closeApp, minimizeApp } = useOS();
  // Get challenge completion status to determine current puzzle
  const {
    challenge1Completed,
    challenge2Completed,
    challenge3Completed,
  } = useStats();
  // Get translation function and current language from i18n
  const { t, i18n } = useTranslation();

  // State for tracking which hint context is currently selected (null = list view)
  const [selectedContext, setSelectedContext] = useState(null);
  // State for showing intro videos (null = no video, 1 = intro video 1, 2 = intro video 2)
  const [showIntroVideo, setShowIntroVideo] = useState(null); // null | 1 | 2
  const hintsVideoRef = useRef(null);
  // Show play button overlay by default so user triggers video playback
  const [needsTapToPlay, setNeedsTapToPlay] = useState(true);
  // Track if hints video is paused during playback
  const [isPaused, setIsPaused] = useState(false);

  // Ensure play button overlay is shown when hints video is active (no autoplay)
  useEffect(() => {
    if (showIntroVideo && hintsVideoRef.current) {
      setNeedsTapToPlay(true);
      setIsPaused(false);
      const v = hintsVideoRef.current;
      v.load();
    }
  }, [showIntroVideo]);

  // Manage body class for video fullscreen to handle stacking context / z-index
  useEffect(() => {
    const isVideoActive = showIntroVideo;
    if (isVideoActive) {
      document.body.classList.add("video-fullscreen-active");
    } else {
      document.body.classList.remove("video-fullscreen-active");
    }
    return () => {
      document.body.classList.remove("video-fullscreen-active");
    };
  }, [showIntroVideo]);

  // Click/tap handler to toggle play/pause on the hints video
  const handleHintsVideoClick = () => {
    if (needsTapToPlay) return;
    if (hintsVideoRef.current) {
      if (hintsVideoRef.current.paused) {
        hintsVideoRef.current.play().catch(() => { });
        setIsPaused(false);
      } else {
        hintsVideoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  /**
   * Determines the active puzzle ID based on player's challenge completion progress
   * Puzzle progression: 1 → 2 → 3 → 4 (completed all challenges)
   * Memoized to prevent recalculation on every render
   */
  const currentPuzzleId = useMemo(() => {
    if (!challenge1Completed) return "1";
    if (!challenge2Completed) return "2";
    if (!challenge3Completed) return "3";
    return "4";
  }, [challenge1Completed, challenge2Completed, challenge3Completed]);

  /**
   * Get current language code (first 2 characters) from i18n
   * Defaults to English if language not set
   */
  const lang = i18n.language?.slice(0, 2) || "en";
  /**
   * Get hints for the current language from JSON data
   * Falls back to English if current language not available
   */
  const langHints = hintsDataRaw[lang] ?? hintsDataRaw["en"] ?? {};
  /**
   * Get array of hints for the current puzzle
   * Empty array if puzzle has no hints
   */
  const currentHints = langHints[currentPuzzleId] ?? [];

  /**
   * Close the hints app
   */
  const handleClose = () => closeApp("hints");

  /**
   * Minimize the hints app
   */
  const handleMinimize = () => minimizeApp();

  /**
   * Construct the intro video source URL based on current language and video number
   * Returns null if no intro video is being shown
   */
  const introVideoSrc = showIntroVideo
    ? assetPath(`/assets/intro${showIntroVideo}_${lang}.mp4`)
    : null;

  /**
   * Show intro video overlay when showIntroVideo state is not null
   * Handles sequential video playback (intro1 → intro2)
   */
  if (showIntroVideo) {
    return (
      // Full-screen overlay for video display
      <div
        className="hints-intro-overlay"
        onClick={handleHintsVideoClick}
        style={{ cursor: "pointer" }}
      >
        {/* 
          Intro video player
          Plays automatically and supports inline playback on mobile
          Transitions between intro1 and intro2, then returns to app
        */}
        <video
          ref={hintsVideoRef}
          className="hints-intro-video"
          src={introVideoSrc}
          preload="auto"
          playsInline
          onLoadedData={(e) => { e.target.currentTime = 1.0; }}
          onEnded={() => {
            setIsPaused(false);
            if (showIntroVideo === 1) {
              setShowIntroVideo(2);
            } else {
              setShowIntroVideo(null);
            }
          }}
          onError={() => setShowIntroVideo(null)}
        />
        {(needsTapToPlay || isPaused) && (
          <button
            className="hints-tap-to-play"
            onClick={(e) => {
              e.stopPropagation();
              if (needsTapToPlay) {
                setNeedsTapToPlay(false);
                if (hintsVideoRef.current) {
                  hintsVideoRef.current.currentTime = 0;
                  hintsVideoRef.current.play().catch(() => { });
                }
              } else if (isPaused) {
                setIsPaused(false);
                if (hintsVideoRef.current) {
                  hintsVideoRef.current.play().catch(() => { });
                }
              }
            }}
          >
            ▶
          </button>
        )}
        <button
          className="hints-intro-skip"
          onClick={(e) => {
            e.stopPropagation();
            setShowIntroVideo(null);
          }}
        >
          {t("hintsApp.skipVideo", "Skip")} →
        </button>
      </div>
    );
  }

  return (
    // Backdrop container - click to close the app
    <div className="hints-app-backdrop" onClick={handleClose}>
      {/* Main app window - stop propagation to prevent closing when clicking inside */}
      <div className="hints-app-window" onClick={(e) => e.stopPropagation()}>
        {/* Title bar with app name and window controls */}
        <div className="hints-titlebar">
          {/* Window title with icon and app name */}
          <div className="hints-window-title">
            <FaLightbulb className="hints-title-icon" />
            <span>{t("hintsApp.title")}</span>
          </div>
          {/* Window control buttons (minimize, close) */}
          <div className="hints-window-controls">
            {/* Minimize button */}
            <button
              className="window-control minimize"
              onClick={handleMinimize}
              title={t("desktop.window.minimize")}
              aria-label={t("desktop.window.minimize")}
            >
              <FaMinus />
            </button>
            {/* Close button */}
            <button
              className="window-control close"
              onClick={handleClose}
              title={t("desktop.window.close")}
              aria-label={t("desktop.window.close")}
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Badge displaying current puzzle number and stage */}
        <div className="hints-puzzle-badge">
          {t(`hintsApp.puzzle.${currentPuzzleId}`)}
        </div>

        {/* Main content area with hints display */}
        <div className="hints-body">
          {/* 
          Conditional rendering based on app state:
          1. No hints available: Show empty state
          2. No context selected: Show list of contexts to choose from
          3. Context selected: Show detailed clue for selected context
        */}
          {currentHints.length === 0 ? (
            // Empty state - no hints available for current puzzle
            <div className="hints-empty">
              <FaLightbulb className="hints-empty-icon" />
              <p>{t("hintsApp.noHints")}</p>
            </div>
          ) : selectedContext === null ? (
            // Context list view - show all available hint contexts
            <>
              <p className="hints-prompt">{t("hintsApp.selectContext")}</p>
              {/* List of hint context buttons */}
              <ul className="hints-context-list">
                {currentHints.map((hint, idx) => (
                  <li key={idx}>
                    <button
                      className="hints-context-btn"
                      onClick={() => {
                        // Show the selected hint
                        setSelectedContext(idx);
                      }}
                    >
                      <FaLightbulb className="hints-context-icon" />
                      <span>{hint.context}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // Clue detail view - show the full clue for selected context
            <div className="hints-clue-view">
              {/* Back button to return to context list */}
              <button
                className="hints-back-btn"
                onClick={() => setSelectedContext(null)}
              >
                <FaChevronLeft />
                {t("hintsApp.back")}
              </button>
              {/* Display the context/category of the hint */}
              <div className="hints-clue-context">
                {currentHints[selectedContext].context}
              </div>
              {/* Display the actual clue text */}
              <div className="hints-clue-box">
                <FaLightbulb className="hints-clue-icon" />
                <p>{currentHints[selectedContext].clue}</p>
              </div>
            </div>
          )}

          {/* Rewatch intro video button */}
          <button
            className="hints-rewatch-btn"
            onClick={() => setShowIntroVideo(1)}
          >
            <FaPlay className="hints-rewatch-icon" />
            {t("hintsApp.rewatchIntro", "Rewatch intro video")}
          </button>
        </div>
      </div>
    </div>
  );
};
