import React, { useState, useEffect, useRef } from "react";
import "./StatsPanel.css";
import { useStats } from "../../contexts/StatsProvider";
import { useTranslation } from "react-i18next";
import {
  FaRobot,
  FaBrain,
  FaFlag,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

/**
 * StatsPanel Component
 * 
 * Displays game statistics and challenge progress with animated visualizations.
 * Features:
 * - Countdown timer for escape room (with critical state at 5 minutes)
 * - Three challenge modules with progress indicators (Bot Detection, AI Detection, Content Moderation)
 * - Animated value transitions and celebration effects on challenge completion
 * - Half-gauge and donut chart visualizations
 * - Overall "System Status" showing current threat level
 * - Completion time display when escape room is finished
 * 
 * @component
 */

/**
 * HalfGauge Component
 * 
 * SVG half-circle gauge (semicircle) that displays a percentage value.
 * Useful for showing levels like threat percentage.
 * 
 * @param {number} value - Percentage value (0-100) to display
 * @param {string} colorClass - CSS class name for color (sp-color--danger, sp-color--warn, sp-color--ok, sp-color--offline)
 * @returns {JSX.Element} SVG gauge element
 */
const HalfGauge = ({ value, colorClass }) => {
  const r = 28;
  const arc = Math.PI * r;
  // Calculate how much of the arc should be filled (0-1 clamped)
  const filled = Math.min(value / 100, 1) * arc;
  
  return (
    // SVG container for half-circle gauge
    <svg width="80" height="46" viewBox="0 0 80 46" className={`sp-gauge-svg ${colorClass}`}>
      {/* Background arc - light gray */}
      <path
        d="M 8 40 A 32 32 0 0 1 72 40"
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round"
      />
      {/* Foreground arc - animated and colored based on colorClass */}
      <path
        d="M 8 40 A 32 32 0 0 1 72 40"
        fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${filled} ${arc}`}
        className="sp-gauge-arc"
      />
      {/* Percentage text in center */}
      <text x="40" y="38" textAnchor="middle" fill="currentColor"
        fontSize="13" fontWeight="700" fontFamily='"Share Tech Mono", monospace'>
        {value}%
      </text>
    </svg>
  );
};

/**
 * DonutChart Component
 * 
 * SVG donut (circular) chart that displays a percentage value in a ring format.
 * Smaller and more compact than HalfGauge, suitable for showing metrics like AI content rate.
 * 
 * @param {number} pct - Percentage value (0-100) to display
 * @param {string} colorClass - CSS class name for color
 * @param {string} label - Text label to display in center of donut
 * @param {number} [size=62] - Size of SVG in pixels (default 62x62)
 * @returns {JSX.Element} SVG donut chart element
 */
const DonutChart = ({ pct, colorClass, label, size = 62 }) => {
  // Radius of the circle
  const r = 19;
  // Total circumference of circle
  const circ = 2 * Math.PI * r;
  // Calculate how much of the circle should be filled (0-1 clamped)
  const filled = Math.min(pct / 100, 1) * circ;
  
  return (
    // SVG container for donut chart
    <svg width={size} height={size} viewBox="0 0 48 48" className={colorClass}>
      {/* Background circle - light gray */}
      <circle cx="24" cy="24" r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
      {/* Foreground circle - animated and colored based on colorClass */}
      <circle cx="24" cy="24" r={r} fill="none"
        stroke="currentColor" strokeWidth="6"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        className="sp-donut-arc"
      />
      {/* Label text in center of donut */}
      <text x="24" y="27" textAnchor="middle" fill="currentColor"
        fontSize="9.5" fontWeight="700" fontFamily='"Share Tech Mono", monospace'>
        {label}
      </text>
    </svg>
  );
};

/**
 * animateValue Utility Function
 * 
 * Animates a numeric value from one number to another over a specified duration.
 * Uses cubic easing (ease-out) for smooth acceleration/deceleration.
 * 
 * @param {number} from - Starting value
 * @param {number} to - Ending value
 * @param {Function} setter - State setter function to update the value
 * @param {number} [duration=1500] - Animation duration in milliseconds (default 1500ms)
 * @returns {number} Interval ID (can be used to cancel if needed)
 */
const animateValue = (from, to, setter, duration = 1500) => {
  // Number of animation frames
  const steps = 60;
  // Time per frame
  const stepTime = duration / steps;
  let count = 0;
  
  // Start interval animation
  const id = setInterval(() => {
    count++;
    // Cubic easing (ease-out): 1 - (1-t)^3
    // Creates faster animation at start, slower at end
    const eased = 1 - Math.pow(1 - count / steps, 3);
    // Calculate intermediate value and round to integer
    setter(Math.round(from + (to - from) * eased));
    // Complete animation when all steps finished
    if (count >= steps) { 
      setter(to); 
      clearInterval(id); 
    }
  }, stepTime);
  
  return id;
};

export const StatsPanel = () => {
  // █████████████████████████████████████
  // CONTEXT AND STATE RETRIEVAL
  // █████████████████████████████████████
  
  // Get all stats from global context
  const {
    stats,
    challenge1Completed,
    challenge2Completed,
    challenge3Completed,
    challengeFinalCompleted,
    suspectUsersCount,
  } = useStats();
  const { t } = useTranslation();

  // State to track the order of modules - reordered after completion animations
  // Modules with completion=false appear first (urgent), completed modules appear last
  const [moduleOrder, setModuleOrder] = useState([0, 1, 2]); // Indices for [module1, module2, module3]

  /**
   * Animated values for challenge metrics
   * These animate from old to new values when challenges complete
   * 
   * Initial values:
   * - Challenge 1: Bot activity percentage/detected/suspects
   * - Challenge 2: AI content percentage
   * - Challenge 3: Content integrity/misuse metrics
   * - Overall: Threat level
   */
  
  // Bot Detection (Challenge 1) - animated values
  const [animBotPct,      setAnimBotPct]      = useState(() => challenge1Completed ? 0  : stats.botActivity.percentage);
  const [animBotDetected, setAnimBotDetected] = useState(() => challenge1Completed ? 0  : stats.botActivity.detected);
  const [animBotSuspect,  setAnimBotSuspect]  = useState(() => challenge1Completed ? 0  : suspectUsersCount);
  
  // AI Detection (Challenge 2) - AI content percentage
  const [animAiPct,       setAnimAiPct]       = useState(() => challenge2Completed ? 4  : 34);
  
  // Content Moderation (Challenge 3) - integrity and misuse metrics
  const [animIntegrity,   setAnimIntegrity]   = useState(() => challenge3Completed ? 92 : 22);
  const [animMisuse,      setAnimMisuse]      = useState(() => challenge3Completed ? 0  : 3);
  
  // Overall threat level (decreases as challenges are completed)
  const [animThreat,      setAnimThreat]      = useState(() =>
    challenge3Completed ? 0 : challenge2Completed ? 26 : challenge1Completed ? 52 : 78
  );

  /**
   * Flags to trigger celebration animations when challenges complete
   * Set to true on completion, reset to false after 2400ms animation
   */
  const [celebrating1, setCelebrating1] = useState(false);
  const [celebrating2, setCelebrating2] = useState(false);
  const [celebrating3, setCelebrating3] = useState(false);


  /**
   * Refs to track previous challenge completion states
   * Used to detect the exact moment a challenge is newly completed
   * (so we can trigger animations and value transitions)
   */
  const prevC1 = useRef(challenge1Completed);
  const prevC2 = useRef(challenge2Completed);
  const prevC3 = useRef(challenge3Completed);


  /**
   * Effect: Keep bot activity percentage and detected count in sync while Challenge 1 is active
   * Once Challenge 1 completes, these values freeze at their final values
   */
  useEffect(() => {
    if (!challenge1Completed) {
      setAnimBotPct(stats.botActivity.percentage);
      setAnimBotDetected(stats.botActivity.detected);
    }
  }, [stats.botActivity.percentage, stats.botActivity.detected, challenge1Completed]);

  /**
   * Effect: Keep suspect users count in sync while Challenge 1 is active
   */
  useEffect(() => {
    if (!challenge1Completed) setAnimBotSuspect(suspectUsersCount);
  }, [suspectUsersCount, challenge1Completed]);


  /**
   * Effect: Animate values when Challenge 1 completes
   * 
   * Animations:
   * - Bot Activity: 0%
   * - Bots Detected: Increase by suspect count
   * - Suspects: 0
   * - Overall Threat: 78% → 52%
   * - Celebration effect: 2400ms
   * - Reorder modules: After animation completes
   */
  useEffect(() => {
    // Only animate on transition from false to true (first completion)
    if (!challenge1Completed || prevC1.current) return;
    prevC1.current = true;
    
    // Trigger celebration effect
    setCelebrating1(true);
    setTimeout(() => {
      setCelebrating1(false);
      // Reorder modules after animation
      reorderModules();
    }, 2400);
    
    // Animate all metrics decreasing as threat is resolved
    animateValue(stats.botActivity.percentage, 0, setAnimBotPct);
    animateValue(stats.botActivity.detected, stats.botActivity.detected + suspectUsersCount, setAnimBotDetected);
    animateValue(suspectUsersCount, 0, setAnimBotSuspect);
    animateValue(78, 52, setAnimThreat);
  }, [challenge1Completed, stats.botActivity.detected, suspectUsersCount]);


  /**
   * Effect: Animate values when Challenge 2 completes
   * 
   * Animations:
   * - AI Content Rate: 34% → 4%
   * - Overall Threat: Dynamic based on C1 state, converges to 26%
   * - Celebration effect: 2400ms
   * - Reorder modules: After animation completes
   */
  useEffect(() => {
    // Only animate on transition from false to true (first completion)
    if (!challenge2Completed || prevC2.current) return;
    prevC2.current = true;
    
    // Trigger celebration effect
    setCelebrating2(true);
    setTimeout(() => {
      setCelebrating2(false);
      // Reorder modules after animation
      reorderModules();
    }, 2400);
    
    // Animate AI detection metrics down
    animateValue(34, 4, setAnimAiPct);
    // Threat level depends on whether C1 was completed
    animateValue(challenge1Completed ? 52 : 78, 26, setAnimThreat);
  }, [challenge2Completed, challenge1Completed]);


  /**
   * Effect: Animate values when Challenge 3 completes
   * 
   * Animations:
   * - Content Integrity: 22% → 92%
   * - Content Misuse: 3 → 0
   * - Overall Threat: Dynamic based on C1/C2 state → 0% (fully resolved)
   * - Celebration effect: 2400ms
   * - Reorder modules: After animation completes
   */
  useEffect(() => {
    // Only animate on transition from false to true (first completion)
    if (!challenge3Completed || prevC3.current) return;
    prevC3.current = true;
    
    // Trigger celebration effect
    setCelebrating3(true);
    setTimeout(() => {
      setCelebrating3(false);
      // Reorder modules after animation
      reorderModules();
    }, 2400);
    
    // Animate content moderation metrics improving
    animateValue(22, 92, setAnimIntegrity);
    animateValue(3, 0, setAnimMisuse);
    // Threat becomes 0 (all challenges complete, fully resolved)
    animateValue(challenge2Completed ? 26 : challenge1Completed ? 52 : 78, 0, setAnimThreat);
  }, [challenge3Completed, challenge2Completed, challenge1Completed]);


  /**
   * Reorder modules: Incomplete (urgent) modules first, completed modules last
   * This function is called after each challenge completion animation (2400ms)
   */
  const reorderModules = () => {
    const modules = [
      { index: 0, completed: challenge1Completed },  // Bot Detection
      { index: 1, completed: challenge2Completed },  // AI Content Detection
      { index: 2, completed: challenge3Completed },  // Content Moderation
    ];
    
    // Sort: incomplete (false) before complete (true)
    modules.sort((a, b) => {
      // false comes before true (so incomplete comes first)
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });
    
    // Extract sorted indices and update state
    const newOrder = modules.map(m => m.index);
    setModuleOrder(newOrder);
  };

  /**
   * Determine color scheme based on metric values
   * Actual colors are defined in CSS using these class names
   * Color progression: sp-color--danger (red) > sp-color--warn (orange) > sp-color--ok (green)
   */
  const threatClass    = animThreat    >= 70 ? "sp-color--danger" : animThreat    >= 40 ? "sp-color--warn" : "sp-color--ok";
  const botClass       = animBotPct    >  0  ? "sp-color--danger" : "sp-color--ok";
  const aiClass        = animAiPct     > 10  ? "sp-color--offline" : "sp-color--ok";
  const integrityClass = animIntegrity < 50  ? "sp-color--warn"   : "sp-color--ok";

  /**
   * Render module based on index
   * Modules: 0=Bot Detection, 1=AI Content Detection, 2=Content Moderation
   * Renders with smooth transitions via CSS order property
   */
  const renderModule = (moduleIndex) => {
    switch (moduleIndex) {
      case 0: // MODULE 1 — BOT DETECTION
        return (
          <div key="module-0" className={`sp-module${challenge1Completed ? " sp-module--success" : ""}${celebrating1 ? " sp-module--celebrating" : ""}`}>
            {/* Module header with icon, title, and status badge */}
            <div className="sp-mod-head">
              {/* Robot icon - color changes on completion */}
              <FaRobot className={`sp-mod-icon ${challenge1Completed ? "sp-mod-icon--success" : "sp-mod-icon--danger"}`} />
              {/* Module title */}
              <span className="sp-mod-title">{t("statsPanel.botModule.title")}</span>
              {/* Status badge - OK (green) if completed, ALERT (red) if not */}
              {challenge1Completed
                ? <span className="sp-badge sp-badge--ok">{t("statsPanel.statusSecure")}</span>
                : <span className="sp-badge sp-badge--danger">{t("statsPanel.statusAlert")}</span>
              }
            </div>

            {/* Module content: Donut chart and metrics */}
            <div className="sp-chart-row">
              {/* Donut chart showing bot activity percentage */}
              <DonutChart pct={animBotPct} colorClass={botClass} label={`${animBotPct}%`} />
              
              {/* Metrics boxes */}
              <div className="sp-chart-metrics">
                {/* Number of bots detected */}
                <div className={`sp-metric-box ${challenge1Completed ? "sp-metric-box--ok" : "sp-metric-box--danger"}`}>
                  <span className="sp-metric-val">{animBotDetected}</span>
                  <span className="sp-metric-lbl">{t("statsPanel.botModule.detected")}</span>
                </div>
                {/* Number of suspicious/suspect accounts */}
                <div className={`sp-metric-box ${challenge1Completed ? "sp-metric-box--ok" : "sp-metric-box--danger"}`}>
                  <span className="sp-metric-val">{animBotSuspect}</span>
                  <span className="sp-metric-lbl">{t("statsPanel.botModule.suspicious")}</span>
                </div>
              </div>
            </div>

            {/* Module footer note - different messages based on completion status */}
            <p className="sp-mod-note">
              {challenge1Completed ? t("statsPanel.botModule.resolvedNote") : t("statsPanel.botModule.note")}
            </p>
          </div>
        );
      
      case 1: // MODULE 2 — AI CONTENT DETECTION
        return (
          <div key="module-1" className={`sp-module${challenge2Completed ? " sp-module--success" : ""}${celebrating2 ? " sp-module--celebrating" : ""}`}>
            {/* Module header with icon, title, and status badge */}
            <div className="sp-mod-head">
              {/* Brain icon - color changes on completion */}
              <FaBrain className={`sp-mod-icon ${challenge2Completed ? "sp-mod-icon--success" : "sp-mod-icon--offline"}`} />
              {/* Module title */}
              <span className="sp-mod-title">{t("statsPanel.aiModule.title")}</span>
              {/* Status badge - ONLINE (green) if completed, OFFLINE (gray) if not */}
              {challenge2Completed
                ? <span className="sp-badge sp-badge--ok">{t("statsPanel.aiModule.statusOnline")}</span>
                : <span className="sp-badge sp-badge--offline">{t("statsPanel.aiModule.status")}</span>
              }
            </div>

            {/* Module content: Donut chart and status indicators */}
            <div className="sp-chart-row">
              {/* Donut chart section with label */}
              <div className="sp-donut-wrap">
                {/* Donut chart showing AI content rate percentage */}
                <DonutChart pct={animAiPct} colorClass={aiClass} label={challenge2Completed ? `${animAiPct}%` : "~34%"} />
                {/* Sublabel explanation */}
                <span className="sp-donut-sub">{t("statsPanel.aiModule.aiContentRate")}</span>
              </div>
              
              {/* Status indicators showing detector state */}
              <div className="sp-status-list">
                {/* AI Detector status (on/off) */}
                <div className="sp-status-row">
                  <span className={`sp-dot ${challenge2Completed ? "sp-dot--on" : "sp-dot--off"}`} />
                  <span className="sp-status-text">
                    {challenge2Completed ? t("statsPanel.aiModule.detectorOnline") : t("statsPanel.aiModule.detector")}
                  </span>
                </div>
                {/* Manual Review Mode status (on/off) */}
                <div className="sp-status-row">
                  <span className={`sp-dot ${challenge2Completed ? "sp-dot--off" : "sp-dot--on"}`} />
                  <span className="sp-status-text">{t("statsPanel.aiModule.manualMode")}</span>
                </div>
              </div>
            </div>

            {/* Module footer note - different messages based on completion status */}
            <p className={`sp-mod-note${challenge2Completed ? "" : " sp-mod-note--warn"}`}>
              {challenge2Completed ? t("statsPanel.aiModule.resolvedNote") : t("statsPanel.aiModule.reason")}
            </p>
          </div>
        );
      
      case 2: // MODULE 3 — CONTENT MODERATION
        return (
          <div key="module-2" className={`sp-module${challenge3Completed ? " sp-module--success" : ""}${celebrating3 ? " sp-module--celebrating" : ""}`}>
            {/* Module header with icon, title, and status badge */}
            <div className="sp-mod-head">
              {/* Flag icon - color changes on completion */}
              <FaFlag className={`sp-mod-icon ${challenge3Completed ? "sp-mod-icon--success" : "sp-mod-icon--warn"}`} />
              {/* Module title */}
              <span className="sp-mod-title">{t("statsPanel.modModule.title")}</span>
              {/* Status badge - DONE (green) if completed, CAUTION (orange) if not */}
              {challenge3Completed
                ? <span className="sp-badge sp-badge--ok">{t("statsPanel.doneModule.status")}</span>
                : <span className="sp-badge sp-badge--warn">{t("statsPanel.modModule.status")}</span>
              }
            </div>

            {/* Module content: Donut chart, status list, and metrics */}
            <div className="sp-chart-row">
              {/* Donut chart section with label */}
              <div className="sp-donut-wrap">
                {/* Donut chart showing content integrity percentage */}
                <DonutChart pct={animIntegrity} colorClass={integrityClass} label={`${animIntegrity}%`} />
                {/* Sublabel explanation */}
                <span className="sp-donut-sub">{t("statsPanel.modModule.integrity")}</span>
              </div>
              
              {/* Right column: Status list and misuse metric */}
              <div className="sp-stacked">
                {/* Moderation mode indicators */}
                <div className="sp-status-list">
                  {/* Manual moderation (on/off) */}
                  <div className="sp-status-row">
                    <span className={`sp-dot ${challenge3Completed ? "sp-dot--off" : "sp-dot--on"}`} />
                    <span className="sp-status-text">{t("statsPanel.modModule.manual")}</span>
                  </div>
                  {/* Automated moderation (only shown after challenge complete) */}
                  {challenge3Completed && (
                    <div className="sp-status-row">
                      <span className="sp-dot sp-dot--on" />
                      <span className="sp-status-text">{t("statsPanel.modModule.automated")}</span>
                    </div>
                  )}
                </div>
                {/* Number of flagged misuse cases */}
                <div className={`sp-metric-box sp-metric-box--inline ${challenge3Completed ? "sp-metric-box--ok" : "sp-metric-box--warn"}`}>
                  <span className="sp-metric-val">{animMisuse}</span>
                  <span className="sp-metric-lbl">{t("statsPanel.modModule.misuse")}</span>
                </div>
              </div>
            </div>

            {/* Module footer note - different messages based on completion status */}
            <p className={`sp-mod-note${challenge3Completed ? "" : " sp-mod-note--warn"}`}>
              {challenge3Completed ? t("statsPanel.doneModule.note") : t("statsPanel.modModule.note")}
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };


  return (
    <div className="stats-panel">

      {/* ════════════════════════════════════════════════════════════
          STATS PANEL HEADER - Title and System Status Badge
          ════════════════════════════════════════════════════════════ */}
      <div className="sp-header">
        {/* Panel title */}
        <span className="sp-header-title">{t("statsPanel.title")}</span>
        {/* System status badge - changes color based on Challenge 3 completion */}
        <span className={`sp-sys-badge ${challenge3Completed ? "sp-sys-badge--ok" : "sp-sys-badge--alert"}`}>
          {challenge3Completed ? t("statsPanel.statusSecure") : t("statsPanel.statusAlert")}
        </span>
      </div>

      {/* ════════════════════════════════════════════════════════════
          OVERALL THREAT GAUGE - Half-circle gauge showing threat level
          ════════════════════════════════════════════════════════════ */}
      <div className="sp-threat">
        <div className="sp-gauge-wrap">
          <span className="sp-threat-name">{t("statsPanel.misinformationLevel")}</span>
          {/* Half-gauge visualization of threat percentage */}
          <HalfGauge value={animThreat} colorClass={threatClass} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODULES — RENDERED IN DYNAMIC ORDER
          Order changes after each challenge completion:
          - Incomplete (urgent) modules appear first
          - Completed modules appear last
          ════════════════════════════════════════════════════════════ */}
      {moduleOrder.map((moduleIndex) => renderModule(moduleIndex))}

    </div>
  );
};
