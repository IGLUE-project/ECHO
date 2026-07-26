import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStats } from "./StatsProvider.jsx";

/**
 * MessagesContext
 * 
 * React Context for managing messages from the security team (game instructions and hints).
 * Provides:
 * - Mission briefing message
 * - Challenge instructions for each puzzle (Challenge 1, 2, 3, and Final)
 * - Message read/unread state
 * - Toast notifications when new messages arrive
 *
 * Integrates with:
 * - SessionStorage for persisting message read status
 * - StatsProvider for marking challenge milestones as read
 */
const MessagesContext = createContext();

/**
 * useMessages Hook
 * 
 * Custom hook to access the messages context from any component.
 * 
 * Returns context object with:
 * - messages: Array of message objects
 * - unreadCount: Number of unread messages
 * - markAsRead(messageId): Function to mark a message as read
 * - addMessage(message): Function to add a new message
 * 
 * Usage:
 *   const { messages, unreadCount, markAsRead } = useMessages();
 * 
 * Throws error if used in a component not wrapped by MessagesProvider.
 * 
 * @returns {Object} Messages context containing state and functions
 * @throws {Error} If context not found (component not within MessagesProvider)
 */
export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error("useMessages must be used within MessagesProvider");
  }
  return context;
};


/**
 * Build initial messages array from sessionStorage state
 */
const buildInitialMessages = () => {
  const messages = [];
  let id = 1;

  // Mission brief is always present - initial game instructions
  const missionBriefRead = sessionStorage.getItem("missionBriefRead") === "true";
  messages.push({
    id: id++,
    fromKey: "messagesApp.author.name",
    subjectKey: "messagesApp.messages.missionBrief.subject",
    contentKey: "messagesApp.messages.missionBrief.content",
    timestamp: new Date(),
    read: missionBriefRead,
  });

  // Challenge 1 instructions (sent after user logs in to the social network)
  const challenge1InstructionsSent = sessionStorage.getItem("challenge1InstructionsSent");
  const challenge1InstructionsRead = sessionStorage.getItem("challenge1InstructionsRead");
  if (challenge1InstructionsSent) {
    messages.push({
      id: id++,
      fromKey: "messagesApp.author.name",
      subjectKey: "messagesApp.messages.challenge1.subject",
      contentKey: "messagesApp.messages.challenge1.content",
      timestamp: new Date(),
      read: challenge1InstructionsRead === "true",
    });
  }

  // Challenge 2 instructions (sent after completing challenge 1)
  const challenge2InstructionsSent = sessionStorage.getItem("challenge2InstructionsSent");
  const challenge2InstructionsRead = sessionStorage.getItem("challenge2InstructionsRead");
  if (challenge2InstructionsSent) {
    messages.unshift({
      id: id++,
      fromKey: "messagesApp.author.name",
      subjectKey: "messagesApp.messages.challenge2.subject",
      contentKey: "messagesApp.messages.challenge2.content",
      timestamp: new Date(),
      read: challenge2InstructionsRead === "true",
    });
  }

  // Challenge 3 instructions (sent after completing challenge 2)
  const challenge3InstructionsSent = sessionStorage.getItem("challenge3InstructionsSent");
  const challenge3InstructionsRead = sessionStorage.getItem("challenge3InstructionsRead");
  if (challenge3InstructionsSent) {
    messages.unshift({
      id: id++,
      fromKey: "messagesApp.author.name",
      subjectKey: "messagesApp.messages.challenge3.subject",
      contentKey: "messagesApp.messages.challenge3.content",
      timestamp: new Date(),
      read: challenge3InstructionsRead === "true",
    });
  }

  // Final challenge instructions (sent after completing challenge 3)
  const challengeFinalInstructionsSent = sessionStorage.getItem("challengeFinalInstructionsSent");
  const challengeFinalInstructionsRead = sessionStorage.getItem("challengeFinalInstructionsRead");
  if (challengeFinalInstructionsSent) {
    messages.unshift({
      id: id++,
      fromKey: "messagesApp.author.name",
      subjectKey: "messagesApp.messages.challengeFinal.subject",
      contentKey: "messagesApp.messages.challengeFinal.content",
      timestamp: new Date(),
      read: challengeFinalInstructionsRead === "true",
    });
  }

  return messages;
};

/**
 * MessagesProvider Component
 * 
 * Context provider for managing game messages and notifications.
 * 
 * Responsibilities:
 * - Initialize messages array from sessionStorage
 * - Track unread message count
 * - Handle marking messages as read
 * - Dispatch callbacks to StatsProvider for challenge milestone tracking
 * - Show toast notifications when new messages arrive or onboarding completes
 *
 * Integrations:
 * - SessionStorage: Persists message read status
 * - StatsProvider: Marks challenge instructions as read for stats tracking
 * - Window events: Listens for onboardingComplete, dispatches openDrawer and bossMessage
 * 
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Context provider wrapping children
 */
