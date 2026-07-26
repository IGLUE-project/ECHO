import "./Navbar.css";
import React from "react";
// Import router navigation link component
import { NavLink } from "react-router-dom";
import { useState } from "react";
// Import stats context for challenge progress tracking
import { useStats } from "../../contexts/StatsProvider.jsx";
import { useTranslation } from 'react-i18next';
import { PopupNotification } from "../PopupNotification/PopupNotification";
// Import UI icons for navbar buttons
import {
  RiHomeWifiLine,
  CgProfile,
} from "../../utils/icons.jsx";
// Import admin and robot icons
import { MdAdminPanelSettings } from "react-icons/md";
import { RiRobotLine, RiErrorWarningLine } from "react-icons/ri";
// Import new post launcher component
import { NewPostLauncher } from "../../pages/NewPost/NewPostLauncher.jsx";

/**
 * Navbar Component
 * 
 * Renders the main navigation bar with links to different game challenges.
 * Features include:
 * - Challenge progress tracking with badges
 * - Challenge locking system (must complete previous challenges to unlock)
 * - Dynamic popup notifications for blocked/locked challenges
 * - Read instructions requirements before accessing challenges
 * - New post launcher integration
 * 
 * @param {boolean} blocked - Whether the navbar is blocked/disabled (default: false)
 * 
 * @returns {JSX.Element} The navigation bar component
 */
