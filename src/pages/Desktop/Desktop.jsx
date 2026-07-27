import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Desktop.css";
import { MessagesApp } from "../../components/MessagesApp/MessagesApp";
import { SocialMediaApp } from "../../components/SocialMediaApp/SocialMediaApp";
import { HintsApp } from "../../components/HintsApp/HintsApp";
import { FilesApp } from "../../components/FilesApp/FilesApp";
import { PopupNotification } from "../../components/PopupNotification/PopupNotification";
import { BossNotification } from "../../components/BossNotification/BossNotification";
import { useOS } from "../../contexts/OSProvider";
import { useMessages } from "../../contexts/MessagesProvider";
import { useEscapp } from "../../contexts/EscappProvider";
import { useTranslation } from "react-i18next";
import { assetPath } from "../../utils/assetPath";

const SUCCESS_OUTRO_DELAY_MS = 6000;
const FAIL_OUTRO_DELAY_MS = 6000;
const OUTRO_COMPLETED_KEY = "echo:outroCompleted";

/**
 * Desktop: Main OS simulation desktop screen.
 * Simulated desktop with clock, apps, drawer and notifications. The escape-room
 * timer and completion screen are provided by Escapp; this component only keeps
 * the localized success/fail outro video, triggered by Escapp's final outcome.
 */
