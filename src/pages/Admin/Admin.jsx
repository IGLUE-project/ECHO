import "./Admin.css";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';

import { useUser } from "../../contexts/UserProvider.jsx";
import { useLoggedInUser } from "../../contexts/LoggedInUserProvider.jsx";
import { useStats } from "../../contexts/StatsProvider.jsx";
import { useMessages } from "../../contexts/MessagesProvider.jsx";
import { useEscapp } from "../../contexts/EscappProvider.jsx";
import { useOS } from "../../contexts/OSProvider.jsx";
import { Navbar } from "../../components/Navbar/Navbar";
import { StatsPanel } from "../../components/StatsPanel/StatsPanel";
import { RxInfoCircled } from "../../utils/icons.jsx";
import { assetPath } from "../../utils/assetPath";

const CLASSIFICATION = {
    YES: 'yes',
    NO: 'no',
};

const normalizeClassification = (value) => {
    if (value === 'AI') return CLASSIFICATION.YES;
    if (value === 'Humano') return CLASSIFICATION.NO;
    return value;
};

/**
 * Challenge 1 (Bot Detection) game page.
 * Players classify 5 randomly selected users (3 bots + 2 humans).
 * Correct classifications unlock a quiz. Perfect score completes the challenge.
 */
export const Admin = () => {
    const { t } = useTranslation();
    const { userState } = useUser();
    const { reduceMisinformation, completeChallenge1, challenge1Completed, setSuspectUsersCount, setChallenge1Progress } = useStats();
    const { addMessage } = useMessages();
    const { submitChallenge, checkChallenge } = useEscapp();
    const navigate = useNavigate();
    // User classifications: { username: 'yes'|'no' } restored from sessionStorage on reload
    const [classifiedUsers, setClassifiedUsers] = useState(() => {
        const saved = sessionStorage.getItem('adminGameState');
        if (!saved) return {};
        const parsed = JSON.parse(saved);
        return Object.fromEntries(
            Object.entries(parsed).map(([uname, classification]) => [uname, normalizeClassification(classification)])
        );
    });
    // Quiz submission map: { username: true } - true means bot user passed quiz
    const [quizSubmittedByUser, setQuizSubmittedByUser] = useState(() => {
        const saved = sessionStorage.getItem('adminGameQuizState');
        if (!saved) return {};

        try {
            const parsed = JSON.parse(saved);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    });
    const [showHint, setShowHint] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [gameResult, setGameResult] = useState(null);
    const [isPerfectResult, setIsPerfectResult] = useState(false);
    const [isFirstVisit, setIsFirstVisit] = useState(() => !sessionStorage.getItem('echo:adminHintSeen:1'));

    const handleOpenHint = () => {
        setShowHint(true);
        if (isFirstVisit) {
            setIsFirstVisit(false);
            sessionStorage.setItem('echo:adminHintSeen:1', '1');
        }
    };

    const [suspectUsers, setSuspectUsers] = useState(() => []);

    // Randomly select 5 suspect users (3 bots + 2 humans). Persist by username so selection survives page reload
    useEffect(() => {
        if (challenge1Completed) {
            setSuspectUsers([]);
            return;
        }
        if (!userState?.allUsers?.length) return;

        // Try to restore previous selection from sessionStorage (key from usernames, not IDs which change in Mirage)
        const savedUsernames = sessionStorage.getItem('adminGameUsernames');
        if (savedUsernames) {
            try {
                const usernames = JSON.parse(savedUsernames);
                const restored = usernames
                    .map(uname => userState.allUsers.find(u => u.username === uname))
                    .filter(Boolean);
                if (restored.length === 5) {
                    setSuspectUsersCount(restored.length);
                    setSuspectUsers(restored);
                    return;
                }
            } catch (e) {
                console.error('Error restoring saved usernames:', e);
            }
        }

        // First visit: randomly select 3 bots and 2 humans
        const bots = userState.allUsers.filter(u => u.puzzle?.isBot === true);
        const humans = userState.allUsers.filter(u => u.puzzle?.isBot === false);

        const shuffledBots = [...bots].sort(() => Math.random() - 0.5);
        const shuffledHumans = [...humans].sort(() => Math.random() - 0.5);
        const pickedBots = shuffledBots.slice(0, 3);
        const pickedHumans = shuffledHumans.slice(0, 2);

        // Fixed arrangement so the correct real/fake sequence is constant ("10010",
        // 1 = real/human, 0 = fake/bot) and can be verified server-side by Escapp.
        // The account identities are still random; only their positions are fixed.
        const selected = [
            pickedHumans[0],
            pickedBots[0],
            pickedBots[1],
            pickedHumans[1],
            pickedBots[2],
        ].filter(Boolean);

        const selectedUsernames = selected.map(u => u.username);
        sessionStorage.setItem('adminGameUsernames', JSON.stringify(selectedUsernames));
        sessionStorage.removeItem('adminGameUsers');
        setSuspectUsersCount(selected.length);
        setSuspectUsers(selected);
    }, [userState?.allUsers, challenge1Completed]);

    // Save player's classifications to sessionStorage after each change
    useEffect(() => {
        sessionStorage.setItem('adminGameState', JSON.stringify(classifiedUsers));
    }, [classifiedUsers]);

    // Discard classifications for users no longer in the current game (in case Mirage reset changed user pool)
    useEffect(() => {
        if (suspectUsers.length > 0) {
            const currentUsernames = suspectUsers.map(u => u.username);
            const savedClassifications = Object.keys(classifiedUsers);
            const hasInvalidClassifications = savedClassifications.some(uname => !currentUsernames.includes(uname));
            if (hasInvalidClassifications) {
                const validClassifications = {};
                currentUsernames.forEach(uname => {
                    if (classifiedUsers[uname]) validClassifications[uname] = classifiedUsers[uname];
                });
                setClassifiedUsers(validClassifications);
                sessionStorage.setItem('adminGameState', JSON.stringify(validClassifications));
            }
        }
    }, [suspectUsers]);

    // Discard quiz submissions for users no longer in the game
    useEffect(() => {
        if (suspectUsers.length > 0) {
            const currentUsernames = suspectUsers.map(u => u.username);
            const savedQuizUsers = Object.keys(quizSubmittedByUser);
            const hasInvalidQuizUsers = savedQuizUsers.some(uname => !currentUsernames.includes(uname));

            if (hasInvalidQuizUsers) {
                const validQuizState = {};
                currentUsernames.forEach(uname => {
                    if (quizSubmittedByUser[uname]) validQuizState[uname] = true;
                });
                setQuizSubmittedByUser(validQuizState);
                sessionStorage.setItem('adminGameQuizState', JSON.stringify(validQuizState));
            }
        }
    }, [suspectUsers]);

    // Count correct classifications for navbar badge (bots must also pass quiz)
    useEffect(() => {
        if (suspectUsers.length === 0) return;
        const correctCount = suspectUsers.filter(user => {
            const classification = normalizeClassification(classifiedUsers[user.username]);
            const isBot = user?.puzzle?.isBot;
            const isClassificationCorrect =
                (classification === CLASSIFICATION.YES && isBot) ||
                (classification === CLASSIFICATION.NO && !isBot);
            if (!isClassificationCorrect) return false;
            // Bots: classification must be correct AND quiz passed
            if (isBot) return Boolean(quizSubmittedByUser[user.username]);
            return true;
        }).length;
        setChallenge1Progress(correctCount);
    }, [suspectUsers, classifiedUsers, quizSubmittedByUser, setChallenge1Progress]);

    // Track the player's in-progress classification in Escapp via checkPuzzle
    // (records the attempt without solving the puzzle). 1 = real/human, 0 = fake/bot,
    // _ = not yet classified. Sends only when the sequence changes.
    useEffect(() => {
        if (challenge1Completed || suspectUsers.length === 0) return;
        const seq = suspectUsers
            .map((u) => {
                const c = normalizeClassification(classifiedUsers[u.username]);
                if (c === CLASSIFICATION.NO) return "1";
                if (c === CLASSIFICATION.YES) return "0";
                return "_";
            })
            .join("");
        // Nothing classified yet, or unchanged since last send -> skip.
        if (!seq.includes("0") && !seq.includes("1")) return;
        if (sessionStorage.getItem("adminGameLastChecked") === seq) return;
        sessionStorage.setItem("adminGameLastChecked", seq);
        checkChallenge(2, seq);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classifiedUsers, suspectUsers, challenge1Completed]);

    // Navigate to user profile with game state marker
    const handleProfileClick = (username) => {
        sessionStorage.setItem('fromAdmin', 'true');
        navigate(`/profile/${username}`);
    };

    // The player can run the final check once every account has a classification, and
    // every account they flagged as a bot (that really is one) has its indicator quiz
    // done. Wrong classifications are allowed — Escapp decides right/wrong.
    const canCheck =
        suspectUsers.length > 0 &&
        suspectUsers.every((user) => {
            const label = classifiedUsers[user.username];
            if (!label) return false;
            if (normalizeClassification(label) === CLASSIFICATION.YES && user.puzzle?.isBot) {
                return Boolean(quizSubmittedByUser[user.username]);
            }
            return true;
        });

    // Submit the real/fake sequence for the 5 accounts (display order, 1 = real/human,
    // 0 = fake/bot) to Escapp for server-side verification.
    const handleCheck = () => {
        if (!canCheck || challenge1Completed) return;

        const answer = suspectUsers
            .map((u) => (normalizeClassification(classifiedUsers[u.username]) === CLASSIFICATION.NO ? "1" : "0"))
            .join("");

        submitChallenge(2, answer, (success) => {
            // Local label-correctness count, for the result modal's feedback only.
            const correct = suspectUsers.filter((u) => {
                const c = normalizeClassification(classifiedUsers[u.username]);
                return (c === CLASSIFICATION.YES && u.puzzle?.isBot) || (c === CLASSIFICATION.NO && !u.puzzle?.isBot);
            }).length;
            setGameResult({ correct, incorrect: suspectUsers.length - correct, total: suspectUsers.length });
            setIsPerfectResult(success);
            setShowResult(true);

            if (!success) return;

            // Correct: complete the challenge and queue the next briefing.
            reduceMisinformation(30);
            completeChallenge1();
            sessionStorage.removeItem('adminGameUsernames');
            sessionStorage.removeItem('adminGameState');
            sessionStorage.removeItem('adminGameQuizState');
            sessionStorage.removeItem('adminGameLastChecked');
            sessionStorage.removeItem('fromAdmin');
            setClassifiedUsers({});
            setQuizSubmittedByUser({});
            sessionStorage.setItem("challenge2InstructionsSent", JSON.stringify(true));
            addMessage({
                fromKey: "messagesApp.author.name",
                subjectKey: "messagesApp.messages.challenge2.subject",
                contentKey: "messagesApp.messages.challenge2.content",
            });
            window.dispatchEvent(new Event("openDrawer"));
            window.dispatchEvent(new Event("bossMessage"));
        });
    };

    // Close the result modal (used to retry after an incorrect check).
    const handleTryAgain = () => {
        setShowResult(false);
        setGameResult(null);
        setIsPerfectResult(false);
    };

    return (
        <>

            <div className="app-container">
                <Navbar />

                <main className="feed">
                    <div className="admin-container">
                        <div className="admin-header">
                            <h2>{t('admin.title')}</h2>
                        </div>

                        <div className="game-status">
                            <p>{t('admin.classified')}: {Object.keys(classifiedUsers).length} / {suspectUsers.length}</p>
                            <button className={`hint-button ${isFirstVisit ? 'hint-button--pulse' : ''}`} onClick={handleOpenHint}>
                                {t('admin.beforeStart')}
                            </button>
                        </div>

                        <div className="suspect-users-container">
                            {suspectUsers?.length ? (
                                suspectUsers?.map((user) => (
                                    <div
                                        key={user?.username}
                                        className="suspect-user-card"
                                    >
                                        <div
                                            onClick={() => handleProfileClick(user.username)}
                                            className="suspect-user-img-container"
                                        >
                                            <img src={assetPath(user?.avatarURL)} alt={user?.firstName} />
                                        </div>
                                        <div
                                            className="user-info"
                                            onClick={() => handleProfileClick(user.username)}
                                        >
                                            <p className="name">
                                                {user?.firstName} {user?.lastName}
                                                {user?.verified && (
                                                    <img
                                                        src={assetPath("/assets/verified_badge.png")}
                                                        alt={t('profile.verifiedAccount')}
                                                        className="verified-badge"
                                                        title={t('profile.verifiedAccount')}
                                                    />
                                                )}
                                            </p>
                                            <p className="username">@{user?.username}</p>
                                        </div>
                                        {classifiedUsers[user.username] && (
                                            <div className="classification-status" title={t('admin.classifiedMarker', 'Classified')}>
                                                <span aria-hidden="true">✓</span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="no-suspects">{t('admin.noSuspects')}</p>
                            )}
                        </div>

                        {suspectUsers.length > 0 && !challenge1Completed && (
                            <div className="admin-check-container">
                                <button
                                    className="admin-check-btn"
                                    onClick={handleCheck}
                                    disabled={!canCheck}
                                >
                                    {t('admin.checkAnswers', 'Check answers')}
                                </button>
                            </div>
                        )}
                    </div>
                </main>

                {/* Panel de estadísticas lateral */}
                <aside className="stats-sidebar">
                    <StatsPanel />
                </aside>
            </div>

            {showHint && (
                <div className="hint-modal-overlay" onClick={() => setShowHint(false)}>
                    <div className="hint-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="hint-modal-header">
                            <div className="hint-modal-title">
                              
                                <RxInfoCircled style={{ marginTop: '0.2rem', fontSize: '1.25rem', minWidth: "1rem", aspectRatio: "1/1" }} />
                                <h3>{t('admin.hintTitle')}</h3>
                            </div>    
                                <button className="close-button" onClick={() => setShowHint(false)}>×</button>
                            

                        </div>
                        <div className="hint-modal-content">
                            <ul>
                                <li><strong>{t('admin.hintContent.emotions').split(':')[0]}:</strong> {t('admin.hintContent.emotions').split(':')[1]}</li>
                                <li><strong>{t('admin.hintContent.targetAudience').split(':')[0]}:</strong> {t('admin.hintContent.targetAudience').split(':')[1]}</li>
                                <li><strong>{t('admin.hintContent.temporalActivity').split(':')[0]}:</strong> {t('admin.hintContent.temporalActivity').split(':')[1]}</li>
                                <li><strong>{t('admin.hintContent.abnormalRatio').split(':')[0]}:</strong> {t('admin.hintContent.abnormalRatio').split(':')[1]}</li>
                                <li><strong>{t('admin.hintContent.recentAccount').split(':')[0]}:</strong> {t('admin.hintContent.recentAccount').split(':')[1]}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {showResult && gameResult && (
                <div className="challenge-completion-overlay">
                    <div className="challenge-completion-modal">
                        <div className="challenge-completion-icon">
                            {isPerfectResult ? '🎉' : '❌'}
                        </div>
                        <h3 className="challenge-completion-title">
                            {isPerfectResult ? t('admin.perfectScore') : t('admin.resultTitle')}
                        </h3>
                        <p className="challenge-completion-desc">
                            {isPerfectResult ? t('admin.allCorrect') : t('admin.tryAgain')}
                        </p>
                        <p className="challenge-completion-desc">
                            {t('admin.score')}: {gameResult.correct} / {gameResult.total}
                        </p>
                        <button className={`challenge-completion-close${isPerfectResult ? '' : ' challenge-completion-close--error'}`} onClick={handleTryAgain}>
                            {isPerfectResult ? t('desktop.window.close') : t('admin.playAgain')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
