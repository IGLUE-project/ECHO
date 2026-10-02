# ECHO - Social Media Escape Room

ECHO is an educational web application of the escape room type, designed to be served and embedded by [Escapp](https://github.com/iglue-project/escapp), an open-source web platform for creating and conducting educational escape rooms. It simulates a desktop with several internal apps and a social network where the player acts as a content moderator to solve challenges about digital misinformation and artificial intelligence.

The project is built with React + Vite, uses MirageJS as a simulated in-memory backend for the social network, and i18next for internationalization. Player identity, the escape timer, and puzzle verification are handled by Escapp.

## Escapp Integration

ECHO runs as an Escapp escape room. Escapp owns identity, the countdown timer, and the server-side state of the escape room; the app declares which puzzles it is linked to and submits the player's answers for verification.

- **Client bootstrap.** `EscappProvider` instantiates the Escapp client on mount using `ESCAPP_CLIENT_SETTINGS` (linked puzzle IDs `1..5`). The app renders nothing until `client.validate()` confirms the participant.
- **Puzzle submission.** Answers are sent to Escapp, which grades them against the solutions configured in the authoring UI:
  - `submitChallenge(puzzleId, solution)` submits a final answer via `escapp.submitPuzzle()`.
  - `checkChallenge(puzzleId, solution)` records intermediate/partial attempts via `escapp.checkPuzzle()` without solving the puzzle.
- **Progress restore.** The number of solved puzzles (`client.getSolvedPuzzles()`) is used to restore game state on reload, and `client.getAllPuzzlesSolved()` determines the success/fail outro.
- **Callbacks.** The app reacts to timer changes (including running out of time) and to escape-room restarts, clearing local state and reloading when Escapp restarts the room.
- **Settings injection.** In production the Escapp server injects `window.ESCAPP_APP_SETTINGS` (locale + escape room endpoint) into the page. For local development, a Vite plugin injects the same object from a git-ignored `config.mjs`.

> Note: there is **no xAPI / LRS** integration in this app. All learning and progress data is recorded server-side by Escapp.

## Game Flow

Identity and language come from Escapp; there is no in-app name/age/language form.

1. Escapp validates the participant and provides the locale and escape room endpoint.
2. The app plays the first introductory video (if available for the language).
3. The player answers a pretest (Escapp puzzle 1) based on the phrases from the final challenge; answers are verified by Escapp.
4. The second introductory video plays.
5. The escape timer (managed by Escapp) is running; the player reads messages from the security team and unlocks the ECHO social network.
6. Within ECHO, the player logs in with moderator credentials and completes the challenges in order.
7. When the final challenge (Community Note) is submitted and all puzzles are solved, a localized success or failure outro video is played based on Escapp's final outcome. If the timer expires first, the fail outro is shown.

Social app credentials (for the simulated social network login only — unrelated to Escapp authentication):

```text
Username: echo
Password: MintAI_mod
```

## Challenges

The escape room has 5 Escapp puzzles. Each puzzle's answer is verified server-side by Escapp against the solution configured in the authoring UI (see `src/constants/escapp.js`).

| Puzzle | Challenge | Implementation | Solution format |
|--------|-----------|----------------|-----------------|
| 1 | Pretest (onboarding) | Select the correct statements from the final challenge. | Correct statement IDs, ascending, `;`-joined (e.g. `1;3;6;8;9`). |
| 2 | Suspicious Accounts | Classify 5 randomly selected accounts (3 bots, 2 humans); bots additionally require identifying mandatory indicators in a quiz. | One digit per account in on-screen order, `1` = human, `0` = bot (e.g. `10010`). |
| 3 | AI-Generated Content | Review a case, watch an educational video, and reconstruct an AI-generated phrase word by word. | Fixed token (`AICONTENT`); the puzzle can only be completed correctly in-app. |
| 4 | Incorrect Uses of AI | Review 3 random cases of problematic AI use and choose the correct community response. | Chosen option index per case, `;`-joined (e.g. `0;0;0`). |
| 5 | Community Note (final) | Select the correct statements and publish the final note from the new post button. | Correct statement IDs, ascending, `;`-joined (e.g. `1;3;6;8;9`). |

Intermediate attempts (e.g. wrong account classifications) are reported to Escapp via `checkPuzzle` without solving the puzzle.

## Simulated Desktop

The main screen is a desktop with an app drawer:

| App | Description |
|-----|-------------|
| Messages | Shows initial briefing and instructions for each challenge. Opening the app marks messages as read. |
| ECHO | Social network where you navigate the feed, profiles, and challenges. Locked until the briefing is read. |
| Files | Simulated file explorer with empty folders and a locked ECHO folder. |
| Hints | Shows contextual hints per challenge. Also allows replaying introductory videos. |

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18.3.1 + Vite 7 |
| Routing | React Router 6 |
| State | Context API + targeted reducers |
| Escape room platform | Escapp client (identity, timer, puzzle verification) |
| Simulated social backend | MirageJS (posts, users, comments) |
| HTTP | Axios |
| i18n | i18next, react-i18next, i18next-browser-languagedetector |
| Auxiliary UI | react-hot-toast, react-awesome-reveal, react-icons |
| Dates | Day.js + custom helpers |
| Data/Scripts | ExcelJS, dotenv |

MirageJS only simulates the ECHO social network. Calls under `/api/escapeRooms/...` are passed through to the real Escapp server so the Escapp client can reach it.

## Requirements

- Node.js 20.19 or higher, or Node.js 22.12 or higher.
- npm 9 or higher.
- An Escapp escape room with 5 puzzles configured with the solutions in `src/constants/escapp.js`.

## Installation

```bash
git clone https://github.com/IGLUE-project/ECHO
cd ECHO
npm install
```

For local development against an Escapp escape room:

```bash
cp config.example.mjs config.mjs   # edit endpoint + locale
npm run dev
```

`config.mjs` is git-ignored and used only in development to inject `window.ESCAPP_APP_SETTINGS` (locale and escape room endpoint), replicating what the Escapp server does in production. Set `endpoint` to your escape room's API URL and `preview: true` to test as the author without a full participant team.

## Environment Variables

Create a `.env` at the root using `example.env` as a base.

```env
VITE_JWT_SECRET="any"
XLSX_URL="https://docs.google.com/spreadsheets/d/..."
```

| Variable | Usage |
|----------|-------|
| `XLSX_URL` | Required for `npm run update-i18n`. It is the URL of the master Excel file. |
| `VITE_BASE_PATH` | Vite base path. Defaults to `./` so the app works when embedded by Escapp; the `build:gh-pages` script sets it to `/ECHO/`. |
| `VITE_JWT_SECRET` | Preserved in `example.env`; the current app does not use real JWT authentication. |

Escapp runtime settings (locale and escape room endpoint) are **not** in `.env` — they are injected via `window.ESCAPP_APP_SETTINGS` (by Escapp in production, or by `config.mjs` in development).

## Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Local preview of the build
npm run preview

# Build with /ECHO/ base path for GitHub Pages
npm run build:gh-pages

# Build and deploy to GitHub Pages
npm run deploy

# Regenerate translations, challenge data, and assets from Excel
npm run update-i18n

# Export current translations to CSV
npm run update-i18n-inverse
```

`npm run update-i18n` downloads the Excel specified by `XLSX_URL`, updates i18n files and game data, downloads referenced assets, and saves timestamped backups in `tmp/`.

## Structure

```text
src/
  main.jsx                         # React mounting, Router, MirageJS and providers
  App.jsx                          # Onboarding gate and desktop (renders after Escapp validation)
  server.jsx                       # MirageJS server, /api routes and Escapp passthrough
  i18n.jsx                         # i18next configuration
  backend/
    controllers/                   # Mirage handlers for posts, users and comments
    db/                            # Data by language and official ECHO posts
    utils/authUtils.jsx            # Simulated auth: ECHO user
  components/
    BossNotification/              # Notifications from boss/security team
    CreatePostForm/                # Create normal posts
    EditPostForm/                  # Edit posts
    FilesApp/                      # Simulated file explorer
    HintsApp/                      # Hints per challenge and intro videos
    MessagesApp/                   # Instruction messages
    Navbar/                        # ECHO navigation and challenge locks
    PlayerOnboarding/              # Intro videos and pretest (Escapp puzzle 1)
    Post/                          # Post card and comments
    SocialMediaApp/                # Window/login/container of ECHO routes
    StatsPanel/                    # Progress panel, threat level and timer
    Taskbar/                       # Taskbar available for the simulation
  constants/
    escapp.js                      # Escapp client settings and puzzle solutions
    langs/                         # Translations es, en, fi, sr
  contexts/                        # EscappProvider + global state (users, posts, messages, OS, stats)
  pages/
    Admin/                         # Challenge 1
    AIContent/                     # Challenge 2
    AIIncorrectUses/               # Challenge 3
    CommunityNote/                 # Challenge 4 as modal
    Desktop/                       # Main desktop and outro video
    Home/                          # Main feed
    NewPost/                       # Post or Community Note launcher
    PostDetail/                    # Post detail route
    Profile/                       # Profile and account classification
  Routes/NavRoutes.jsx             # Internal social network routes
  services/                        # Axios client for Mirage API
  utils/                           # Assets, dates, i18n and icons
scripts/
  download_from_excel.mjs          # Excel -> i18n, data, challenges, feed, hints and assets
  js_to_csv.mjs                    # i18n JS -> tmp/i18n_csv/i18n_strings.csv
config.example.mjs                 # Template for dev-only Escapp settings (copy to config.mjs)
public/
  assets/                          # Logos, videos, user/post/feed images
  404.html                         # SPA redirect for GitHub Pages
  _redirects                       # SPA redirect for Netlify-like hosts
```

## Social App Routes

These routes live within `SocialMediaApp` and are served under Vite's `basename`:

| Route | Page |
|-------|------|
| `/` | Main feed |
| `/profile/:username` | User profile |
| `/post-detail/:postId` | Post detail |
| `/admin` | Challenge 1 |
| `/ai-content` | Challenge 2, locked until challenge 2 instructions are read |
| `/ai-incorrect-uses` | Challenge 3, locked until challenge 3 instructions are read |
| `*` | Internal 404 page |

Navigation also applies visual locks from `Navbar`: completing a challenge is not enough to enter the next one, the player must read the corresponding message in the Messages app.

## Simulated Backend

MirageJS intercepts calls under `/api` and loads data by language for the ECHO social network. When changing language, `PostsProvider` reinitializes the server and reloads posts. Escapp API calls (`/api/escapeRooms/...`) are passed through to the real Escapp server.

### Posts

```text
GET    /api/posts
GET    /api/posts/:postId
GET    /api/posts/user/:username
POST   /api/posts
DELETE /api/posts/:postId
POST   /api/posts/edit/:postId
POST   /api/posts/like/:postId
POST   /api/posts/dislike/:postId
```

### Users

```text
GET    /api/users
GET    /api/users/:userId
POST   /api/users/edit
POST   /api/users/follow/:followUserId
POST   /api/users/unfollow/:followUserId
```

`userId` is resolved as `username` in the current handler.

### Comments

```text
GET    /api/comments/:postId
POST   /api/comments/add/:postId
POST   /api/comments/edit/:postId/:commentId
POST   /api/comments/delete/:postId/:commentId
POST   /api/comments/upvote/:postId/:commentId
POST   /api/comments/downvote/:postId/:commentId
```

Mock authentication always returns the official `ECHO` user; there is no real JWT login in Mirage.

## Internationalization and Data

Supported languages:

| Code | Language |
|------|----------|
| `es` | Spanish |
| `en` | English |
| `fi` | Finnish |
| `sr` | Serbian |

The language is normally provided by Escapp (`ESCAPP_APP_SETTINGS.locale`) and applied to i18next before rendering. i18next can also detect it from `?lang=`/`?locale=`, `localStorage` (`i18nextLng`), or the browser, falling back to Spanish.

UI texts are in:

```text
src/constants/langs/en.js
src/constants/langs/es.js
src/constants/langs/fi.js
src/constants/langs/sr.js
```

Main data is regenerated from the master Excel:

- UI translations;
- users and posts for puzzle 1 by language;
- official ECHO posts;
- static feed;
- challenge 2 phrases;
- challenge 3 cases;
- final challenge phrases;
- hints from the Hints app;
- referenced or embedded images.

Some fields support multilingual content as an object `{ en, es, fi, sr }`. Components use `getLocalizedContent()` to display the current language with fallback.

## State and Persistence

The app uses Context API to coordinate global state:

| Provider | Responsibility |
|----------|-----------------|
| `EscappProvider` | Escapp client, participant validation, puzzle submission and progress. |
| `UserProvider` | List of users loaded from Mirage. |
| `LoggedInUserProvider` | Official ECHO moderator user. |
| `PostsProvider` | Posts, likes, comments and reload by language. |
| `StatsProvider` | Challenge progress, misinformation level and timer. |
| `OSProvider` | Open apps, active app, minimize/close. |
| `MessagesProvider` | Messages, read/unread and unlockable instructions. |

Local game progress is saved in `sessionStorage`; authoritative progress (solved puzzles, timer, final outcome) lives in Escapp and is restored on reload. There is also support for resuming onboarding from a checkpoint if the page reloads during the pretest or the second video.

## Deployment

In production ECHO is served/embedded by the Escapp platform, which injects the escape room settings. It can also be built as a standalone static bundle.

For GitHub Pages:

```bash
npm run build:gh-pages
npm run deploy
```

The build uses `VITE_BASE_PATH=/ECHO/`. `public/404.html` redirects to `/ECHO/` to support SPA routes on GitHub Pages.

For other static hosts, check `VITE_BASE_PATH` and the equivalent SPA rule. `public/_redirects` already includes a rule compatible with Netlify.

## Maintenance Notes

- `config.mjs` is a dev-only, git-ignored file for local Escapp settings (see `config.example.mjs`).
- `tmp/` is used for backups generated by Excel scripts and for the exported CSV.
- `node_modules/` and `dist/` are local artifacts.
- `App.test.jsx` is a legacy test and does not reflect the current app.

## Funding

This software has been developed within the scope of the [ENDGAME](https://endgameproject.github.io) and [IGLUE](https://iglue.dit.upm.es) projects.

ENDGAME has been co-funded by the European Union under the Creative Europe Programme (Project reference [101185763](https://endgameproject.github.io)).

IGLUE has been co-funded by the European Union under the Erasmus+ Programme (Project reference [2024-1-ES01-KA220-HED-000256356](https://iglue.dit.upm.es)).  

<img src="https://github.com/user-attachments/assets/9760cf7f-a06b-4509-8281-4174c235fc43" width="300">

## License

Academic and research use.
