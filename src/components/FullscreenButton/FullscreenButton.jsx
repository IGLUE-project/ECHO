import React, { useEffect, useState } from "react";
import { FaExpand, FaCompress } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import "./FullscreenButton.css";

// Cross-browser helpers (Safari/older browsers use webkit-prefixed APIs).
const getFullscreenElement = () =>
  document.fullscreenElement || document.webkitFullscreenElement || null;

const requestFullscreen = (el) => {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fn) fn.call(el);
};

const exitFullscreen = () => {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (fn) fn.call(document);
};

/**
 * FullscreenButton: fixed corner button to toggle the browser's full-screen mode.
 */
export const FullscreenButton = () => {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(getFullscreenElement()));

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(getFullscreenElement()));
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      if (getFullscreenElement()) {
        exitFullscreen();
      } else {
        requestFullscreen(document.documentElement);
      }
    } catch {
      /* fullscreen may be blocked (e.g. embedded without allowfullscreen) */
    }
  };

  const label = isFullscreen
    ? t("fullscreen.exit", "Exit full screen")
    : t("fullscreen.enter", "Full screen");

  return (
    <button
      className="fullscreen-btn"
      type="button"
      onClick={toggleFullscreen}
      title={label}
      aria-label={label}
    >
      {isFullscreen ? <FaCompress /> : <FaExpand />}
    </button>
  );
};
