import "./Profile.css";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Context providers: posts, user data
import { usePosts } from "../../contexts/PostsProvider.jsx";
import { Post } from "../../components/Post/Post";
import { UserInfo } from "./components/UserInfo/UserInfo";
import { Navbar } from "../../components/Navbar/Navbar";
import { useUser } from "../../contexts/UserProvider.jsx";
import { StatsPanel } from "../../components/StatsPanel/StatsPanel";
// Utilities: localization helper
import { getLocalizedContent } from "../../utils/i18nHelpers.jsx";

// Classification constants for bot/human detection
const CLASSIFICATION = {
  YES: "yes",  // Bot or misinfo
  NO: "no",    // Human or legit
};

// Convert classification values: normalize from multiple formats to standard format
// Handles: "AI" -> "yes", "Humano" -> "no", or returns unchanged
const normalizeClassification = (value) => {
  if (value === "AI") return CLASSIFICATION.YES;
  if (value === "Humano") return CLASSIFICATION.NO;
  return value;
};

// Get expected classification based on user's actual puzzle type
// Returns 'yes' if user is bot, 'no' if human
const expectedClassificationFromIsBot = (isBot) =>
  isBot ? CLASSIFICATION.YES : CLASSIFICATION.NO;

// Determine if quiz is required: user classified as bot AND user is actually a bot
const requiresQuizSubmission = (classification, user) =>
  normalizeClassification(classification) === CLASSIFICATION.YES &&
  user?.puzzle?.isBot === true;

// Array of detectable bot indicators for quiz questions
// Users must identify mandatory indicators when classifying as bot
const QUIZ_INDICATOR_KEYS = [
  "abnormalRatio",      // Unusual engagement ratio
  "recentAccount",      // Account created recently
  "temporalActivity",   // Posts at unusual times
  "targetAudience",     // Specific target audience
  "emotions",           // Emotional manipulation tactics
];

/**
 * Profile: displays user profile with admin puzzle controls
 * Features: account classification (bot/human), optional quiz for bot detection indicators
 * Used in: puzzle 1 (admin game), main app profile pages
 */
