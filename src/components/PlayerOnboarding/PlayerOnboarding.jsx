import "./PlayerOnboarding.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
// Pre-test statements data (localized true/false statements for knowledge assessment)
import statementsData from "../../pages/CommunityNote/CommunityNoteStatements.json";
// Escapp puzzle submission (the pre-test is puzzle 1)
import { useEscapp } from "../../contexts/EscappProvider.jsx";
// Utility for resolving asset paths (videos, images, etc.)
import { assetPath } from "../../utils/assetPath";

/**
 * PlayerOnboarding Component
 *
 * Pre-game sequence shown after Escapp validation:
 * - Intro video 1
 * - Pre-test quiz (select the required true/false statements)
 * - Intro video 2
 *
 * Identity, timer and escape state are owned by Escapp. The language is fixed by
 * Escapp settings (already applied to i18n), so there is no name/age/language form.
 *
 * @param {Function} onComplete - Callback fired when onboarding completes
 * @returns {JSX.Element|null} Full-screen onboarding overlay, or null while loading
 */
export const PlayerOnboarding = ({ onComplete }) => {
  const { i18n, t } = useTranslation();
  const { submitChallenge } = useEscapp();

  // Language is fixed by Escapp settings (applied to i18n at boot).
  const selectedLanguage = i18n.resolvedLanguage || i18n.language || "es";

  // Current step: "loading" -> "intro1Video" -> "pretest" -> "intro2Video" -> complete
  const [step, setStep] = useState("loading");
  // Array of selected statement IDs from pre-test quiz
  const [selectedStatements, setSelectedStatements] = useState([]);
  // Tracks availability of intro1 and intro2 videos for the language (async probe results)
  const [videoAvailability, setVideoAvailability] = useState({ intro1: false, intro2: false });
  // Show play button overlay by default so user triggers video playback
  const [needsTapToPlay, setNeedsTapToPlay] = useState(true);
  // Track if intro videos are paused during playback
  const [isPaused, setIsPaused] = useState(false);

  // Translation helper - gets text in selectedLanguage with fallback to global t()
  const tx = (key, options = {}) => t(key, { lng: selectedLanguage, ...options });

  // Pre-test statements in selected language with fallback to English
  const statements = useMemo(
    () => statementsData[selectedLanguage] || statementsData.en || [],
    [selectedLanguage]
  );

  // Number of statements player must select correctly in pre-test
  const requiredSelections = useMemo(() => {
    const spanishStatements = statementsData.es || [];
    const totalCorrect = spanishStatements.filter((statement) => statement.correct).length;
    return totalCorrect > 0 ? totalCorrect : 2;
  }, []);

  // Pre-test quiz translations
  const moderatorFormTitle = t("playerOnboarding.moderatorFormTitle");
  const moderatorFormDescription = t("playerOnboarding.moderatorFormDescription", {
    lng: selectedLanguage,
    count: requiredSelections,
  });
  const moderatorFormSubmit = t("playerOnboarding.moderatorFormSubmit", { lng: selectedLanguage });

  /**
   * Builds absolute path to intro video file
   */
  const getVideoPath = (introNumber, language) => assetPath(`/assets/intro${introNumber}_${language}.mp4`);

  /**
   * Asynchronously probes if a video file exists and is loadable.
   */
  const checkVideoExists = async (path) => {
    const canUseDom = typeof window !== "undefined" && typeof document !== "undefined";
    if (!canUseDom) return false;

    return new Promise((resolve) => {
      const probeVideo = document.createElement("video");
      let finished = false;

      const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        probeVideo.removeAttribute("src");
        probeVideo.load();
        resolve(result);
      };

      // 5 second timeout — assume video exists if metadata is slow to load
      const timeoutId = window.setTimeout(() => finish(true), 5000);

      probeVideo.preload = "metadata";
      probeVideo.onloadedmetadata = () => finish(true);
      probeVideo.onerror = () => finish(false);
      probeVideo.src = path;
    });
  };

  // Save checkpoint so onboarding progress survives a page refresh
  const saveCheckpoint = (availability, savedStep = "pretest") => {
    sessionStorage.setItem("onboarding:checkpoint", JSON.stringify({
      language: selectedLanguage,
      videoAvailability: availability,
      step: savedStep,
    }));
  };

  /**
   * Marks onboarding as complete and hands control to the game.
   * Emits the signals MessagesProvider uses to show the initial briefing.
   */
  const completeOnboarding = () => {
    sessionStorage.removeItem("onboarding:checkpoint");
    // Clear social login session for a fresh game session
    sessionStorage.removeItem("socialLoginDone");
    // MessagesProvider reads this flag + the event to trigger the briefing toast.
    sessionStorage.setItem("playerData", JSON.stringify({ onboardingCompleted: true }));
    window.dispatchEvent(new Event("onboardingComplete"));
    onComplete();
  };

  // On mount: restore from checkpoint, or probe intro videos and pick the first step.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const raw = sessionStorage.getItem("onboarding:checkpoint");
      if (raw) {
        try {
          const cp = JSON.parse(raw);
          setVideoAvailability(cp.videoAvailability || { intro1: false, intro2: false });
          setStep(cp.step || "pretest");
          return;
        } catch {
          /* ignore corrupt checkpoint and re-probe */
        }
      }

      const [hasIntro1, hasIntro2] = await Promise.all([
        checkVideoExists(getVideoPath(1, selectedLanguage)),
        checkVideoExists(getVideoPath(2, selectedLanguage)),
      ]);
      if (cancelled) return;

      const availability = { intro1: hasIntro1, intro2: hasIntro2 };
      setVideoAvailability(availability);
      if (hasIntro1) {
        setStep("intro1Video");
      } else {
        saveCheckpoint(availability, "pretest");
        setStep("pretest");
      }
    };

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Toggle selection of a pre-test statement.
   */
  const handleStatementClick = (id) => {
    setSelectedStatements((prev) => {
      if (prev.includes(id)) {
        return prev.filter((statementId) => statementId !== id);
      }
      if (prev.length < requiredSelections) {
        return [...prev, id];
      }
      return prev;
    });
  };

  /**
   * Handles pre-test quiz submission. The pre-test is Escapp puzzle 1: the player's
   * selected statement IDs are sent to Escapp, which verifies them server-side.
   * Advance only when Escapp accepts the answer.
   */
  const handlePretestSubmit = () => {
    const selectedDetails = statements
      .filter((statement) => selectedStatements.includes(statement.id))
      .map((statement) => ({ id: statement.id, text: statement.text }));

    // Answer format: selected statement IDs, ascending, ';'-joined.
    const answer = [...selectedStatements].sort((a, b) => a - b).join(";");

    submitChallenge(1, answer, (success) => {
      if (!success) {
        toast.error(t("playerOnboarding.pretestIncorrect", "Some answers are incorrect. Try again."));
        return;
      }

      // Store pre-test answers in session for game referencing
      sessionStorage.setItem(
        "onboardingCommunityNoteAnswers",
        JSON.stringify({
          language: selectedLanguage,
          selectedStatementIds: selectedStatements,
          selectedStatements: selectedDetails,
          submittedAt: new Date().toISOString(),
        })
      );

      if (videoAvailability.intro2) {
        saveCheckpoint(videoAvailability, "intro2Video");
        setStep("intro2Video");
        return;
      }

      completeOnboarding();
    });
  };

  // Resolve full paths to intro videos
  const intro1Path = getVideoPath(1, selectedLanguage);
  const intro2Path = getVideoPath(2, selectedLanguage);

  // Refs for programmatic video playback (avoids muted autoplay restriction)
  const intro1VideoRef = useRef(null);
  const intro2VideoRef = useRef(null);

  // Conditional rendering checks - only show video if step AND video is available
  const isIntro1VideoStep = step === "intro1Video" && videoAvailability.intro1;
  const isIntro2VideoStep = step === "intro2Video" && videoAvailability.intro2;

  // Secret sequence listener: type "skip" to skip intro videos
  const skipSequenceRef = useRef("");
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isIntro1VideoStep || isIntro2VideoStep) {
        if (e.key && e.key.length === 1) {
          const nextSeq = (skipSequenceRef.current + e.key.toLowerCase()).slice(-4);
          skipSequenceRef.current = nextSeq;
          if (nextSeq === "skip") {
            if (isIntro1VideoStep) {
              saveCheckpoint(videoAvailability, "pretest");
              setStep("pretest");
            } else if (isIntro2VideoStep) {
              completeOnboarding();
            }
          }
        }
      } else {
        skipSequenceRef.current = "";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntro1VideoStep, isIntro2VideoStep, videoAvailability]);

  // Ensure play button overlay is shown when intro video steps are active (no autoplay)
  useEffect(() => {
    if (isIntro1VideoStep && intro1VideoRef.current) {
      setNeedsTapToPlay(true);
      setIsPaused(false);
      intro1VideoRef.current.load();
    }
  }, [isIntro1VideoStep]);

  useEffect(() => {
    if (isIntro2VideoStep && intro2VideoRef.current) {
      setNeedsTapToPlay(true);
      setIsPaused(false);
      intro2VideoRef.current.load();
    }
  }, [isIntro2VideoStep]);

  // Manage body class for video fullscreen to handle stacking context / z-index on mobile
  useEffect(() => {
    const isVideoActive = isIntro1VideoStep || isIntro2VideoStep;
    if (isVideoActive) {
      document.body.classList.add("video-fullscreen-active");
    } else {
      document.body.classList.remove("video-fullscreen-active");
    }
    return () => {
      document.body.classList.remove("video-fullscreen-active");
    };
  }, [isIntro1VideoStep, isIntro2VideoStep]);

  // Click/tap handler to toggle play/pause on the Intro 1 video
  const handleIntro1Click = () => {
    if (needsTapToPlay) return;
    if (intro1VideoRef.current) {
      if (intro1VideoRef.current.paused) {
        intro1VideoRef.current.play().catch(() => { });
        setIsPaused(false);
      } else {
        intro1VideoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // Click/tap handler to toggle play/pause on the Intro 2 video
  const handleIntro2Click = () => {
    if (needsTapToPlay) return;
    if (intro2VideoRef.current) {
      if (intro2VideoRef.current.paused) {
        intro2VideoRef.current.play().catch(() => { });
        setIsPaused(false);
      } else {
        intro2VideoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // Nothing to render while probing videos / deciding the first step
  if (step === "loading") {
    return null;
  }

  // Intro 1 video - plays first introduction video, advances to pretest when ends or errors
  if (isIntro1VideoStep) {
    return (
      <div
        className="onboarding-overlay onboarding-overlay-video"
        onClick={handleIntro1Click}
        style={{ cursor: "pointer" }}
      >
        <div className="phone-rotate-prompt">
          <div className="phone-icon-wrapper">
            <div className="phone-body-icon"></div>
          </div>
          <span className="phone-rotate-text">{tx("playerOnboarding.rotatePhoneMessage", "Rotate your phone")}</span>
        </div>
        {/* Full-screen video player for intro sequence */}
        <video
          ref={intro1VideoRef}
          className="onboarding-video-fullscreen"
          src={intro1Path}
          preload="auto"
          playsInline
          controls={false}
          webkit-playsinline="true"
          onLoadedData={(e) => { e.target.currentTime = 1.0; }}
          onEnded={() => {
            setIsPaused(false);
            saveCheckpoint(videoAvailability, "pretest");
            setStep("pretest");
          }}
          onError={() => {
            setIsPaused(false);
            saveCheckpoint(videoAvailability, "pretest");
            setStep("pretest");
          }}
        />
        {(needsTapToPlay || isPaused) && (
          <button
            className="onboarding-tap-to-play"
            onClick={(e) => {
              e.stopPropagation();
              if (needsTapToPlay) {
                setNeedsTapToPlay(false);
                if (intro1VideoRef.current) {
                  intro1VideoRef.current.currentTime = 0;
                  intro1VideoRef.current.play().catch(() => { });
                }
              } else if (isPaused) {
                setIsPaused(false);
                if (intro1VideoRef.current) {
                  intro1VideoRef.current.play().catch(() => { });
                }
              }
            }}
          >
            ▶
          </button>
        )}
      </div>
    );
  }

  // Intro 2 video - plays second introduction video, completes onboarding when ends or errors
  if (isIntro2VideoStep) {
    return (
      <div
        className="onboarding-overlay onboarding-overlay-video"
        onClick={handleIntro2Click}
        style={{ cursor: "pointer" }}
      >
        <div className="phone-rotate-prompt">
          <div className="phone-icon-wrapper">
            <div className="phone-body-icon"></div>
          </div>
          <span className="phone-rotate-text">{tx("playerOnboarding.rotatePhoneMessage", "Rotate your phone")}</span>
        </div>
        {/* Full-screen video player for second intro sequence */}
        <video
          ref={intro2VideoRef}
          className="onboarding-video-fullscreen"
          src={intro2Path}
          preload="auto"
          playsInline
          controls={false}
          webkit-playsinline="true"
          onLoadedData={(e) => { e.target.currentTime = 1.0; }}
          onEnded={() => {
            setIsPaused(false);
            completeOnboarding();
          }}
          onError={() => {
            setIsPaused(false);
            completeOnboarding();
          }}
        />
        {(needsTapToPlay || isPaused) && (
          <button
            className="onboarding-tap-to-play"
            onClick={(e) => {
              e.stopPropagation();
              if (needsTapToPlay) {
                setNeedsTapToPlay(false);
                if (intro2VideoRef.current) {
                  intro2VideoRef.current.currentTime = 0;
                  intro2VideoRef.current.play().catch(() => { });
                }
              } else if (isPaused) {
                setIsPaused(false);
                if (intro2VideoRef.current) {
                  intro2VideoRef.current.play().catch(() => { });
                }
              }
            }}
          >
            ▶
          </button>
        )}
      </div>
    );
  }

  // Pre-test quiz view
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container onboarding-container--wide">
        {step === "pretest" && (
          <div className="onboarding-step-content">
            {/* Quiz title and instructions */}
            <h2 className="onboarding-step-title">{moderatorFormTitle}</h2>
            <p className="onboarding-subtitle">{moderatorFormDescription}</p>

            {/* Progress counter showing selected/required statements */}
            <div className="onboarding-counter">
              {selectedStatements.length}/{requiredSelections} {tx("playerOnboarding.pretestCounter")}
            </div>

            {/* List of true/false statements to select from */}
            <div className="onboarding-statements-list">
              {statements.map((statement) => {
                const isSelected = selectedStatements.includes(statement.id);
                return (
                  <button
                    key={statement.id}
                    type="button"
                    className={`onboarding-statement ${isSelected ? "selected" : ""}`}
                    onClick={() => handleStatementClick(statement.id)}
                  >
                    <span className="onboarding-statement-check">{isSelected ? "✓" : ""}</span>
                    <span>{statement.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Submit button - only enabled when required number selected */}
            <button
              type="button"
              className="onboarding-submit"
              onClick={handlePretestSubmit}
              disabled={selectedStatements.length !== requiredSelections}
            >
              {moderatorFormSubmit}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
