import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import "./SocialMediaApp.css";
import { useOS } from "../../contexts/OSProvider";
import { NavRoutes } from "../../Routes/NavRoutes";
import { FaTimes, FaMinus, FaEye, FaEyeSlash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useStats } from "../../contexts/StatsProvider";
import { useUser } from "../../contexts/UserProvider";
import { useMessages } from "../../contexts/MessagesProvider";
import { useNavigate } from "react-router-dom";
import { assetPath } from "../../utils/assetPath";

/**
 * SocialMediaApp Component
 * 
 * Main container component for the social media application. This component:
 * - Manages the application window (titlebar, minimize/close buttons in window mode)
 * - Implements login authentication (hardcoded credentials: echo/MintAI_mod)
 * - Handles user onboarding and challenge completion tracking
 * - Routes between login screen and main application content
 * - Manages bot/challenge initialization for the game
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.mode="window"] - Display mode: "window" (desktop app) or "embedded" (no titlebar)
 * @returns {JSX.Element} The complete social media app UI with conditional login or navigated content
 */
export const SocialMediaApp = ({ mode = "window" }) => {
  // OS context for window management (minimize, close)
  const { closeApp, minimizeApp } = useOS();
  
  // Translation hook for multilingual support
  const { t } = useTranslation();
  
  // Challenge progress tracking and bot count management
  const {
    challenge1Completed, setSuspectUsersCount,
  } = useStats();

  // User data from global state
  const { userState } = useUser();

  // Message system for in-game notifications
  const { addMessage } = useMessages();
  
  // Navigation hook for routing
  const navigate = useNavigate();

  /**
   * Effect: Initialize suspect users count for challenge
   * 
   * Calculates the number of bot and human users to display as "suspects"
   * in the first challenge. Combines up to 3 bots and 2 humans.
   * Only runs if challenge1 is not completed and users are loaded.
   */
  useEffect(() => {
    if (challenge1Completed || !userState?.allUsers?.length) return;
    
    // Separate bots and humans from loaded users
    const bots = userState.allUsers.filter(u => u.puzzle?.isBot === true);
    const humans = userState.allUsers.filter(u => u.puzzle?.isBot === false);
    
    // Calculate total suspect count: max 3 bots + max 2 humans
    const count = Math.min(bots.length, 3) + Math.min(humans.length, 2);
    setSuspectUsersCount(count);
  }, [userState?.allUsers, challenge1Completed]);
  
  /**
   * Determine display mode: embedded vs window
   * Window mode shows titlebar and window controls
   * Embedded mode is for integration into other apps
   */
  const isEmbedded = mode === "embedded";
  
  // Login form state management
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loginErrorKey, setLoginErrorKey] = useState("");
  
  // Login state persisted in sessionStorage across page reloads
  const [loginDone, setLoginDone] = useState(
    () => sessionStorage.getItem("socialLoginDone") === "true"
  );
  
  // Track previous login state to detect transitions from false to true
  const prevLoginDoneRef = useRef(loginDone);

  /**
   * Determine if login is required
   * User must have read mission brief and not completed first challenge
   */
  const shouldRequireLogin = useMemo(() => {
    const missionBriefRead = sessionStorage.getItem("missionBriefRead") === "true";
    return missionBriefRead && !challenge1Completed;
  }, [challenge1Completed]);

  /**
   * Effect: Navigate to home when login is completed
   * 
   * Only redirects when:
   * 1. Login state transitions from false to true (actual login, not page reload)
   * 2. Not coming from admin view (fromAdmin flag check)
   * 3. Uses replace: true to replace history entry instead of adding new one
   */
  useEffect(() => {
    const prev = prevLoginDoneRef.current;
    prevLoginDoneRef.current = loginDone;
    
    // Detect login state transition from false to true
    if (loginDone && !prev && !sessionStorage.getItem("fromAdmin")) {
      navigate("/", { replace: true });
    }
    // Run only when login state changes; route changes should not trigger redirects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginDone]);

  /**
   * Effect: Send challenge1 introduction message after login
   * 
   * Displays initial game instructions in the messages app
   * and opens the drawer with boss notification
   * Only runs once per session (tracked in sessionStorage)
   */
  useEffect(() => {
    if (!loginDone) return;
    
    // Check if challenge1 instructions already sent this session
    const challenge1InstructionsSent = sessionStorage.getItem("challenge1InstructionsSent");
    if (!challenge1InstructionsSent) {
      // Mark that instructions have been sent
      sessionStorage.setItem("challenge1InstructionsSent", "true");
      
      // Add the challenge1 introduction message to messages system
      addMessage({
        fromKey: "messagesApp.author.name",
        subjectKey: "messagesApp.messages.challenge1.subject",
        contentKey: "messagesApp.messages.challenge1.content",
      });
      
      // Dispatch custom events to open drawer and show boss notification
      window.dispatchEvent(new Event("openDrawer"));
      window.dispatchEvent(new Event("bossMessage"));
    }
  }, [loginDone, addMessage]);

  /**
   * Handler: Process login form submission
   * 
   * Validates credentials (hardcoded: echo/MintAI_mod)
   * On success:
   * - Saves login state to sessionStorage
   * - Navigates to home page
   * On failure:
   * - Displays localized error message
   * 
   * @param {Event} event - Form submission event
   */
  const handleLoginSubmit = (event) => {
    // Prevent default form submission behavior
    event.preventDefault();
    
    // Validate hardcoded credentials
    const isValid = username === "echo" && password === "MintAI_mod";
    
    if (isValid) {
      // Persist login state to sessionStorage
      sessionStorage.setItem("socialLoginDone", "true");
      setLoginDone(true);
      setLoginErrorKey(""); // Clear any previous errors

      // Navigate to home page
      navigate("/", { replace: true });
      return;
    }
    
    // Set error message for invalid credentials
    setLoginErrorKey("socialLogin.errorInvalid");
  };

  return (
    // Main container: applying CSS class based on display mode (window vs embedded)
    <div className={isEmbedded ? "social-app-embedded" : "social-app-window"}>
      {/* WINDOW TITLEBAR - only shown in window mode, not in embedded mode */}
      {!isEmbedded && (
        <div className="window-titlebar">
          {/* Application title with ECHO logo */}
          <div className="window-title">
            <img
              src={assetPath("/assets/echo-logo.png")}
              alt="ECHO logo"
              onClick={() => navigate("/")}
              className="window-title-logo"
            />
          </div>
          
          {/* Window control buttons (minimize and close) */}
          <div className="window-controls">
            {/* Minimize button */}
            <button
              className="window-button minimize"
              onClick={minimizeApp}
              title={t("desktop.window.minimize")}
            >
              <FaMinus />
            </button>
            
            {/* Close button */}
            <button
              className="window-button close"
              onClick={() => closeApp("social")}
              title={t("desktop.window.close")}
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* APPLICATION CONTENT */}
      <div className="social-app-content">
        {/* Conditional rendering: Login screen OR main application routes */}
        {shouldRequireLogin && !loginDone ? (
          // LOGIN FORM - shown when user needs to authenticate
          <div className="social-login">
            <form className="social-login-card" onSubmit={handleLoginSubmit}>
              {/* Login form header with branding and title */}
              <div className="social-login-header">
                {/* ECHO branding section */}
                <div className="social-login-brand">
                  <img
                    src={assetPath("/assets/echo-logo-bg.png")}
                    alt="ECHO"
                    className="social-login-logo"
                  />
                  <span className="social-login-brand-name">ECHO</span>
                </div>
                
                {/* Login page title (translated) */}
                <span className="social-login-title">{t("socialLogin.title")}</span>
                
                {/* Login page subtitle (translated) */}
                <span className="social-login-subtitle">
                  {t("socialLogin.subtitle")}
                </span>
              </div>
              
              {/* Login form input fields */}
              <div className="social-login-fields">
                {/* Username input field */}
                <label className="social-login-label" htmlFor="login-username">
                  {t("socialLogin.usernameLabel")}
                </label>
                <input
                  id="login-username"
                  className="social-login-input"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="echo"
                  autoComplete="off"
                />
                
                {/* Password input field with visibility toggle */}
                <label className="social-login-label" htmlFor="login-password">
                  {t("socialLogin.passwordLabel")}
                </label>
                <div className="social-login-password-field">
                  {/* Password input with dynamic type (text when visible, password otherwise) */}
                  <input
                    id="login-password"
                    className="social-login-input social-login-password-input"
                    type={isPasswordVisible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="MintAI_mod"
                    autoComplete="current-password"
                  />
                  
                  {/* Password visibility toggle button (show/hide eye icon) */}
                  <button
                    type="button"
                    className="social-login-password-toggle"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  >
                    {isPasswordVisible ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                
                {/* Login error message - shown only if login failed */}
                {loginErrorKey && (
                  <span className="social-login-error">{t(loginErrorKey)}</span>
                )}
              </div>
              
              {/* Login submit button */}
              <button className="social-login-button" type="submit">
                {t("socialLogin.submit")}
              </button>
            </form>
          </div>
        ) : (
          // MAIN APPLICATION - shown after successful login
          // Contains all main app routes and functionality
          <NavRoutes />
        )}
      </div>
    </div>
  );
};
