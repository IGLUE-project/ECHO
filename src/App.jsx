// App: root component - handles onboarding gating, desktop layout, and notifications.
// Identity, timer and escape state are owned by Escapp (see EscappProvider); the app
// tree is only rendered once the participant has been validated.

import React, { useState } from "react";
import "./App.css";
import { Desktop } from "./pages/Desktop/Desktop";  // Desktop OS interface
import { ScrollToTop } from "./components/ScrollToTop/ScrollToTop.jsx";  // Reset scroll on route change
import { Toaster } from "react-hot-toast";  // Notification system
import { PlayerOnboarding } from "./components/PlayerOnboarding/PlayerOnboarding";  // Intro videos + pretest
import { useTranslation } from "react-i18next";  // i18n support
import { useEscapp } from "./contexts/EscappProvider.jsx";  // Escapp progress (solved puzzles)

function App() {
  const { t } = useTranslation();
  // The pre-test is Escapp puzzle 1, so "≥ 1 puzzle solved" means onboarding is done.
  // This keeps onboarding in sync with Escapp: a returning player who already passed
  // the pre-test skips straight to the game, and a restart (0 solved) replays the intro.
  const { solvedCount } = useEscapp();

  // Initialize from Escapp's solved count at mount. Kept as local state (not reactive)
  // so solving the pre-test mid-onboarding doesn't cut off the closing intro video —
  // the onboarding flow itself flips this when it finishes.
  const [onboardingComplete, setOnboardingComplete] = useState(() => solvedCount >= 1);

  // Handle onboarding complete: proceed to the game
  const handleOnboardingComplete = () => {
    setOnboardingComplete(true);
  };

  return (
    <div className="App">
      <div className="phone-rotate-prompt-app">
        <div className="phone-icon-wrapper">
          <div className="phone-body-icon"></div>
        </div>
        <span className="phone-rotate-text">{t("desktop.rotatePhoneMessage", "Rotate your phone")}</span>
      </div>

      {/* Onboarding: intro videos + pretest, shown until completed */}
      {!onboardingComplete && <PlayerOnboarding onComplete={handleOnboardingComplete} />}

      {/* Scroll to top on route changes */}
      <ScrollToTop />

      {/* Desktop OS interface */}
      <Desktop />

      {/* Notifications */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          success: { duration: 1500 },
          error: { duration: 1500 },
        }}
        containerStyle={{
          top: "6rem",
          bottom: "80px",
        }}
      />
    </div>
  );
}

export default App;