export const MessagesProvider = ({ children }) => {
  // Get translation function for multilingual message content
  const { t } = useTranslation();
  
  // Get functions to mark challenges as read in stats
  const {
    markChallenge1InstructionsRead,
    markChallenge2InstructionsRead,
    markChallenge3InstructionsRead,
    markChallengeFinalInstructionsRead,
  } = useStats();

  // Messages state: initialized from sessionStorage
  // Contains all message objects with id, fromKey, subjectKey, contentKey, timestamp, read
  const [messages, setMessages] = useState(() => buildInitialMessages());
  
  // Unread message count: updated whenever messages change
  // Used to display badge on Messages app icon in Taskbar
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Guard to prevent duplicate toast notifications
  // Set to true after first notification is shown
  const notificationShownRef = useRef(false);
  
  // Guard to prevent processing a message's read side effects more than once
  // Stores message IDs that have already been processed
  // Necessary because markAsRead can be called multiple times in React Strict Mode
  const processedRef = useRef(new Set());

  /**
   * Show mission/boss message toast notification
   * 
   * Dispatches window events to:
   * 1. "openDrawer" - Opens the Messages app drawer
   * 2. "bossMessage" - Triggers boss message toast animation
   * 
   * Only shows once per session (guarded by notificationShownRef)
   * to prevent notification spam.
   */
  const showMissionToast = () => {
    if (notificationShownRef.current) {
      return;
    }
    window.dispatchEvent(new Event("openDrawer"));
    window.dispatchEvent(new Event("bossMessage"));
    notificationShownRef.current = true;
  };

  /**
   * Effect: Show notification when onboarding completes or there are unread messages
   * 
   * Triggers:
   * 1. When "onboardingComplete" window event fires
   * 2. On mount if player has already completed onboarding and has unread messages
   * 
   * Shows the mission toast notification to alert player of pending messages.
   */
  useEffect(() => {
    const handleOnboardingComplete = () => {
      showMissionToast();
    };

    // Check if onboarding was already completed in a previous session
    const playerData = sessionStorage.getItem("playerData");
    if (playerData) {
      const data = JSON.parse(playerData);
      if (data.onboardingCompleted) {
        // Check if there are unread messages
        const hasUnread = messages.some((msg) => !msg.read);
        if (hasUnread) {
          showMissionToast();
        }
      }
    }

    // Listen for onboarding completion event during current session
    window.addEventListener("onboardingComplete", handleOnboardingComplete);
    return () => {
      window.removeEventListener("onboardingComplete", handleOnboardingComplete);
    };
  }, []);

  /**
   * Effect: Update unread message count whenever messages change
   * 
   * Counts messages with read: false
   * Updates Taskbar Messages app badge with this count
   */
  useEffect(() => {
    const count = messages.filter((msg) => !msg.read).length;
    setUnreadCount(count);
  }, [messages]);

  /**
   * Mark a message as read
   * 
   * Performs multiple actions:
   * 1. Updates message.read = true in state
   * 2. Saves read status to sessionStorage for persistence
   * 3. Dispatch to StatsProvider to mark challenge as read (for stats tracking)
   *
   * Special Handling by Message Type:
   * - Mission Brief: Saves to sessionStorage
   * - Challenge 1: Calls markChallenge1InstructionsRead()
   * - Challenge 2: Calls markChallenge2InstructionsRead()
   * - Challenge 3: Calls markChallenge3InstructionsRead()
   * - Final: Calls markChallengeFinalInstructionsRead()
   *
   * Prevents duplicate processing using processedRef guard (needed for React Strict Mode)
   *
   * @param {number} messageId - ID of the message to mark as read
   */
  const markAsRead = (messageId) => {
    const target = messages.find((msg) => msg.id === messageId);
    if (!target || target.read) return;

    // Guard: prevents duplicate side effects if markAsRead is called multiple times
    // before React processes the state update (e.g., in React Strict Mode)
    if (!processedRef.current.has(messageId)) {
      processedRef.current.add(messageId);

      // Handle each message type differently based on content
      if (target.contentKey === "messagesApp.messages.missionBrief.content") {
        // Mission Brief: Mark as read in sessionStorage
        sessionStorage.setItem("missionBriefRead", "true");
      }
      if (target.contentKey === "messagesApp.messages.challenge1.content") {
        // Challenge 1: Mark as read in StatsProvider
        markChallenge1InstructionsRead();
      }
      if (target.contentKey === "messagesApp.messages.challenge2.content") {
        // Challenge 2: Mark as read in StatsProvider
        markChallenge2InstructionsRead();
      }
      if (target.contentKey === "messagesApp.messages.challenge3.content") {
        // Challenge 3: Mark as read in StatsProvider
        markChallenge3InstructionsRead();
      }
      if (target.contentKey === "messagesApp.messages.challengeFinal.content") {
        // Final Challenge: Mark as read in StatsProvider
        markChallengeFinalInstructionsRead();
      }
    }

    // Update message read status in state
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, read: true } : msg))
    );
  };

  /**
   * Add a new message to the messages array
   * 
   * Process:
   * 1. Check if a message with the same contentKey already exists
   * 2. If already exists, skip adding (prevent duplicates)
   * 3. If new, generate unique ID and add to start of array
   * 4. Set read: false (new messages are always unread)
   * 5. Set timestamp: current date/time
   * 
   * Usage:
   * Called when a challenge is completed and new instructions are sent
   * (from StatsProvider or other components)
   * 
   * @param {Object} message - Message object to add
   * @param {string} message.fromKey - Translation key for sender name
   * @param {string} message.subjectKey - Translation key for subject
   * @param {string} message.contentKey - Translation key for content
   */
  const addMessage = (message) => {
    setMessages((prev) => {
      // Check if message with same contentKey already exists (prevent duplicates)
      const exists = prev.some((msg) => msg.contentKey === message.contentKey);
      if (exists) return prev;

      // Create new message with auto-generated ID, current timestamp, and unread status
      const newMessage = {
        ...message,
        id: Math.max(...prev.map((m) => m.id), 0) + 1,
        timestamp: new Date(),
        read: false,
      };
      return [newMessage, ...prev];
    });
  };

  // Context value: all state and functions available to consuming components
  const value = {
    messages,              // Array of message objects
    unreadCount,           // Count of unread messages
    markAsRead,            // Function to mark a message as read
    addMessage,            // Function to add a new message
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};