export const Navbar = ({ blocked = false }) => {
  // Get translation function for localized strings
  const { t } = useTranslation();
  // Get challenge completion and progress data from stats context
  const {
    challenge1Completed, challenge2Completed, challenge3Completed,
    challenge1InstructionsRead, challenge2InstructionsRead, challenge3InstructionsRead,
    suspectUsersCount, challenge1Progress,
    challenge2Total, challenge2Progress,
    challenge3Total, challenge3Progress
  } = useStats();

  // State for controlling popup notification visibility and content
  const [popup, setPopup] = useState({
    visible: false,
    message: "",
    position: { top: 0, left: 0 },
  });


  /**
   * Get dynamic style for navigation links based on active state
   * 
   * @param {Object} obj - React Router NavLink active state object
   * @param {boolean} obj.isActive - Whether the link is currently active
   * 
   * @returns {Object} Style object with color and cursor properties
   */
  const getActiveStyle = ({ isActive }) => ({
    color: blocked ? "rgba(255,255,255,0.3)" : isActive ? "rgb(29, 155, 240)" : "white",
    pointerEvents: blocked ? "none" : undefined,
    cursor: blocked ? "not-allowed" : undefined,
  });

  /**
   * Get style for disabled navigation links
   * 
   * @returns {Object} Style object with dimmed color and not-allowed cursor
   */
  const getDisabledStyle = () => ({
    color: "rgba(255, 255, 255, 0.3)",
    cursor: "not-allowed",
  });

  /**
   * Show popup notification when user tries to access blocked challenge
   * Calculates popup position relative to the clicked element
   * 
   * @param {Event} e - Click event
   * @param {string} messageKey - Translation key for popup message
   */
  const handleShowBlockedPopup = (e, messageKey = "desktop.popup.playChallenge") => {
    let target = e.currentTarget;
    if (!target.classList?.contains("disabled")) {
      target = target.closest(".disabled") || target.closest("li");
    }

    // Get position of the target element
    const rect = target?.getBoundingClientRect();
    if (!rect) return;

    const popupWidth = 280;
    // Update popup state with message and position
    setPopup({
      visible: true,
      message: t(messageKey),
      position: {
        top: Math.max(50, rect.top - 60),
        left: Math.max(10, rect.left + rect.width / 2 - popupWidth / 2),
      },
    });
  };

  /**
   * Close the popup notification
   */
  const handleClosePopup = () => {
    setPopup({ ...popup, visible: false });
  };

  /**
   * Determine if Challenge 1 is locked (instructions sent but not read)
   */
  const challenge1InstructionsSent = sessionStorage.getItem("challenge1InstructionsSent") === "true";
  const isChallenge1Locked = challenge1InstructionsSent && !challenge1InstructionsRead;

  /**
   * Calculate pending tasks for each challenge
   * Shows how many items the player still needs to complete in each puzzle
   */
  const pendingChallenge1 = challenge1Completed ? 0 : Math.max(0, suspectUsersCount - challenge1Progress);
  const pendingChallenge2 = challenge2Completed ? 0 : Math.max(0, challenge2Total - challenge2Progress);
  const pendingChallenge3 = challenge3Completed ? 0 : Math.max(0, challenge3Total - challenge3Progress);

  return (
    // Main navbar container - applies blocked style if navbar is disabled
    <nav className={blocked ? "navbar navbar--blocked" : "navbar"} style={blocked ? { cursor: "not-allowed" } : {}}>
      {/* Navigation links list */}
      <ul>
        {/* Home link - always accessible */}
        <li>
          <NavLink className="navlink" style={getActiveStyle} to="/">
            {<RiHomeWifiLine className="navlink-icon" />}
            <p>{t('nav.home')}</p>
          </NavLink>
        </li>
        {/* Profile link - shows ECHO's profile, always accessible */}
        <li>
          <NavLink
            className="navlink"
            style={getActiveStyle}
            to="/profile/ECHO"
          >
            <CgProfile className="navlink-icon" />
            <p>{t('nav.profile')}</p>
          </NavLink>
        </li>
        {/* Challenge 1 - Bot Detection Challenge (Admin) */}
        <li>
          {!isChallenge1Locked ? (
            // If Challenge 1 is not locked, show accessible NavLink
            <NavLink
              className="navlink"
              style={getActiveStyle}
              to="/admin"
            >
              <MdAdminPanelSettings className="navlink-icon" />
              <p className="navlink-label">
                <span className="navlink-label-text">{t('nav.admin')}</span>
                {/* Show badge with pending items count if any */}
                {pendingChallenge1 > 0 && <span className="nav-badge">{pendingChallenge1}</span>}
              </p>
            </NavLink>
          ) : (
            // If Challenge 1 is locked (instructions not read), show disabled div with popup trigger
            <div
              className="navlink disabled"
              style={getDisabledStyle()}
              onClick={(e) => handleShowBlockedPopup(e, "desktop.popup.readMessage")}
              role="button"
            >
              <MdAdminPanelSettings className="navlink-icon" />
              <p className="navlink-label">
                <span className="navlink-label-text">{t('nav.admin')}</span>
                {pendingChallenge1 > 0 && <span className="nav-badge">{pendingChallenge1}</span>}
              </p>
            </div>
          )}
        </li>
        {/* Challenge 2 - AI Content Detection */}
        <li>
          {challenge2InstructionsRead ? (
            // If Challenge 2 instructions are read, show accessible NavLink
            <NavLink 
              className="navlink"
              style={getActiveStyle}
              to="/ai-content"
            >
              <RiRobotLine className="navlink-icon" />
              <p className="navlink-label">
                <span className="navlink-label-text">{t('nav.aiContent')}</span>
                {/* Show badge with pending items count if any */}
                {pendingChallenge2 > 0 && <span className="nav-badge">{pendingChallenge2}</span>}
              </p>
            </NavLink>
          ) : (
            // If Challenge 2 is locked, show disabled div with context-aware message
            <div
              className="navlink disabled"
              style={getDisabledStyle()}
              // Show different message depending on whether Challenge 1 is completed
              onClick={(e) => handleShowBlockedPopup(e, challenge1Completed ? "desktop.popup.readMessageChallenge2" : "desktop.popup.completeChallenge1")}
              role="button"
            >
              <RiRobotLine className="navlink-icon" />
              <p className="navlink-label">
                <span className="navlink-label-text">{t('nav.aiContent')}</span>
                {pendingChallenge2 > 0 && <span className="nav-badge">{pendingChallenge2}</span>}
              </p>
            </div>
          )}
        </li>
        {/* Challenge 3 - AI Incorrect Uses Detection */}
        <li>
          {challenge3InstructionsRead ? (
            // If Challenge 3 instructions are read, show accessible NavLink
            <NavLink 
              className="navlink"
              style={getActiveStyle}
              to="/ai-incorrect-uses"
            >
              <RiErrorWarningLine className="navlink-icon" />
              <p className="navlink-label">
                <span className="navlink-label-text">{t('nav.aiIncorrectUses')}</span>
                {/* Show badge with pending items count if any */}
                {pendingChallenge3 > 0 && <span className="nav-badge">{pendingChallenge3}</span>}
              </p>
            </NavLink>
          ) : (
            // If Challenge 3 is locked, show disabled div with context-aware message
            <div
              className="navlink disabled"
              style={getDisabledStyle()}
              // Show different message depending on whether Challenge 2 is completed
              onClick={(e) => handleShowBlockedPopup(e, challenge2Completed ? "desktop.popup.readMessageChallenge3" : "desktop.popup.completeChallenge2")}
              role="button"
            >
              <RiErrorWarningLine className="navlink-icon" />
              <p className="navlink-label">
                <span className="navlink-label-text">{t('nav.aiIncorrectUses')}</span>
                {pendingChallenge3 > 0 && <span className="nav-badge">{pendingChallenge3}</span>}
              </p>
            </div>
          )}
        </li>
        {/* New post launcher component - opens modal for creating new posts */}
        <NewPostLauncher />
      </ul>
  

      {/* Popup notification - shown when user tries to access blocked challenges */}
      {popup.visible && (
        <PopupNotification
          message={popup.message}
          position={popup.position}
          onClose={handleClosePopup}
          duration={800}
        />
      )}
    </nav>
  );
};
