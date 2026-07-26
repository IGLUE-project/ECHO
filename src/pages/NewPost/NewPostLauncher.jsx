import React, { useState } from "react";
import { useTranslation } from "react-i18next";
// Icons: feather icon for new post button
import { FaFeather } from "../../utils/icons.jsx";
// Components
import { CreatePostForm } from "../../components/CreatePostForm/CreatePostForm";
import { CommunityNote } from "../CommunityNote/CommunityNote.jsx";
// Context providers: challenge completion state
import { useStats } from "../../contexts/StatsProvider.jsx";
// Notification component for locked state messages
import { PopupNotification } from "../../components/PopupNotification/PopupNotification";

/**
 * NewPostLauncher: button to create new posts with challenge unlock gates
 * Features: conditional rendering based on challenge completion, Community Note modal, popup notifications
 * Tracks progress: used in puzzle 4 (Community Note challenge)
 */
export const NewPostLauncher = () => {
  // Multi-language support
  const { t } = useTranslation();
  // Get challenge completion status from context (gates post creation)
  const {
    challenge1Completed,
    challenge2Completed,
    challenge3Completed,
    challengeFinalCompleted,
    challengeFinalInstructionsRead,
  } = useStats();
  // UI state: toggle create post modal visibility
  const [isCreateNewPostClicked, setIsCreateNewPostClicked] = useState(false);
  // Popup state: display lock message when button is disabled
  const [popup, setPopup] = useState({
    visible: false,
    message: "",
    position: { top: 0, left: 0 },
  });

  // Determine lock message: show if challenges 1-3 incomplete OR final challenge incomplete without reading instructions
  let lockMessageKey = null;
  if (!challenge1Completed || !challenge2Completed || !challenge3Completed) {
    // Gate: user must complete challenges 1-3 before creating posts
    lockMessageKey = "desktop.popup.completeAllChallenges";
  } else if (!challengeFinalCompleted && !challengeFinalInstructionsRead) {
    // Gate: user must read final challenge instructions before accessing new post
    lockMessageKey = "desktop.popup.readMessageChallengeFinal";
  }

  // Derived state: button is locked if message key exists
  const isLocked = Boolean(lockMessageKey);
  // Show Community Note modal only when challenge 3 done and final not done
  const shouldShowCommunityNote = challenge3Completed && !challengeFinalCompleted;
  // Pulse animation on button when Community Note is ready
  const shouldPulseNewPost = shouldShowCommunityNote && !isLocked;

  // Handle button click: open post modal if unlocked, or show lock message popup
  const handleButtonClick = (event) => {
    if (!isLocked) {
      // Toggle modal visibility
      setIsCreateNewPostClicked((prev) => !prev);
      return;
    }

    // Button is locked: show popup message at button position
    const rect = event.currentTarget.getBoundingClientRect();
    const popupWidth = 280;
    setPopup({
      visible: true,
      message: t(lockMessageKey),
      position: {
        // Position popup above button, centered horizontally
        top: Math.max(50, rect.top - 60),
        left: Math.max(10, rect.left + rect.width / 2 - popupWidth / 2),
      },
    });
  };

  return (
    <>
      {/* New post button: locked/unlocked state, pulsing animation for challenge 4 */}
      <button
        className={`create-new-post-btn ${isLocked ? "is-locked" : ""} ${(challenge3Completed && !challengeFinalCompleted && challengeFinalInstructionsRead) ? "hint-button--pulse" : ""}`}
        onClick={handleButtonClick}
        type="button"
        aria-disabled={isLocked}
      >
        {/* Feather icon */}
        <FaFeather className="feather-icon" />
        {/* Button text: translated "New Post" label */}
        <span>{t("nav.newPost")}</span>
      </button>
      {/* Post creation modal: shows Community Note or standard post form */}
      {isCreateNewPostClicked && (
        <div className="create-post-modal">
          {shouldShowCommunityNote ? (
            // Puzzle 4: Community Note component (part of challenge final)
            <CommunityNote setIsCreateNewPostClicked={setIsCreateNewPostClicked} />
          ) : (
            // Standard: create post form
            <CreatePostForm
              className="modal-content"
              setIsCreateNewPostClicked={setIsCreateNewPostClicked}
            />
          )}
        </div>
      )}
      {/* Lock message popup: shown when button clicked and locked */}
      {popup.visible && (
        <PopupNotification
          message={popup.message}
          position={popup.position}
          onClose={() => setPopup((prev) => ({ ...prev, visible: false }))}
          duration={800}
        />
      )}
    </>
  );
};
