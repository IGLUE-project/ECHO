import React, { createContext, useContext, useState, useEffect } from "react";
import { useEscapp } from "./EscappProvider.jsx";

// Context for game stats: threat metrics and challenge progress.
// The escape-room timer and final outcome are owned by Escapp (see EscappProvider);
// this provider only tracks per-challenge progress/completion and threat metrics.
const StatsContext = createContext();

// Custom hook to access stats context
export const useStats = () => {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error("useStats must be used within StatsProvider");
  }
  return context;
};

// Context provider for game stats and challenge progression.
export const StatsProvider = ({ children }) => {
  // Escapp-owned progress: number of puzzles solved (restored from the server).
  const { solvedCount } = useEscapp();

  // Initial threat metrics for the game
  const getInitialStats = () => ({
    botActivity: {
      percentage: 73,
      detected: 45,
    },
  });

  // Threat level metrics
  const [stats, setStats] = useState(getInitialStats());

  // Challenge 1 (Bot Detection) - persisted to sessionStorage
  const [challenge1Completed, setChallenge1Completed] = useState(() => {
    const saved = sessionStorage.getItem("challenge1Completed");
    return saved ? JSON.parse(saved) : false;
  });

  const [suspectUsersCount, setSuspectUsersCount] = useState(0);
  const [challenge1Progress, setChallenge1Progress] = useState(0);

  // Challenge 2 (AI Detection)
  const [challenge2Total, setChallenge2Total] = useState(1);
  const [challenge2Progress, setChallenge2Progress] = useState(0);

  // Challenge 3 (Content Moderation) - 3 harmful posts to moderate
  const [challenge3Total, setChallenge3Total] = useState(3);
  const [challenge3Progress, setChallenge3Progress] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ai-incorrect:sentReplies");
      return saved ? Object.keys(JSON.parse(saved)).length : 0;
    } catch { return 0; }
  });

  // Challenge 2 (AI Detection) - persisted to sessionStorage
  const [challenge2Completed, setChallenge2Completed] = useState(() => {
    const saved = sessionStorage.getItem("challenge2Completed");
    return saved ? JSON.parse(saved) : false;
  });

  // Challenge 3 (Content Moderation) - persisted to sessionStorage
  const [challenge3Completed, setChallenge3Completed] = useState(() => {
    const saved = sessionStorage.getItem("challenge3Completed");
    return saved ? JSON.parse(saved) : false;
  });

  // Final Challenge (Community Note) - persisted to sessionStorage
  const [challengeFinalCompleted, setChallengeFinalCompleted] = useState(() => {
    const saved = sessionStorage.getItem("challengeFinalCompleted");
    return saved ? JSON.parse(saved) : false;
  });

  // Instruction read tracking - persisted to sessionStorage
  const [challenge1InstructionsRead, setChallenge1InstructionsRead] = useState(() => {
    const saved = sessionStorage.getItem("challenge1InstructionsRead");
    return saved ? JSON.parse(saved) : false;
  });

  const [challenge2InstructionsRead, setChallenge2InstructionsRead] = useState(() => {
    const saved = sessionStorage.getItem("challenge2InstructionsRead");
    return saved ? JSON.parse(saved) : false;
  });

  const [challenge3InstructionsRead, setChallenge3InstructionsRead] = useState(() => {
    const saved = sessionStorage.getItem("challenge3InstructionsRead");
    return saved ? JSON.parse(saved) : false;
  });

  const [challengeFinalInstructionsRead, setChallengeFinalInstructionsRead] = useState(() => {
    const saved = sessionStorage.getItem("challengeFinalInstructionsRead");
    return saved ? JSON.parse(saved) : false;
  });

  // Reduce threat metrics as player completes challenges
  const reduceMisinformation = (percentage = 30) => {
    setStats((prev) => ({
      ...prev,
      botActivity: {
        ...prev.botActivity,
        percentage: Math.max(0, prev.botActivity.percentage - 25),
      },
    }));
  };

  // Mark Challenge 1 complete
  const completeChallenge1 = () => {
    setChallenge1Completed(true);
    sessionStorage.setItem("challenge1Completed", JSON.stringify(true));
  };

  // Mark Challenge 2 complete
  const completeChallenge2 = () => {
    setChallenge2Completed(true);
    sessionStorage.setItem("challenge2Completed", JSON.stringify(true));
  };

  // Mark Challenge 3 complete
  const completeChallenge3 = () => {
    setChallenge3Completed(true);
    sessionStorage.setItem("challenge3Completed", JSON.stringify(true));
  };

  // Mark final challenge complete. The success/fail outcome is determined by
  // Escapp (see EscappProvider.finalOutcome), not by a local timer.
  const completeChallengeFinal = () => {
    reduceMisinformation(78);
    setChallengeFinalCompleted(true);
    sessionStorage.setItem("challengeFinalCompleted", JSON.stringify(true));
  };

  // Restore progress from Escapp server state. Puzzles are solved in order: puzzle 1
  // is the pre-test, so the four challenges map onto puzzles 2..5. We also mark the
  // per-challenge "instructions read" gates so a returning player can navigate to the
  // challenge they're actually up to instead of being blocked by an earlier gate.
  useEffect(() => {
    if (solvedCount >= 2) { completeChallenge1(); markChallenge1InstructionsRead(); markChallenge2InstructionsRead(); }
    if (solvedCount >= 3) { completeChallenge2(); markChallenge3InstructionsRead(); }
    if (solvedCount >= 4) { completeChallenge3(); markChallengeFinalInstructionsRead(); }
    if (solvedCount >= 5) { completeChallengeFinal(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvedCount]);

  // Mark Challenge 1 instructions read
  const markChallenge1InstructionsRead = () => {
    setChallenge1InstructionsRead(true);
    sessionStorage.setItem("challenge1InstructionsRead", JSON.stringify(true));
  };

  // Mark Challenge 2 instructions read
  const markChallenge2InstructionsRead = () => {
    setChallenge2InstructionsRead(true);
    sessionStorage.setItem("challenge2InstructionsRead", JSON.stringify(true));
  };

  // Mark Challenge 3 instructions read
  const markChallenge3InstructionsRead = () => {
    setChallenge3InstructionsRead(true);
    sessionStorage.setItem("challenge3InstructionsRead", JSON.stringify(true));
  };

  // Mark Final Challenge instructions read
  const markChallengeFinalInstructionsRead = () => {
    setChallengeFinalInstructionsRead(true);
    sessionStorage.setItem("challengeFinalInstructionsRead", JSON.stringify(true));
  };

  const value = {
    // ===== THREAT STATISTICS =====
    stats,
    reduceMisinformation,

    // ===== CHALLENGE 1: BOT DETECTION =====
    suspectUsersCount,
    setSuspectUsersCount,
    challenge1Progress,
    setChallenge1Progress,
    challenge1Completed,
    completeChallenge1,

    // ===== CHALLENGE 2: AI DETECTION =====
    challenge2Total,
    setChallenge2Total,
    challenge2Progress,
    setChallenge2Progress,
    challenge2Completed,
    completeChallenge2,

    // ===== CHALLENGE 3: CONTENT MODERATION =====
    challenge3Total,
    setChallenge3Total,
    challenge3Progress,
    setChallenge3Progress,
    challenge3Completed,
    completeChallenge3,

    // ===== FINAL CHALLENGE: COMMUNITY NOTE =====
    challengeFinalCompleted,
    completeChallengeFinal,

    // ===== INSTRUCTIONS READ TRACKING =====
    challenge1InstructionsRead,
    markChallenge1InstructionsRead,
    challenge2InstructionsRead,
    markChallenge2InstructionsRead,
    challenge3InstructionsRead,
    markChallenge3InstructionsRead,
    challengeFinalInstructionsRead,
    markChallengeFinalInstructionsRead,
  };

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
};
