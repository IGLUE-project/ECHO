import "./AIContent.css";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Header } from "../../components/Header/Header";
import { Navbar } from "../../components/Navbar/Navbar";
import { StatsPanel } from "../../components/StatsPanel/StatsPanel";
import { useMessages } from "../../contexts/MessagesProvider.jsx";
import { useStats } from "../../contexts/StatsProvider.jsx";
import { useEscapp } from "../../contexts/EscappProvider.jsx";
import aiContent from "./AIContent.json";
import { assetPath } from "../../utils/assetPath";

/**
 * Challenge 2 (AI Content Generated) game page.
 * Players reconstruct an AI-generated sentence by selecting correct words from shuffled options.
 * Multi-step flow: list → verify → video → brief → game.
 */
export const AIContent = () => {
  // Sidebar blocked during video playback (until video completes)
  const [sidebarBlocked, setSidebarBlocked] = useState(false);
  const { t } = useTranslation();
  const currentLang = t("langKey");
  const [hasLocalizedVideo, setHasLocalizedVideo] = useState(true);
  const localizedVideoSrc = useMemo(
    () => assetPath(`/assets/video_IA_${currentLang}.mp4`),
    [currentLang],
  );

  // Random sentence (persisted by index in sessionStorage). Changes by language; clamps if index goes out of range
  const gameData = useMemo(() => {
    const allSentences = aiContent[currentLang] || aiContent.en;

    const storedIdx = sessionStorage.getItem("echo:puzzle2:sentenceIndex");
    let idx;
    if (storedIdx !== null) {
      // Restore saved index, clamped if language changed and has fewer sentences
      idx = Math.min(Number(storedIdx), allSentences.length - 1);
    } else {
      idx =
        allSentences.length > 1
          ? Math.floor(Math.random() * allSentences.length)
          : 0;
      sessionStorage.setItem("echo:puzzle2:sentenceIndex", String(idx));
    }

    return allSentences[idx];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLang]);
  const { addMessage } = useMessages();
  const { challenge2Completed, completeChallenge2, setChallenge2Total, setChallenge2Progress } = useStats();
  const { submitChallenge, checkChallenge } = useEscapp();
  const completionSentRef = useRef(false);
  const videoRef = useRef(null);
  const playTimeoutRef = useRef(null);
  const [step, setStep] = useState("list");
  // Video watched flag (persisted in sessionStorage)
  const [videoEnded, setVideoEnded] = useState(() => {
    return sessionStorage.getItem("echo:puzzle2:videoViewed") === "true";
  });
  // Correctly selected words so far (builds the sentence step by step)
  const [selectedWords, setSelectedWords] = useState([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  // Wrong word selection during current step (used for visual feedback, clears after animation)
  const [wrongChoice, setWrongChoice] = useState(null);
  // Show play button overlay by default so user triggers video playback
  const [needsTapToPlay, setNeedsTapToPlay] = useState(true);
  // Track if video is paused during playback
  const [isPaused, setIsPaused] = useState(false);
  // Show reconstructed sentence vs. original post (delayed display after completion)
  const [showMatch, setShowMatch] = useState(false);
  // Shuffled answer options for each word position
  const optionsByStep = useMemo(
    () =>
      gameData.words.map((item) =>
        [item.correct, ...item.alts].sort(() => Math.random() - 0.5),
      ),
    [gameData],
  );
  // Player's sentence from selected words (punctuation moved to word boundaries)
  const reconstructedSentence = useMemo(
    () => selectedWords.join(" ").replace(/\s([.,!?;:])/g, "$1"),
    [selectedWords],
  );
  // Correct AI-generated sentence (from gameData)
  const correctSentence = useMemo(
    () =>
      gameData.words
        .map((item) => item.correct)
        .join(" ")
        .replace(/\s([.,!?;:])/g, "$1"),
    [gameData],
  );
  const isCompleted = selectedWords.length === gameData.words.length;
  // Can advance when video ends or no localized video exists
  const canAdvanceFromVideo = !hasLocalizedVideo || videoEnded;


  // Block sidebar during mandatory video watching
  useEffect(() => {
    if (step === "video" && !canAdvanceFromVideo) {
      setSidebarBlocked(true);
    } else {
      setSidebarBlocked(false);
    }
  }, [step, canAdvanceFromVideo]);

  // Update navbar badge: challenge has 1 task (complete the word reconstruction)
  useEffect(() => {
    setChallenge2Total(1);
    setChallenge2Progress(isCompleted ? 1 : 0);
  }, [isCompleted, setChallenge2Total, setChallenge2Progress]);

  // Lock body scroll while on this page
  useEffect(() => {
    document.body.classList.add("ai-content-no-scroll");
    document.documentElement.classList.add("ai-content-no-scroll");
    return () => {
      document.body.classList.remove("ai-content-no-scroll");
      document.documentElement.classList.remove("ai-content-no-scroll");
    };
  }, []);

  // Cleanup play timeout on unmount
  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
  }, []);

  // Delay showing sentence comparison (showMatch) after completion for visual effect
  useEffect(() => {
    if (!isCompleted) {
      setShowMatch(false);
      return;
    }

    const timer = setTimeout(() => setShowMatch(true), 260);
    return () => clearTimeout(timer);
  }, [isCompleted]);

  // Reset video status when language changes (forces fresh video load)
  useEffect(() => {
    setHasLocalizedVideo(true);
  }, [localizedVideoSrc]);

  // Secret sequence listener: type "skip" to skip AI video
  const skipSequenceRef = useRef("");
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (step === "video") {
        if (e.key && e.key.length === 1) {
          const nextSeq = (skipSequenceRef.current + e.key.toLowerCase()).slice(-4);
          skipSequenceRef.current = nextSeq;
          if (nextSeq === "skip") {
            sessionStorage.setItem("echo:puzzle2:videoViewed", "true");
            setVideoEnded(true);
            setStep("brief");
          }
        }
      } else {
        skipSequenceRef.current = "";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  // Ensure play button overlay is shown when video step is active (no autoplay)
  useEffect(() => {
    if (step === "video" && !videoEnded && videoRef.current) {
      setNeedsTapToPlay(true);
      setIsPaused(false);
      videoRef.current.load(); // Force load to trigger onLoadedData and show preview
    }
  }, [step, videoEnded]);

  // Manage body class for video fullscreen to handle stacking context / z-index on mobile
  useEffect(() => {
    const isMobileVideoActive = step === "video" && !videoEnded;
    if (isMobileVideoActive) {
      document.body.classList.add("video-fullscreen-active");
    } else {
      document.body.classList.remove("video-fullscreen-active");
    }
    return () => {
      document.body.classList.remove("video-fullscreen-active");
    };
  }, [step, videoEnded]);

  // Click/tap handler to toggle play/pause on the AI video
  const handleVideoClick = () => {
    if (needsTapToPlay || videoEnded) return;
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => { });
        setIsPaused(false);
      } else {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // Complete challenge, send Challenge 3 instructions message
  const handleCompletionClose = () => {
    setShowCompletionModal(false);
    completeChallenge2();
    sessionStorage.setItem("challenge3InstructionsSent", JSON.stringify(true));
    addMessage({
      fromKey: "messagesApp.author.name",
      subjectKey: "messagesApp.messages.challenge3.subject",
      contentKey: "messagesApp.messages.challenge3.content",
    });
    window.dispatchEvent(new Event("openDrawer"));
    window.dispatchEvent(new Event("bossMessage"));
  };

  // Submit puzzle 3 (Challenge 2) once the sentence is reconstructed, then show the modal.
  useEffect(() => {
    if (!isCompleted || challenge2Completed) return;

    // Fire-once guard: only submit on first render of completed state
    if (!completionSentRef.current) {
      completionSentRef.current = true;
    } else {
      return;
    }

    // This puzzle can only be completed correctly in-app; send a fixed token.
    submitChallenge(3, "AICONTENT", (success) => {
      if (success) setShowCompletionModal(true);
    });
  }, [isCompleted, challenge2Completed, submitChallenge]);

  // Handle word selection: validate and advance or reset
  const handleWordClick = (word) => {
    if (wrongChoice) return; // Ignore clicks during wrong answer animation
    const currentStep = selectedWords.length;
    const isCorrect = word === gameData.words[currentStep].correct;

    // Correct: add word and move to next step. Wrong: show animation and reset
    if (isCorrect) {
      setSelectedWords([...selectedWords, word]);
    } else {
      // Track the failed attempt in Escapp (records a wrong check without solving):
      // the words reconstructed so far plus the incorrect word just picked.
      const wrongAttempt = [...selectedWords, word].join(" ");
      checkChallenge(3, wrongAttempt);

      setWrongChoice({ step: currentStep, word });
      setTimeout(() => {
        setSelectedWords([]); // Reset all selections
        setWrongChoice(null);
      }, 550);
    }
  };

  return (
    <>
      <div className="app-container">
        <Navbar blocked={sidebarBlocked} />

        <main className="feed ai-content-feed">
          <div className="ai-content-page">
            <div className="ai-content-frame">
              {step === "list" ? (
                <>
                  {/* <div className="ai-content-title">
                    <h1>{t("aiContentPage.title")}</h1>
                    <p>{t("aiContentPage.subtitle")}</p>
                  </div> */}

                  <section className="ai-verify-panel">
                    <div className="ai-verify-header">
                      <h1>{t("aiVerifyPage.title")}</h1>
                      <p>{t("aiVerifyPage.subtitle")}</p>
                    </div>
                    {challenge2Completed ? (
                      <div className="ai-content-alert ai-content-alert--resolved">
                        <div className="ai-content-alert-left">
                          <span className="ai-alert-icon ai-alert-icon--ok">
                            ✓
                          </span>
                          <p>{t("aiContentPage.noPendingReview")}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="ai-content-alert">
                        <div className="ai-content-alert-left">
                          <span className="ai-alert-icon">!</span>
                          <p>
                            <strong>
                              {t("aiContentPage.pendingReviewCount", {
                                count: 1,
                              })}
                            </strong>{" "}
                            {t("aiContentPage.pendingReviewText")}
                          </p>
                        </div>
                        <button
                          className="ai-content-verify"
                          type="button"
                          onClick={() => setStep("verify")}
                        >
                          {t("aiContentPage.verifyButton")}
                        </button>
                      </div>
                    )}

                    <div className="ai-content-stats">
                      <span className="ai-content-check">✓</span>
                      <p>
                        <strong>
                          {t("aiContentPage.statsCount", { count: 24 })}
                        </strong>{" "}
                        {t("aiContentPage.statsText")}
                      </p>
                    </div>

                    <div className="ai-content-grid">
                      <article className="ai-content-card">
                        <div
                          className="ai-content-card-image"
                          style={{ backgroundImage: `url(${assetPath('/assets/willsmith.png')})` }}
                          aria-hidden="true"
                        />
                        <div className="ai-content-card-body">
                          <h3>{t("aiContentPage.card1Title")}</h3>
                          <span className="ai-content-tag">
                            {t("aiContentPage.tag")}
                          </span>
                        </div>
                      </article>

                      <article className="ai-content-card">
                        <div
                          className="ai-content-card-image"
                          style={{ backgroundImage: `url(${assetPath('/assets/madridonfire.jpg')})` }}
                          aria-hidden="true"
                        />
                        <div className="ai-content-card-body">
                          <h3>{t("aiContentPage.card2Title")}</h3>
                          <span className="ai-content-tag">
                            {t("aiContentPage.tag")}
                          </span>
                        </div>
                      </article>
                    </div>

                    <div className="ai-content-footer">
                      <button className="ai-content-seeall" type="button">
                        {t("aiContentPage.seeAll")}
                      </button>
                    </div>
                  </section>
                </>
              ) : step === "verify" ? (
                <section className="ai-verify-panel">
                  <div className="ai-verify-header">
                    <h1>{t("aiVerifyPage.title")}</h1>

                  </div>

                  <div className="ai-verify-card">
                    <div className="ai-verify-avatar" aria-hidden="true" />
                    <div className="ai-verify-body">
                      <div className="ai-verify-meta">
                        <span className="ai-verify-name">
                          {t("aiVerifyPage.postTitle")}
                        </span>
                        <span className="ai-verify-handle">@{t("aiVerifyPage.tweetAuthor", "quesofresco85")}@</span>
                        <span className="ai-verify-date">
                          {t("aiVerifyPage.postDate")}
                        </span>
                      </div>
                      <p className="ai-verify-blurred-text" aria-hidden="true">
                        {correctSentence}
                      </p>
                    </div>
                    <div className="ai-verify-stamp">
                      {t("aiVerifyPage.stamp")}
                    </div>
                  </div>

                  <p className="ai-verify-reminder">
                    {t("aiVerifyPage.reminder")}
                  </p>

                  <div className="ai-verify-actions">
                    <button
                      className="ai-verify-back"
                      type="button"
                      onClick={() => setStep("list")}
                    >
                      {t("aiVerifyPage.back")}
                    </button>
                    <button
                      className="ai-verify-start"
                      type="button"
                      onClick={() => setStep("video")}
                    >
                      {t("aiVerifyPage.start")}
                    </button>
                  </div>
                </section>
              ) : step === "video" ? (
                <section className="ai-video-panel">
                  <div className="ai-video-header">
                    <h1>{t("aiVideoPage.title")}</h1>
                    <p>{t("aiVideoPage.subtitle")}</p>
                  </div>

                  {hasLocalizedVideo && (
                    <div className="ai-video-wrapper">
                      <div
                        className={`ai-video-container ${(!needsTapToPlay && !videoEnded) ? "fullscreen-mobile-active" : ""}`}
                        onClick={handleVideoClick}
                        style={{ cursor: "pointer" }}
                      >
                        <video
                          ref={videoRef}
                          width="100%"
                          controls={false}
                          playsInline
                          preload="auto"
                          onEnded={() => {
                            sessionStorage.setItem("echo:puzzle2:videoViewed", "true");
                            setVideoEnded(true);
                            setIsPaused(false);
                          }}
                          onPlay={() => setVideoEnded(false)}
                          onLoadedData={(e) => { e.target.currentTime = 1.0; }}
                          onError={() => setHasLocalizedVideo(false)}
                          src={localizedVideoSrc}
                          style={{ borderRadius: (!needsTapToPlay && !videoEnded) ? 0 : 12, background: "#000" }}
                        />
                        {(needsTapToPlay || isPaused) && !videoEnded && (
                          <button
                            className="ai-tap-to-play"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (needsTapToPlay) {
                                setNeedsTapToPlay(false);
                                if (videoRef.current) {
                                  videoRef.current.currentTime = 0;
                                  // Add a little delay on mobile devices to let them rotate the phone
                                  const isMobile = window.innerWidth <= 956;
                                  const delay = isMobile ? 1500 : 0;
                                  if (playTimeoutRef.current) {
                                    clearTimeout(playTimeoutRef.current);
                                  }
                                  playTimeoutRef.current = setTimeout(() => {
                                    if (videoRef.current) {
                                      videoRef.current.play().catch(() => { });
                                    }
                                    playTimeoutRef.current = null;
                                  }, delay);
                                }
                              } else if (isPaused) {
                                setIsPaused(false);
                                if (videoRef.current) {
                                  videoRef.current.play().catch(() => { });
                                }
                              }
                            }}
                          >
                            ▶
                          </button>
                        )}
                        {videoEnded && (
                          <div className="ai-video-replay-overlay" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="ai-video-replay-btn"
                              type="button"
                              onClick={(e) => {
                                const video = e.currentTarget.closest(".ai-video-container").querySelector("video");
                                if (video) {
                                  video.currentTime = 0;
                                  video.play();
                                }
                              }}
                            >
                              ▶ {t("aiVideoPage.replayVideo")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="ai-video-actions">
                    <button
                      className="ai-verify-back"
                      type="button"
                      onClick={() => setStep("verify")}
                      disabled={!canAdvanceFromVideo}
                      style={!canAdvanceFromVideo ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                    >
                      {t("aiVideoPage.back")}
                    </button>
                    <button
                      className="ai-verify-start"
                      type="button"
                      onClick={() => setStep("brief")}
                      disabled={!canAdvanceFromVideo}
                      style={!canAdvanceFromVideo ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                    >
                      {t("aiVideoPage.nextStep")}
                    </button>
                  </div>
                </section>
              ) : step === "brief" ? (
                <section className="ai-brief">
                  <div className="ai-brief-header">
                    <h1>{t("aiChallengeBriefPage.title")}</h1>
                  </div>
                  <div className="ai-brief-panel">
                    <div className="ai-brief-left">
                      <div className="ai-brief-content">
                        <p className="ai-brief-system">
                          {t("aiChallengeBriefPage.systemMessage")
                            .split(/<strong>|<\/strong>/)
                            .map((text, i) =>
                              i % 2 === 0 ? (
                                text
                              ) : (
                                <strong key={i}>{text}</strong>
                              ),
                            )}
                        </p>

                        <p className="ai-brief-explanation">
                          {t("aiChallengeBriefPage.explanation")}
                        </p>

                        <p className="ai-brief-instructions">
                          {t("aiChallengeBriefPage.instructions")
                            .split(/<strong>|<\/strong>/)
                            .map((text, i) =>
                              i % 2 === 0 ? (
                                text
                              ) : (
                                <strong key={i}>{text}</strong>
                              ),
                            )}
                        </p>
                      </div>

                    </div>

                    <div className="ai-brief-right">
                      <div className="ai-brief-prompt-container">
                        <div className="ai-brief-badge">
                          {t("aiPrompt.suspiciousBadge")}
                        </div>
                        <div className="ai-brief-prompt-box">
                          <p>{gameData.prompt}</p>
                        </div>
                      </div>
                    </div>

                  </div>
                  <div className="ai-game-btn-container">
                    <button
                      className="ai-verify-back"
                      type="button"
                      onClick={() => setStep("video")}
                    >
                      {t("aiVideoPage.back")}
                    </button>
                    <button
                      className="ai-brief-button"
                      onClick={() => setStep("game")}
                    >
                      {t("aiChallengeBriefPage.buttonText")}
                    </button>
                  </div>
                </section>
              ) : step === "game" ? (
                <section className="ai-game-panel">
                  <div className="ai-game-header">
                    <h1>{t("aiGamePage.title")}</h1>
                    <p>{t("aiGamePage.subtitle")}</p>
                  </div>

                  <div className="ai-game-content">
                    <div className="ai-game-prompt-container">
                      <div className="ai-game-prompt">
                        <p className="ai-game-prompt-text">
                          {gameData.prompt}
                        </p>
                      </div>
                      <div className="ai-game-badge">
                        <span className="ai-game-badge-text">
                          {t("aiPrompt.suspiciousBadge")}
                        </span>
                      </div>
                    </div>

                    <div className="ai-game-words-container">
                      <b>{t("aiGamePage.ai", "AI")}:</b>
                      <div
                        className={`ai-game-sentence ${isCompleted ? "completed" : ""}`}
                      >
                        {isCompleted ? (
                          selectedWords.map((word, idx) => (
                            <div
                              key={idx}
                              className="ai-game-selected-word-group"
                              style={{ "--word-index": idx }}
                            >
                              <span className="ai-game-selected-word">
                                {word}
                              </span>
                              <span className="ai-game-word-percentage">
                                {gameData.words[idx].percentage}
                              </span>
                            </div>
                          ))
                        ) : (
                          <>
                            {selectedWords.slice(0, -1).map((word, idx) => (
                              <div
                                key={idx}
                                className="ai-game-selected-word-group"
                              >
                                <span className="ai-game-selected-word">
                                  {word}
                                </span>
                                <span className="ai-game-word-percentage">
                                  {gameData.words[idx].percentage}
                                </span>
                              </div>
                            ))}
                            <div className="ai-game-active-group">
                              {selectedWords.length > 0 && (
                                <div className="ai-game-selected-word-group">
                                  <span className="ai-game-selected-word">
                                    {selectedWords[selectedWords.length - 1]}
                                  </span>
                                  <span className="ai-game-word-percentage">
                                    {
                                      gameData.words[selectedWords.length - 1]
                                        .percentage
                                    }
                                  </span>
                                </div>
                              )}
                              <div className="ai-game-options-column">
                                {optionsByStep[selectedWords.length].map(
                                  (word) => (
                                    <button
                                      key={`${selectedWords.length}-${word}`}
                                      className={`ai-game-word-button ${wrongChoice?.step ===
                                        selectedWords.length &&
                                        wrongChoice?.word === word
                                        ? "wrong-word"
                                        : ""
                                        }`}
                                      onClick={() => handleWordClick(word)}
                                    >
                                      <span className="ai-game-word-text">
                                        {word}
                                      </span>
                                    </button>
                                  ),
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {showMatch && (
                        <div className="ai-game-match">
                          <p className="ai-game-match-label">{t("aiGamePage.coincidenceWithPost")}</p>
                          <article className="ai-game-match-card">
                            <div className="ai-game-match-avatar" aria-hidden="true" />
                            <div className="ai-game-match-content">
                              <div className="ai-game-match-meta">
                                <strong>{t("aiVerifyPage.postTitle", "Critical Thinking 🍅🌶️🥑")}</strong>
                                <span>@{t("aiVerifyPage.tweetAuthorHandle", "quesofresco85")}</span>
                                <span>{t("aiVerifyPage.postDate")}</span>
                              </div>
                              <p>{reconstructedSentence}</p>
                              <span className="ai-game-match-tag">{t("aiGamePage.postGeneratedWithAi")}</span>
                            </div>
                          </article>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ai-game-actions">
                    {!isCompleted && (
                      <button
                        className="ai-verify-back"
                        type="button"
                        onClick={() => setStep("brief")}
                      >
                        {t("aiGamePage.back")}
                      </button>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </main>

        {/* Panel de estadísticas lateral */}
        <aside className="stats-sidebar">
          <StatsPanel />
        </aside>
      </div>

      {showCompletionModal && (
        // Challenge complete modal (shows briefly before closing challenge)
        <div className="challenge-completion-overlay">
          <div className="challenge-completion-modal">
            <div className="challenge-completion-icon">🎉</div>
            <h3 className="challenge-completion-title">
              {t("aiGamePage.challengeCompleted")}
            </h3>
            <p className="challenge-completion-desc">
              {t("aiGamePage.challengeCompletedMsg")}
            </p>
            <button
              className="challenge-completion-close"
              onClick={handleCompletionClose}
            >
              {t("desktop.window.close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