export const Desktop = () => {
  // OS management: track which app is open
  const { activeApp, openApp, minimizeApp } = useOS();
  // Messages: track unread message count for badge
  const { unreadCount } = useMessages();
  // Escapp final outcome: "success" | "fail" | null (drives the outro video)
  const { finalOutcome } = useEscapp();
  // Multi-language support
  const { t, i18n } = useTranslation();
  // Check if mission brief read (blocks social app access)
  const missionBriefRead = sessionStorage.getItem("missionBriefRead") === "true";

  // Popup state: info popup when trying to access locked app
  const [popup, setPopup] = useState({
    visible: false,
    message: "",
    position: { top: 0, left: 0 },
  });
  // Map i18n language codes to Intl locale strings
  const locale = useMemo(() => {
    const localeMap = {
      es: "es-ES",
      en: "en-US",
      fi: "fi-FI",
      sr: "sr-RS",
    };
    return localeMap[i18n.language] || undefined;
  }, [i18n.language]);
  // Drawer closed position offset
  const closedTranslate = 90;
  // Drawer state: track open/closed and translate value
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTranslate, setDrawerTranslate] = useState(0);
  // Current time for clock display (updates every second)
  const [now, setNow] = useState(() => new Date());
  // Boss notification visibility
  const [bossNotifVisible, setBossNotifVisible] = useState(false);
  // Track if outro video already played
  const [outroCompleted, setOutroCompleted] = useState(() => {
    return sessionStorage.getItem(OUTRO_COMPLETED_KEY) === "true";
  });
  // Show outro video overlay
  const [showOutroVideo, setShowOutroVideo] = useState(false);
  // Show play button overlay by default so user triggers video playback
  const [needsTapToPlay, setNeedsTapToPlay] = useState(true);
  // Track if outro video is paused during playback
  const [isPaused, setIsPaused] = useState(false);
  // Selected language for outro video (localized version)
  const [outroLanguage, setOutroLanguage] = useState(() => {
    const baseLanguage = i18n.resolvedLanguage || i18n.language || "es";
    return ["es", "en", "fi", "sr"].includes(baseLanguage) ? baseLanguage : "es";
  });
  // Timeout for delayed outro video display
  const outroTimeoutRef = useRef(null);
  // Reference to video element for auto-play control
  const outroVideoRef = useRef(null);
  // Timeout for async video playback to prevent seek/play race condition
  const playTimeoutRef = useRef(null);
  // Handler: dismiss boss notification
  const handleBossNotifDismiss = useCallback(() => setBossNotifVisible(false), []);
  // Normalize i18n language to supported outro video languages
  const normalizedLanguage = useMemo(() => {
    const baseLanguage = i18n.resolvedLanguage || i18n.language || "es";
    return ["es", "en", "fi", "sr"].includes(baseLanguage) ? baseLanguage : "es";
  }, [i18n.language, i18n.resolvedLanguage]);
  // Determine outro video src based on Escapp outcome (success/fail) and language
  const outroVideoSrc = useMemo(() => {
    if (!finalOutcome) return null;
    const suffix = finalOutcome === "success" ? "success" : "fail";
    return assetPath(`/assets/outro_${suffix}_${outroLanguage}.mp4`);
  }, [finalOutcome, outroLanguage]);

  // Handler: outro video finished - hand back to Escapp's own completion screen
  const handleOutroFinished = useCallback(() => {
    if (outroTimeoutRef.current) {
      clearTimeout(outroTimeoutRef.current);
      outroTimeoutRef.current = null;
    }
    sessionStorage.setItem(OUTRO_COMPLETED_KEY, "true");
    setShowOutroVideo(false);
    setOutroCompleted(true);
  }, []);

  // Handler: outro video playback error - fallback to handleOutroFinished
  const handleOutroVideoError = useCallback(() => {
    handleOutroFinished();
  }, [handleOutroFinished]);

  // Helper: sync drawer open/closed state with translate value
  const syncDrawer = (open) => {
    setDrawerOpen(open);
    setDrawerTranslate(open ? 0 : closedTranslate);
  };

  // Handler: open messages app
  const handleOpenMessages = () => {
    openApp("messages");
    syncDrawer(false);
  };

  // Handler: open social media app (check mission brief lock first)
  const handleOpenSocial = (e) => {
    if (!missionBriefRead) {
      // Mission brief not read - show locked popup above button
      const rect = e.currentTarget.getBoundingClientRect();
      const popupWidth = 280;
      setPopup({
        visible: true,
        message: t("desktop.popup.readMessage"),
        position: {
          top: rect.top - 70,
          left: rect.left + rect.width / 2 - popupWidth / 2,
        },
      });
      return;
    }
    // Mission brief read - unlock social app
    openApp("social");
    syncDrawer(false);
  };

  // Handler: open hints app
  const handleOpenTips = () => {
    openApp("hints");
    syncDrawer(false);
  };

  // Handler: open files app
  const handleOpenFiles = () => {
    openApp("files");
    syncDrawer(false);
  };

  // Handler: close info popup
  const handleClosePopup = () => {
    setPopup({ ...popup, visible: false });
  };

  // Effect: set up global event listeners for drawer and boss notifications
  useEffect(() => {
    const handleCloseDrawer = () => syncDrawer(false);
    const handleOpenDrawer = () => syncDrawer(true);
    const handleBossMessage = () => setBossNotifVisible(true);
    // Listen for custom events from other components
    window.addEventListener("closeDrawer", handleCloseDrawer);
    window.addEventListener("openDrawer", handleOpenDrawer);
    window.addEventListener("bossMessage", handleBossMessage);
    return () => {
      window.removeEventListener("closeDrawer", handleCloseDrawer);
      window.removeEventListener("openDrawer", handleOpenDrawer);
      window.removeEventListener("bossMessage", handleBossMessage);
    };
  }, []);

  // Effect: update clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Effect: show outro video after a short delay once Escapp reports the outcome
  useEffect(() => {
    if (!finalOutcome || outroCompleted) return;

    setOutroLanguage(normalizedLanguage);
    const targetDelay = finalOutcome === "success" ? SUCCESS_OUTRO_DELAY_MS : FAIL_OUTRO_DELAY_MS;

    outroTimeoutRef.current = setTimeout(() => {
      setShowOutroVideo(true);
    }, targetDelay);

    return () => {
      if (outroTimeoutRef.current) {
        clearTimeout(outroTimeoutRef.current);
        outroTimeoutRef.current = null;
      }
    };
  }, [finalOutcome, normalizedLanguage, outroCompleted]);

  // Secret sequence listener: type "skip" to skip outro video when playing
  const skipSequenceRef = useRef("");
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showOutroVideo) {
        if (e.key && e.key.length === 1) {
          const nextSeq = (skipSequenceRef.current + e.key.toLowerCase()).slice(-4);
          skipSequenceRef.current = nextSeq;
          if (nextSeq === "skip") {
            handleOutroFinished();
          }
        }
      } else {
        skipSequenceRef.current = "";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showOutroVideo, handleOutroFinished]);

  // Try to autoplay the outro video when it's displayed; fall back to the manual
  // play button if the browser blocks autoplay.
  useEffect(() => {
    if (!showOutroVideo || !outroVideoRef.current) return;
    const v = outroVideoRef.current;
    setIsPaused(false);
    v.load();
    const playPromise = v.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.then(() => setNeedsTapToPlay(false)).catch(() => setNeedsTapToPlay(true));
    } else {
      setNeedsTapToPlay(false);
    }
  }, [showOutroVideo, outroVideoSrc]);

  // Manage body class for video fullscreen to handle stacking context / z-index on mobile
  useEffect(() => {
    if (showOutroVideo) {
      document.body.classList.add("video-fullscreen-active");
    } else {
      document.body.classList.remove("video-fullscreen-active");
    }
    return () => {
      document.body.classList.remove("video-fullscreen-active");
    };
  }, [showOutroVideo]);

  // Cleanup play timeout on unmount
  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
  }, []);

  // Click/tap handler to toggle play/pause on the video
  const handleOutroVideoClick = () => {
    if (needsTapToPlay) return;
    if (outroVideoRef.current) {
      if (outroVideoRef.current.paused) {
        outroVideoRef.current.play().catch(() => { });
        setIsPaused(false);
      } else {
        outroVideoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // Memoized: format current date for clock display
  const formattedDate = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Memoized: format current time for clock display
  const formattedTime = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="desktop-container">
      {/* Desktop shell: background with clock */}
      <div className="desktop-shell">
        <div className="desktop-glow" />
        {/* Digital clock display: shows current date and time */}
        <div className="desktop-clock">
          <span className="desktop-clock-time">{formattedTime}</span>
          <span className="desktop-clock-date">{formattedDate}</span>
        </div>
      </div>

      {/* Messages app overlay: click background to minimize */}
      {activeApp === "messages" && (
        <div className="app-overlay" onClick={minimizeApp}>
          <div
            className="app-overlay-content"
            onClick={(event) => event.stopPropagation()}
          >
            <MessagesApp />
          </div>
        </div>
      )}

      {/* Social media app overlay: challenges and community notes */}
      {activeApp === "social" && (
        <div className="app-overlay" onClick={minimizeApp}>
          <div
            className="app-overlay-content"
            onClick={(event) => event.stopPropagation()}
          >
            <SocialMediaApp />
          </div>
        </div>
      )}

      {/* Hints app overlay: tips and hints for challenges */}
      {activeApp === "hints" && (
        <div className="app-overlay" onClick={minimizeApp}>
          <div
            className="app-overlay-content"
            onClick={(event) => event.stopPropagation()}
          >
            <HintsApp />
          </div>
        </div>
      )}

      {/* Files app overlay: document viewer */}
      {activeApp === "files" && (
        <div className="app-overlay" onClick={minimizeApp}>
          <div
            className="app-overlay-content"
            onClick={(event) => event.stopPropagation()}
          >
            <FilesApp />
          </div>
        </div>
      )}

      {/* App launcher drawer: shows 4 main app icons at bottom */}
      <div className={`app-drawer open ${unreadCount > 0 ? "has-unread" : ""}`}>
        {/* Drawer content: app launcher buttons */}
        <div className="app-drawer-content">
          {/* Messages app launcher: shows unread badge */}
          <button
            className="app-launcher-card"
            onClick={handleOpenMessages}
            title={t("desktop.apps.messages")}
          >
            <img
              className="launcher-image launcher-image--messages"
              src={assetPath("/assets/messages-icon.png")}
              alt={t("desktop.apps.messages")}
            />
            <span className="launcher-label">
              {t("desktop.apps.messages")}
            </span>
            {unreadCount > 0 && (
              <span className="launcher-badge">{unreadCount}</span>
            )}
          </button>
          {/* Social media app launcher: locked until mission brief read */}
          <button
            className={`app-launcher-card ${!missionBriefRead ? "is-locked" : ""}`}
            onClick={handleOpenSocial}
            title={t("desktop.apps.social")}
          >
            <img
              className="launcher-image launcher-image--echo"
              src={assetPath("/assets/echo-logo-short.png")}
              alt={t("desktop.apps.social")}
            />
            <span className="launcher-label">
              {t("desktop.apps.social")}
            </span>
          </button>
          {/* Files app launcher: document explorer */}
          <button
            className="app-launcher-card"
            type="button"
            onClick={handleOpenFiles}
            title={t("desktop.apps.files")}
          >
            <img
              className="launcher-image launcher-image--files"
              src={assetPath("/assets/folder.png")}
              alt={t("desktop.apps.files")}
            />
            <span className="launcher-label">{t("desktop.apps.files")}</span>
          </button>
          {/* Hints app launcher: tips panel */}
          <button
            className="app-launcher-card"
            onClick={handleOpenTips}
            title={t("desktop.apps.hints")}
          >
            <img
              className="launcher-image"
              src={assetPath("/assets/tips-icon.png")}
              alt={t("desktop.apps.hints")}
            />
            <span className="launcher-label">{t("desktop.apps.hints")}</span>
          </button>
        </div>
      </div>

      {/* Info popup: shows when app is locked */}
      {popup.visible && (
        <PopupNotification
          message={popup.message}
          position={popup.position}
          onClose={handleClosePopup}
        />
      )}

      {/* Boss notification: appears when new boss message arrives */}
      <BossNotification
        visible={bossNotifVisible}
        onDismiss={handleBossNotifDismiss}
      />

      {/* Outro video overlay: plays success/fail video at escape room completion */}
      {showOutroVideo && outroVideoSrc && (
        <div
          className="outro-video-overlay"
          onClick={handleOutroVideoClick}
          style={{ cursor: "pointer" }}
        >
          <div className="phone-rotate-prompt">
            <div className="phone-icon-wrapper">
              <div className="phone-body-icon"></div>
            </div>
            <span className="phone-rotate-text">{t("desktop.rotatePhoneMessage", "Rotate your phone")}</span>
          </div>
          <video
            ref={outroVideoRef}
            className="outro-video-player"
            src={outroVideoSrc}
            preload="auto"
            playsInline
            webkit-playsinline="true"
            onLoadedData={(e) => { if (e.target.paused) e.target.currentTime = 2.0; }}
            onEnded={handleOutroFinished}
            onError={handleOutroVideoError}
            onContextMenu={(event) => event.preventDefault()}
          />
          {(needsTapToPlay || isPaused) && (
            <button
              className="outro-tap-to-play"
              onClick={(e) => {
                e.stopPropagation();
                if (needsTapToPlay) {
                  setNeedsTapToPlay(false);
                  if (outroVideoRef.current) {
                    outroVideoRef.current.currentTime = 0;
                    const isMobile = window.innerWidth <= 768;
                    const delay = isMobile ? 1500 : 0;
                    if (playTimeoutRef.current) {
                      clearTimeout(playTimeoutRef.current);
                    }
                    playTimeoutRef.current = setTimeout(() => {
                      if (outroVideoRef.current) {
                        outroVideoRef.current.play().catch(() => { });
                      }
                      playTimeoutRef.current = null;
                    }, delay);
                  }
                } else if (isPaused) {
                  setIsPaused(false);
                  if (outroVideoRef.current) {
                    outroVideoRef.current.play().catch(() => { });
                  }
                }
              }}
            >
              ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
};
