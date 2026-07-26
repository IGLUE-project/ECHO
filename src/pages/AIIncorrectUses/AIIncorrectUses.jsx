import "./AIIncorrectUses.css";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";

import { Header } from "../../components/Header/Header";
import { Navbar } from "../../components/Navbar/Navbar";
import { StatsPanel } from "../../components/StatsPanel/StatsPanel";
import { useUser } from "../../contexts/UserProvider.jsx";
import { useStats } from "../../contexts/StatsProvider.jsx";
import { useMessages } from "../../contexts/MessagesProvider.jsx";
import { useEscapp } from "../../contexts/EscappProvider.jsx";
import challengeData from "./AIIncorrectUses.json";
import { assetPath } from "../../utils/assetPath";

// Fisher-Yates shuffle algorithm
const shuffleArray = (items) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Format ISO date to (e.g., "Jan 15, 2026")
const formatDate = (iso) => {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Normalize and parse AI correctness: 'yes'/'true'/'ok'/'1'/'sí'→true, 'no'/'false'/'0'→false, else null
const parseAiOk = (value) => {
    if (typeof value === "boolean") return value;
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    if (["si", "sí", "yes", "true", "ok", "1"].includes(normalized)) return true;
    if (["no", "false", "0"].includes(normalized)) return false;
    return null;
};

// Pick 3 cases: guarantee at least 1 with aiOk=true and 1 with aiOk=false, plus 1 random. Fallback to random 3
const pickThreeCasesWithAiConstraint = (allCases) => {
    if (allCases.length <= 3) return allCases;

    const yesCases = allCases.filter((item) => parseAiOk(item.aiOk) === true);
    const noCases = allCases.filter((item) => parseAiOk(item.aiOk) === false);

    // Cannot meet constraint → pick 3 random cases
    if (yesCases.length === 0 || noCases.length === 0) {
        return shuffleArray(allCases).slice(0, 3);
    }

    const firstYes = shuffleArray(yesCases)[0];
    const firstNo = shuffleArray(noCases)[0];
    const baseSelection = [firstYes, firstNo];

    const remainingPool = allCases.filter(
        (item) => !baseSelection.some((selected) => selected.id === item.id)
    );
    const third = shuffleArray(remainingPool)[0];

    if (!third) return shuffleArray(baseSelection);
    return shuffleArray([...baseSelection, third]);
};

// Safe JSON.parse for sessionStorage array data, returns [] on parse error
const parseStoredArray = (value) => {
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

// Filter object to keep only entries matching selectedIds (remove stale case data)
const keepOnlySelectedCaseKeys = (record, selectedIds) => {
    if (!record || typeof record !== "object") return {};
    return Object.fromEntries(
        Object.entries(record).filter(([caseId]) => selectedIds.includes(caseId))
    );
};

/**
 * Challenge 3 (AI Incorrect Uses) game page.
 * Players review case studies of AI misuse and formulate correct community responses.
 * Tracks correct answers, wrong attempts, and submitted replies per case.
 */
export const AIIncorrectUses = () => {
    const { t } = useTranslation();
    const currentLang = t("langKey");
    const { userState } = useUser();
    const { challenge3Completed, completeChallenge3, setChallenge3Total, setChallenge3Progress } = useStats();
    const { addMessage } = useMessages();
    const { submitChallenge } = useEscapp();
    const completionSentRef = useRef(false);
    // Currently open case in modal
    const [activeCaseId, setActiveCaseId] = useState(null);
    // Player's selected option per case: { caseId: optionId }. Any option can be
    // selected (right or wrong) — correctness is verified server-side by Escapp.
    const [selectedOptions, setSelectedOptions] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem("ai-incorrect:selectedOptions") || "null") || {}; } catch { return {}; }
    });
    // Submitted replies by case: { caseId: true }
    const [sentReplies, setSentReplies] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem("ai-incorrect:sentReplies") || "null") || {}; } catch { return {}; }
    });
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    // 3 random cases (selected once per language, persisted by ID)
    const challengeCases = useMemo(() => {
        const allCases = challengeData[currentLang] || challengeData.en || [];
        if (allCases.length <= 3) return allCases;

        const selectionKey = `ai-incorrect:caseSelection:${currentLang}`;
        const casesById = new Map(allCases.map((item) => [item.id, item]));
        const storedSelection = parseStoredArray(sessionStorage.getItem(selectionKey));
        const restoredCases = storedSelection
            .map((id) => casesById.get(id))
            .filter(Boolean);

        // Restore previously selected cases
        if (restoredCases.length === 3) {
            return restoredCases;
        }

        // First visit: pick 3 new cases
        const picked = pickThreeCasesWithAiConstraint(allCases);
        sessionStorage.setItem(selectionKey, JSON.stringify(picked.map((c) => c.id)));
        return picked;
    }, [currentLang]);
    // Shuffled answer options per case: preserves uniqueness via optionId
    const shuffledOptionsByCase = useMemo(() => {
        return challengeCases.reduce((acc, item) => {
            const optionsWithId = (item.options || []).map((option, index) => ({
                ...option,
                optionId: `${item.id}-${index}`,
            }));
            acc[item.id] = shuffleArray(optionsWithId);
            return acc;
        }, {});
    }, [challengeCases]);

    // Clean stale state for cases no longer in the game (after case re-selection)
    useEffect(() => {
        const selectedIds = challengeCases.map((item) => item.id);

        const normalizedSelectedOptions = keepOnlySelectedCaseKeys(selectedOptions, selectedIds);
        if (Object.keys(normalizedSelectedOptions).length !== Object.keys(selectedOptions).length) {
            setSelectedOptions(normalizedSelectedOptions);
            sessionStorage.setItem("ai-incorrect:selectedOptions", JSON.stringify(normalizedSelectedOptions));
        }

        const normalizedSentReplies = keepOnlySelectedCaseKeys(sentReplies, selectedIds);
        if (Object.keys(normalizedSentReplies).length !== Object.keys(sentReplies).length) {
            setSentReplies(normalizedSentReplies);
            sessionStorage.setItem("ai-incorrect:sentReplies", JSON.stringify(normalizedSentReplies));
        }
    }, [challengeCases]);
    
    useEffect(() => {
        document.body.classList.add("ai-incorrect-no-scroll");
        document.documentElement.classList.add("ai-incorrect-no-scroll");

        return () => {
            document.body.classList.remove("ai-incorrect-no-scroll");
            document.documentElement.classList.remove("ai-incorrect-no-scroll");
        };
    }, []);

    // Update navbar badge: progress = count of submitted replies
    useEffect(() => {
        setChallenge3Total(challengeCases.length);
        setChallenge3Progress(Object.keys(sentReplies).length);
    }, [challengeCases.length, sentReplies, setChallenge3Total, setChallenge3Progress]);

    // Complete challenge, send final message to player
    const handleCompletionClose = () => {
        setShowCompletionModal(false);
        completeChallenge3();
        sessionStorage.setItem("challengeFinalInstructionsSent", JSON.stringify(true));
        addMessage({
            fromKey: "messagesApp.author.name",
            subjectKey: "messagesApp.messages.challengeFinal.subject",
            contentKey: "messagesApp.messages.challengeFinal.content",
        });
        window.dispatchEvent(new Event("openDrawer"));
        window.dispatchEvent(new Event("bossMessage"));
    };

    // Detect completion: all cases replied -> submit the player's ACTUAL choices to
    // Escapp for server-side verification. Escapp accepts only if every choice is
    // correct; otherwise the player redoes the cases.
    useEffect(() => {
        const totalCases = challengeCases.length;
        const completedCases = Object.keys(sentReplies).length;

        if (completedCases === totalCases && totalCases > 0 && !challenge3Completed) {
            // Fire-once guard on first completion detection
            if (!completionSentRef.current) {
                completionSentRef.current = true;
            } else {
                return;
            }

            // Answer: the chosen option's ORIGINAL index per case, in case order,
            // ';'-joined (optionId is `${caseId}-${index}`). Correct answer is "0;0;0".
            const answer = challengeCases
                .map((c) => {
                    const optionId = selectedOptions[c.id];
                    const idx = optionId ? Number(String(optionId).split("-").pop()) : -1;
                    return Number.isFinite(idx) ? idx : -1;
                })
                .join(";");

            submitChallenge(4, answer, (success) => {
                if (success) {
                    setShowCompletionModal(true);
                    return;
                }
                // Escapp rejected the answers: let the player try again.
                toast.error(t("aiIncorrectUsesPage.incorrectAnswers", "Some responses are incorrect. Review the cases and try again."));
                completionSentRef.current = false;
                setSentReplies({});
                setSelectedOptions({});
                sessionStorage.setItem("ai-incorrect:sentReplies", JSON.stringify({}));
                sessionStorage.setItem("ai-incorrect:selectedOptions", JSON.stringify({}));
            });
        }
    }, [sentReplies, challengeCases, challenge3Completed, submitChallenge, selectedOptions, t]);

    // Modal context: active case and its display state
    const activeCase = challengeCases.find((item) => item.id === activeCaseId) || null;
    const activeCaseOptions = activeCase ? (shuffledOptionsByCase[activeCase.id] || []) : [];
    // Enable "send" as soon as the player has selected any option for this case.
    const canSendReply = activeCaseId ? Boolean(selectedOptions[activeCaseId]) : false;

    // Text of the option the player selected for a case (shown as their submitted reply).
    const chosenOptionText = (caseItem) => {
        const optionId = selectedOptions[caseItem.id];
        if (!optionId) return "";
        const idx = Number(String(optionId).split("-").pop());
        return caseItem.options?.[idx]?.text || "";
    };

    // ECHO official account (fallback: try to find ECHO user, then default avatar)
    const echoOfficialUser = {
        _id: "echo-official",
        firstName: t("officialAccount.name") || "ECHO Official Account",
        lastName: "",
        username: "ECHO",
        avatarURL: "/assets/echo-logo-bg.png"
    }
        userState?.allUsers?.find((user) => user.username === "ECHO") || userState?.allUsers?.[0];

    // Select an answer option (no correctness feedback — Escapp verifies it later).
    const handleOptionClick = (optionId) => {
        if (!activeCase) return;
        const next = { ...selectedOptions, [activeCase.id]: optionId };
        setSelectedOptions(next);
        sessionStorage.setItem("ai-incorrect:selectedOptions", JSON.stringify(next));
    };

    // Submit reply: record that this case has been answered and close the modal.
    const handleSendReply = () => {
        if (!activeCase || !canSendReply) return;
        const next = { ...sentReplies, [activeCase.id]: true };
        setSentReplies(next);
        sessionStorage.setItem("ai-incorrect:sentReplies", JSON.stringify(next));
        setActiveCaseId(null); // Close modal
    };

   

    return (
        <>
        
            <div className="app-container">
                <Navbar />

                <main className="feed ai-incorrect-feed">
                    <div className="ai-incorrect-uses-page">
                        <section className="ai-incorrect-panel">
                            <div className="ai-incorrect-panel-header">
                                <header className="ai-incorrect-header">
                                    <h1>{t("aiIncorrectUsesPage.title")}</h1>
                                    <p>{t("aiIncorrectUsesPage.subtitle")}</p>
                                </header>
                                <p className="ai-incorrect-instruction">{t("aiIncorrectUsesPage.instruction")}</p>
                            </div>

                            <div className="ai-incorrect-list">
                                {/* Map through shuffled AI misuse cases and display each as a card */}
                                {challengeCases.map((item) => (
                                    <article key={item.id} className="ai-incorrect-post-card list-item">
                                        {/* Case avatar image */}
                                        <div className="x-avatar">
                                            <img src={assetPath(item.post?.image || echoOfficialUser?.avatarURL)} alt={item.post.name} />
                                        </div>
                                        <div className="x-post-main">
                                            {/* Display case metadata: author name, handle, and post date */}
                                            <div className="ai-incorrect-post-meta">
                                                <span className="ai-incorrect-post-name">{item.post.name}</span>
                                                <span className="ai-incorrect-post-handle">{item.post.handle}</span>
                                                <span className="ai-incorrect-post-handle">{formatDate(item.post.date)}</span>
                                            </div>
                                            <p className="ai-incorrect-post-text">{item.post.text}</p>
                                            {/* Display case image if present */}
                                            {item.post?.postImage && (
                                                <div className="ai-incorrect-post-image-wrap">
                                                    <img className="ai-incorrect-post-image" src={assetPath(item.post.postImage)} alt={item.post.name} />
                                                </div>
                                            )}
                                            {/* Show ECHO's official community response if player submitted their reply */}
                                            {sentReplies[item.id] && (
                                                <div className="thread-reply-card">
                                                    <div className="x-avatar reply-avatar">
                                                        <img
                                                            src={assetPath(echoOfficialUser?.avatarURL)}
                                                            alt={"ECHO"}
                                                        />
                                                    </div>
                                                    <div className="x-post-main">
                                                        <div className="ai-incorrect-post-meta">
                                                            <span className="ai-incorrect-post-name">
                                                                {t("officialAccount.name") || "ECHO Official Account"}
                                                            </span>
                                                            <span className="ai-incorrect-post-handle">
                                                                {t("officialAccount.handle") || "@ECHO"}
                                                            </span>
                                                        </div>
                                                        {/* Display the response the player submitted for this case */}
                                                        <p className="ai-incorrect-post-text">
                                                            {chosenOptionText(item)}
                                                        </p>
                                                        <p className="ai-incorrect-sent">{t("aiIncorrectUsesPage.sent")}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="post-actions-bar">
                                                {/* Reply button: opens modal with multiple choice options for this case */}
                                                <button
                                                    type="button"
                                                    className="reply-open-btn"
                                                    onClick={() => {
                                                        // Open modal for this case
                                                        setActiveCaseId(item.id);
                                                    }}
                                                >
                                                    💬 {t("aiIncorrectUsesPage.reply")}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>
                </main>

                {/* Stats sidebar with challenge progress badge */}
                <aside className="stats-sidebar">
                    <StatsPanel />
                </aside>
            </div>

            {/* Modal overlay: display when player clicks reply button on a case */}
            {activeCase && (
                <div className="reply-modal-backdrop" onClick={() => setActiveCaseId(null)}>
                    <div className="reply-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Modal close button */}
                        <button className="reply-modal-close" type="button" onClick={() => setActiveCaseId(null)}>
                            ×
                        </button>

                        {/* Show original post from the AI misuse case at top of modal */}
                        <article className="ai-incorrect-post-card x-post modal-top-post">
                            <div className="x-avatar">
                                <img src={assetPath(activeCase.post?.image || echoOfficialUser?.avatarURL)} alt={activeCase.post.name} />
                            </div>
                            <div className="x-post-main">
                                <div className="ai-incorrect-post-meta">
                                    <span className="ai-incorrect-post-name">{activeCase.post.name}</span>
                                    <span className="ai-incorrect-post-handle">{activeCase.post.handle}</span>
                                    <span className="ai-incorrect-post-handle">{formatDate(activeCase.post.date)}</span>
                                </div>
                                <p className="ai-incorrect-post-text">{activeCase.post.text}</p>
                                {activeCase.post?.postImage && (
                                    <div className="ai-incorrect-post-image-wrap">
                                        <img className="ai-incorrect-post-image" src={assetPath(activeCase.post.postImage)} alt={activeCase.post.name} />
                                    </div>
                                )}
                            </div>
                        </article>

                        <div className="x-reply-section modal-reply">
                            {/* ECHO moderator avatar */}
                            <div className="x-avatar moderator">
                                <img
                                    src={assetPath(activeCase.officialPost?.image || echoOfficialUser?.avatarURL)}
                                    alt={echoOfficialUser?.firstName || "ECHO"}
                                />
                            </div>
                            <div className="x-reply-main">
                                {/* Moderator name and handle */}
                                <div className="ai-incorrect-reply-meta">
                                    <strong>
                                        {activeCase.officialPost?.name ||
                                            `${echoOfficialUser?.firstName || ""} ${echoOfficialUser?.lastName || ""}`.trim()}
                                    </strong>&nbsp;&nbsp;
                                    <span>
                                        {activeCase.officialPost?.handle ||
                                            `@${echoOfficialUser?.username || "ECHO"}`}
                                    </span>&nbsp;&nbsp;
                                    <span className="ai-incorrect-post-handle">{formatDate(activeCase.post.date)}</span>
                                </div>
                                <p className="x-reply-helper">{t("aiIncorrectUsesPage.instruction")}</p>

                                {/* Multiple choice options for this case. Selecting one just
                                    highlights it; correctness is verified server-side on submit. */}
                                <div className="ai-incorrect-options">
                                    {activeCaseOptions.map((option) => (
                                        <button
                                            key={option.optionId}
                                            className={`ai-incorrect-option ${
                                                selectedOptions[activeCase.id] === option.optionId ? "selected-option" : ""
                                            }`}
                                            onClick={() => handleOptionClick(option.optionId)}
                                            type="button"
                                        >
                                            {option.text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="reply-modal-actions">
                            {/* Send reply button: disabled until correct answer is selected */}
                            <button type="button" className="reply-send-btn" disabled={!canSendReply} onClick={handleSendReply}>
                                {t("aiIncorrectUsesPage.reply")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Completion modal: shown briefly when all 3 cases are completed */}
            {showCompletionModal && (
                <div className="challenge-completion-overlay">
                    <div className="challenge-completion-modal">
                        <div className="challenge-completion-icon">🎉</div>
                        <h3 className="challenge-completion-title">{t("aiIncorrectUsesPage.challengeCompleted")}</h3>
                        <p className="challenge-completion-desc">{t("aiIncorrectUsesPage.challengeCompletedMsg")}</p>
                        <button className="challenge-completion-close" onClick={handleCompletionClose}>
                            {t("desktop.window.close")}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
