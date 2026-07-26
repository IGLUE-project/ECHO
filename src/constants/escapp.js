// Escapp client configuration for ECHO.
//
// ECHO is served/embedded by the Escapp platform. The escape room endpoint and
// runtime settings are injected by the Escapp environment at load time; the app
// only needs to declare which puzzles it is linked to and where the Escapp client
// images live.
export const ESCAPP_CLIENT_SETTINGS = {
  imagesPath: "./images/",
  linkedPuzzleIds: [1, 2, 3, 4, 5],
};

// The app sends the player's ACTUAL answer to Escapp, which verifies it against the
// solution configured for each puzzle in the authoring UI. These are the correct
// values you MUST configure (they are language-independent). Formats:
//  - Pre-test / Community Note: correct statement IDs, ascending, ';'-joined.
//  - Suspicious Accounts: one digit per account in the fixed on-screen order,
//    1 = real (human), 0 = fake (bot).
//  - AI-Generated Content: fixed token (this puzzle can only be completed correctly
//    in-app, so there is nothing meaningful to grade server-side).
//  - Incorrect Uses of AI: the chosen option's original index per case, ';'-joined
//    (the correct option is always index 0, so the solution is stable).
export const ESCAPP_PUZZLES = [
  { id: 1, solution: "1;3;6;8;9" },   // Pre-test (onboarding quiz)
  { id: 2, solution: "10010" },       // Challenge 1 – Suspicious Accounts
  { id: 3, solution: "AICONTENT" },   // Challenge 2 – AI-Generated Content
  { id: 4, solution: "0;0;0" },       // Challenge 3 – Incorrect Uses of AI
  { id: 5, solution: "1;3;6;8;9" },   // Challenge 4 – Community Note (final)
];
