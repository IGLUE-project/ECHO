import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useStats } from "../../contexts/StatsProvider.jsx"; // Stats tracking (challenge completion)
import { usePosts } from "../../contexts/PostsProvider.jsx"; // Create posts (final conclusion)
import { useLoggedInUser } from "../../contexts/LoggedInUserProvider.jsx"; // Current user data
import { useEscapp } from "../../contexts/EscappProvider.jsx"; // Escapp puzzle submission
import { IoMdClose } from "../../utils/icons.jsx"; // Close button icon
import statementsData from "./CommunityNoteStatements.json"; // Statements to display (multi-language)
import { assetPath } from "../../utils/assetPath"; // Asset path helper
import "./CommunityNote.css";

// Challenge 4 (final): Community Note - select correct statements to conclude the game
export const CommunityNote = ({ setIsCreateNewPostClicked, className = "modal-content" }) => {
  const { t } = useTranslation(); // Multi-language support
  const currentLang = t("langKey"); // Current language code
  const { completeChallengeFinal } = useStats(); // Mark challenge 4 as complete
  const { createPost } = usePosts(); // Create the final conclusion post
  const { loggedInUserState } = useLoggedInUser(); // Get current user data
  const { submitChallenge } = useEscapp(); // Submit the final puzzle to Escapp
  const navigate = useNavigate(); // Route navigation
  // Track which statements player selected (user selections)
  const [selectedStatements, setSelectedStatements] = useState([]);

  // Get statements in current language and shuffle them
  const statements = useMemo(
    () => (statementsData[currentLang] || statementsData.en || []).sort(() => Math.random() - 0.5),
    [currentLang]
  );
  // Count how many correct statements must be selected
  const requiredCorrectCount = useMemo(
    () => statements.filter((statement) => statement.correct).length,
    [statements]
  );
  // Display instruction: "Select X correct statements"
  const challengeDescription = useMemo(
    () => t("createPost.selectCorrectCount", { count: requiredCorrectCount }),
    [t, requiredCorrectCount]
  );

  // Validate selected statements when language or required count changes
  useEffect(() => {
    // Remove invalid statement IDs and trim excess selections
    const validIds = new Set(statements.map((statement) => statement.id));
    setSelectedStatements((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      return filtered.slice(0, requiredCorrectCount);
    });
  }, [statements, requiredCorrectCount]);

  // Toggle statement selection (add/remove from selection)
  const handleStatementClick = (id) => {
    setSelectedStatements((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        // Deselect if already selected
        return prev.filter((statementId) => statementId !== id);
      }
      // Add selection if not at max count
      if (prev.length < requiredCorrectCount) {
        return [...prev, id];
      }
      // Ignore if at max (can't select more)
      return prev;
    });
  };

  // Submit: send the selected statement IDs to Escapp for server-side verification;
  // on success create the conclusion post (which triggers the outro).
  const handleSubmit = () => {
    // Structural check: user selected the required count of statements
    if (selectedStatements.length !== requiredCorrectCount) {
      toast.error(
        t("createPost.incorrectSelection") + ` (${selectedStatements.length}/${requiredCorrectCount})`
      );
      return;
    }

    // Answer format: selected statement IDs, ascending, ';'-joined. Escapp verifies.
    const answer = [...selectedStatements].sort((a, b) => a - b).join(";");

    submitChallenge(5, answer, (success) => {
      if (!success) {
        // Escapp rejected the answer — keep selections so the user can adjust them.
        toast.error(t("createPost.incorrectSelection"));
        return;
      }

      // Record timestamp for the conclusion post
      const finalCommunityNoteCreatedAt = new Date().toISOString();
      // Build conclusion post object with ECHO account details
      const conclusionPost = {
        firstName: loggedInUserState?.firstName,
        lastName: loggedInUserState?.lastName,
        content: t("createPost.conclusionText"), // Final message from ECHO
        mediaUrl: "",
        isCommunityNote: true, // Mark as conclusion post
        avatarURL: "/assets/echo-logo-bg.png",
        createdAt: finalCommunityNoteCreatedAt,
      };
      // Create the conclusion post in feed
      createPost(new Event("submit"), conclusionPost, "admin-token");
      // Update stats: mark challenge 4 as complete
      completeChallengeFinal();

      // Save conclusion post metadata for highlighting in feed
      sessionStorage.setItem("echo:highlightFinalCommunityNote", "true");
      sessionStorage.setItem("echo:highlightFinalCommunityNoteCreatedAt", finalCommunityNoteCreatedAt);
      sessionStorage.setItem("echo:highlightFinalCommunityNoteContent", t("createPost.conclusionText"));
      // Close modal if applicable
      setIsCreateNewPostClicked && setIsCreateNewPostClicked(false);
      // Navigate to profile to see the new conclusion post
      navigate(`/profile/${loggedInUserState?.username || "Katherine"}`);
    });
  };

  return (
    <form className={`new-post-container conclusion-challenge-form ${className}`} onSubmit={(e) => e.preventDefault()}>
      {/* User avatar: clickable to navigate to profile */}
      <div
        onClick={() => navigate(`/profile/${loggedInUserState?.username}`)}
        className="img-container"
      >
        <img
         className="echo-logo-create-post"
          src={assetPath(loggedInUserState.avatarURL)}
          alt={loggedInUserState.firstName}
        />
      </div>

      <div className="input-container">
        {/* Close button: shown if modal was opened via callback */}
        {setIsCreateNewPostClicked && (
          <IoMdClose
            onClick={() => setIsCreateNewPostClicked(false)}
            className="close-create-post-modal challenge-close-btn"
          />
        )}
        {/* Main challenge content */}
        <div className="challenge-content">
          {/* Header: badge, selection counter, and instructions */}
          <div className="cn-header">
            <div className="cn-header-top">
              <span className="cn-badge">📋 Community Note</span>
              <span className={`cn-counter${selectedStatements.length === requiredCorrectCount ? " ready" : ""}`}>
                {selectedStatements.length}/{requiredCorrectCount} {t("createPost.selected")}
              </span>
            </div>
            <p className="challenge-description">{challengeDescription}</p>
          </div>

          {/* Statement options: display shuffled statements with checkmark toggle */}
          <div className="statements-list">
            {statements.map((statement) => (
              <div
                key={statement.id}
                className={`statement-option ${
                  selectedStatements.includes(statement.id) ? "selected" : ""
                }`}
                onClick={() => handleStatementClick(statement.id)}
                role="checkbox"
                aria-checked={selectedStatements.includes(statement.id)}
              >
                {/* Checkbox: shows checkmark when selected */}
                <div className="statement-check">
                  {selectedStatements.includes(statement.id) && (
                    <span className="check">✓</span>
                  )}
                </div>
                <p className="statement-text">{statement.text}</p>
              </div>
            ))}
          </div>

          {/* Footer: publish button disabled until exact number of statements selected */}
          <div className="cn-footer">
            <div className="post-btn-container">
              <button
                onClick={handleSubmit}
                disabled={selectedStatements.length !== requiredCorrectCount}
                type="button"
              >
                {t("createPost.publishConclusion")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