export const Profile = () => {
  // Multi-language support
  const { t, i18n } = useTranslation();
  // Router navigation
  const navigate = useNavigate();
  // Admin mode state: true if coming from admin puzzle
  const [fromAdmin, setFromAdmin] = useState(false);
  // Quiz UI state: show/hide classification quiz modal
  const [showClassificationQuiz, setShowClassificationQuiz] = useState(false);
  // Quiz error: validation error message
  const [quizError, setQuizError] = useState(null);
  // Quiz submission state: stores which users have completed quiz
  const [quizSubmittedByUser, setQuizSubmittedByUser] = useState(() => {
    const saved = sessionStorage.getItem("adminGameQuizState");
    if (!saved) return {};

    try {
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  // Quiz selection state: which indicators user selected in quiz
  const [selectedQuizOptions, setSelectedQuizOptions] = useState([]);
  // Post highlighting state: for emphasizing specific posts (final challenge)
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  // Classification results: tracks user classifications for all suspect accounts
  const [classifiedUsers, setClassifiedUsers] = useState(() => {
    const saved = sessionStorage.getItem("adminGameState");
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return Object.fromEntries(
      Object.entries(parsed).map(([uname, classification]) => [
        uname,
        normalizeClassification(classification),
      ]),
    );
  });
  // User context: all users data
  const { userState } = useUser();

  // Posts and routing context
  const { allPosts, postLoading } = usePosts();
  const { username } = useParams();

  // Quiz UI: expanded hints for quiz options
  const [expandedHints, setExpandedHints] = useState({});
  // Toggle expanded/collapsed state for quiz option descriptions
  const toggleDescription = (optionKey) => {
    setExpandedHints((prev) => ({
      ...prev,
      [optionKey]: !prev[optionKey],
    }));
  };

  // Filter posts: get all posts for current username
  const postsByUser = allPosts?.filter((post) => post.username === username);
  // Get current user data from all users
  const currentUser = userState?.allUsers?.find((u) => u.username === username);
  // Get suspect usernames list from admin game
  const suspectUsernames = (() => {
    const raw = sessionStorage.getItem("adminGameUsernames");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  // Check if current user is a suspect (bot) in admin puzzle
  const isSuspectUser =
    Boolean(currentUser) && suspectUsernames.includes(username);

  // Sort posts: community notes first (pinned), then regular posts by date (newest first)
  const sortedPostsByUser = postsByUser
    ? [
      ...postsByUser.filter((p) => p.isCommunityNote),
      ...postsByUser
        .filter((p) => !p.isCommunityNote)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    ]
    : [];

  // Check if classification is locked (user already correctly classified this account)
  const isClassificationLocked = (() => {
    if (!currentUser) return false;
    const currentClassification = normalizeClassification(
      classifiedUsers[username],
    );
    if (!currentClassification) return false;
    const isBot = currentUser?.puzzle?.isBot;
    return currentClassification === expectedClassificationFromIsBot(isBot);
  })();

  // Check if user came from admin puzzle (controls showing/hiding quiz controls)
  useEffect(() => {
    const cameFromAdmin = sessionStorage.getItem("fromAdmin");
    setFromAdmin(cameFromAdmin === "true");
  }, []);

  // Handle back button: return to admin game and clear session
  const handleBackToGame = () => {
    sessionStorage.removeItem("fromAdmin");
    navigate("/admin");
  };

  // Handle user classification: validate and save result
  const handleClassification = (classification) => {
    if (!currentUser) return;
    if (isClassificationLocked) return;

    const normalizedClassification = normalizeClassification(classification);

    // Save classification to session
    setClassifiedUsers((prev) => {
      const newState = {
        ...prev,
        [currentUser.username]: normalizedClassification,
      };
      sessionStorage.setItem("adminGameState", JSON.stringify(newState));
      return newState;
    });

    // If bot classification and quiz required, show quiz; otherwise close
    const shouldRequireQuiz = requiresQuizSubmission(
      normalizedClassification,
      currentUser,
    );
    if (shouldRequireQuiz && !quizSubmittedByUser[currentUser.username]) {
      setQuizError(null);
      setShowClassificationQuiz(true);
      return;
    }

    setShowClassificationQuiz(false);
  };

  // Toggle quiz option selection (checkbox)
  const toggleQuizOption = (optionKey) => {
    setSelectedQuizOptions((prev) => {
      if (prev.includes(optionKey)) {
        return prev.filter((id) => id !== optionKey);
      }
      return [...prev, optionKey];
    });
    // Clear error when user changes selections
    setQuizError(null);
  };

  // Get missing mandatory indicators (required for correct answer)
  const getMissingMandatoryIndicators = () => {
    if (!currentUser?.puzzle) return [];

    return QUIZ_INDICATOR_KEYS.filter((key) => {
      const indicator = currentUser.puzzle[key];

      // Only features marked with { mandatory: true } are required
      if (indicator && typeof indicator === 'object' && indicator.mandatory === true) {
        return !selectedQuizOptions.includes(key);
      }

      return false;
    });
  };

  // Get selectable indicators (features user can choose from)
  const getSelectableIndicators = () => {
    if (!currentUser?.puzzle) return [];

    return QUIZ_INDICATOR_KEYS.filter((key) => {
      const indicator = currentUser.puzzle[key];

      // Mandatory feature: { value: true, mandatory: true }
      if (indicator && typeof indicator === 'object' && indicator.value === true) {
        return true;
      }

      // Optional feature: true (boolean)
      if (indicator === true) {
        return true;
      }

      return false;
    });
  };

  const missingMandatory = getMissingMandatoryIndicators();
  const selectableIndicators = getSelectableIndicators();

  // Quiz submit button: always enabled (validation on submit)
  const canSubmitQuiz = true;

  // Handle quiz submission: validate and save results
  const handleSubmitQuiz = () => {
    if (!currentUser) return;

    // Validate: at least one option selected
    if (selectedQuizOptions.length === 0) {
      setQuizError(t('profile.selectAtLeastOne'));
      return;
    }

    // Get correct indicators (what user should have selected)
    const correctIndicators = QUIZ_INDICATOR_KEYS.filter((key) => {
      const indicator = currentUser?.puzzle?.[key];

      if (indicator && typeof indicator === 'object' && 'value' in indicator) {
        return indicator.value === true;
      }

      return indicator === true;
    });

    // Validate: all mandatory indicators selected
    if (missingMandatory.length > 0) {
      // Check if user selected incorrect options
      const incorrectSelected = selectedQuizOptions.filter(option => !correctIndicators.includes(option));
      const correctSelected = selectedQuizOptions.filter(option => correctIndicators.includes(option));

      // If incorrect selected or nothing correct selected = full error
      if (incorrectSelected.length > 0 || correctSelected.length === 0) {
        setQuizError(t('profile.quizAnswerWrong'));
      } else {
        // User selected only correct options but missing mandatory = partial error
        setQuizError(t('profile.quizAnswerPartial'));
      }
      return;
    }

    // Clear error if valid
    setQuizError(null);

    // Save quiz completion for this user
    setQuizSubmittedByUser((prev) => {
      const newState = { ...prev, [currentUser.username]: true };
      sessionStorage.setItem("adminGameQuizState", JSON.stringify(newState));
      return newState;
    });
    setShowClassificationQuiz(false);
  };

  // Compute all classification state for current profile
  const currentClassification = normalizeClassification(
    classifiedUsers[username],
  );
  const hasClassificationForCurrentProfile = Boolean(currentClassification);
  const expectedClassificationForCurrentProfile =
    expectedClassificationFromIsBot(currentUser?.puzzle?.isBot);
  const isClassificationCorrectForCurrentProfile =
    Boolean(currentUser) &&
    hasClassificationForCurrentProfile &&
    currentClassification === expectedClassificationForCurrentProfile;
  const shouldRequireQuizForCurrentProfile = requiresQuizSubmission(
    currentClassification,
    currentUser,
  );
  // Is this a puzzle profile (suspect user in admin game)
  const isPuzzleProfile = fromAdmin && isSuspectUser && username !== "ECHO";
  const isQuizCompletedForCurrentProfile = Boolean(
    currentUser && quizSubmittedByUser[currentUser.username],
  );
  // Profile is resolved when: correct classification AND (no quiz required OR quiz completed)
  const isCurrentProfileResolved =
    isClassificationCorrectForCurrentProfile &&
    (!shouldRequireQuizForCurrentProfile || isQuizCompletedForCurrentProfile);
  const canReturnToGame = true;

  // Can user open quiz: quiz required AND not already completed
  const canOpenQuiz =
    shouldRequireQuizForCurrentProfile &&
    currentUser &&
    !quizSubmittedByUser[currentUser.username];
  // Lock global navigation in admin mode for puzzle accounts
  const shouldLockGlobalNavigation = isPuzzleProfile && !canReturnToGame;

  // Clear quiz options when username changes (new user)
  useEffect(() => {
    setSelectedQuizOptions([]);
  }, [username]);

  // Handle post highlighting for final challenge (ECHO profile only)
  useEffect(() => {
    if (username !== "ECHO") {
      setHighlightedPostId(null);
      return;
    }

    // Check if highlighting is enabled
    const shouldHighlight =
      sessionStorage.getItem("echo:highlightFinalCommunityNote") === "true";
    const highlightedCreatedAt = sessionStorage.getItem(
      "echo:highlightFinalCommunityNoteCreatedAt",
    );
    const highlightedContent = sessionStorage.getItem(
      "echo:highlightFinalCommunityNoteContent",
    );
    if (!shouldHighlight || !sortedPostsByUser.length) return;

    // Find post matching the stored metadata
    const postToHighlight = sortedPostsByUser.find(
      (post) =>
        post.isCommunityNote &&
        String(post.createdAt) === String(highlightedCreatedAt) &&
        String(getLocalizedContent(post.content, i18n.language)) ===
        String(highlightedContent),
    );
    if (!postToHighlight?._id) {
      setHighlightedPostId(null);
      return;
    }

    // Set highlight and auto-clear after 2.8 seconds
    setHighlightedPostId(postToHighlight._id);
    sessionStorage.removeItem("echo:highlightFinalCommunityNote");
    sessionStorage.removeItem("echo:highlightFinalCommunityNoteCreatedAt");
    sessionStorage.removeItem("echo:highlightFinalCommunityNoteContent");

    const timeoutId = setTimeout(() => {
      setHighlightedPostId(null);
    }, 2800);

    return () => clearTimeout(timeoutId);
  }, [i18n.language, sortedPostsByUser, username]);

  return (
    <>
      {/* Main container with profile layout */}
      <div className="app-container">
        {/* Navigation bar: locked styling if in admin puzzle mode */}
        <div
          className={shouldLockGlobalNavigation ? "profile-navbar-locked" : ""}
        >
          <Navbar />
        </div>

        {/* Main profile feed */}
        <main className="feed profile-feed">
          {/* Back to game button: shown only in admin mode */}
          {fromAdmin && (
            <div className="back-to-game-container">
              <button
                className="back-to-game-button"
                onClick={handleBackToGame}
                disabled={!canReturnToGame}
              >
                ← {t("profile.backToGame")}
              </button>
            </div>
          )}
          {/* User info section: profile details + classification controls */}
          <UserInfo
            username={username}
            showClassificationControls={
              fromAdmin && isSuspectUser && username !== "ECHO"
            }
            selectedClassification={classifiedUsers[username]}
            onClassify={handleClassification}
            isClassificationLocked={isClassificationLocked}
            canOpenClassificationQuiz={canOpenQuiz}
            onOpenClassificationQuiz={() => {
              setQuizError(null);
              setShowClassificationQuiz(true);
            }}
            isQuizCompleted={isQuizCompletedForCurrentProfile}
          />
          {/* Posts section: user's posts with optional highlighting */}
          <div className="user-posts-container">
            {!postLoading &&
              (sortedPostsByUser.length ? (
                sortedPostsByUser.map((post) => (
                  <Post
                    key={post._id}
                    post={post}
                    shouldFlash={post._id === highlightedPostId}
                  />
                ))
              ) : (
                <>
                  <p className="no-bookmarks">{t("profile.noPosts")}</p>
                </>
              ))}
          </div>

          {/* Classification quiz modal: shown after user classifies account as bot */}

        </main>
        {showClassificationQuiz && (
          <div
            className="classification-quiz-overlay"
            onClick={() => setShowClassificationQuiz(false)}
          >
            <div
              className="classification-quiz-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                className="classification-quiz-close"
                type="button"
                onClick={() => setShowClassificationQuiz(false)}
                aria-label={t("profile.closeQuiz")}
              >
                ×
              </button>
              {/* Quiz header */}
              <h3 className="classification-quiz-title">
                {t("profile.classificationQuizTitle")}
              </h3>
              <p className="classification-quiz-subtitle">
                {t("profile.classificationQuizSubtitle")}
              </p>

              {/* Quiz options: checkboxes for bot indicators */}
              <div className="classification-quiz-options">
                {QUIZ_INDICATOR_KEYS.map((optionKey) => (
                  <label
                    key={optionKey}
                    className="classification-quiz-option"
                  >
                    {/* Checkbox: select indicator */}
                    <input
                      type="checkbox"
                      checked={selectedQuizOptions.includes(optionKey)}
                      onChange={() => toggleQuizOption(optionKey)}
                    />

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
                        <strong>
                          {/* Indicator label (title only) */}
                          {t(`admin.hintContent.${optionKey}`).split(":")[0]}

                          {" "}  {" "}
                          <button
                            type="button"
                            onClick={() => toggleDescription(optionKey)}
                            className="hint-toggle-button"
                          >

                            {expandedHints[optionKey]
                              ? t("profile.classificationQuiz.SeeLess")
                              : t("profile.classificationQuiz.SeeMore")
                            }
                          </button>
                        </strong>

                      </div>

                      <span
                        style={{
                          color: "#ffffffbb",
                          fontSize: "0.85rem",
                          marginTop: "0.25rem",

                          display: expandedHints[optionKey] ? "inline" : "none",
                        }}
                      >
                        {t(`admin.hintContent.${optionKey}`).split(":")[1]}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {quizError && (
                <div className="classification-quiz-error">
                  <span className="error-icon">⚠</span>
                  {quizError}
                </div>
              )}

              <button
                type="button"
                className="classification-quiz-submit"
                onClick={handleSubmitQuiz}
              >
                {t("profile.sendQuizAnswer")}
              </button>
            </div>
          </div>
        )}
        {/* Panel de estadísticas lateral */}
        <aside className="stats-sidebar">
          <StatsPanel />
        </aside>
      </div>
    </>
  );
};
