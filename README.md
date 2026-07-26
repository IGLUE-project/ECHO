# ECHO - Social Media Escape Room

ECHO is an educational web application of the escape room type. It simulates a desktop with several internal apps and a social network where the player acts as a content moderator to solve challenges about digital misinformation and artificial intelligence.

The project is built with React + Vite, uses MirageJS as a simulated in-memory backend, and i18next for internationalization.

## Game Flow

1. The player completes onboarding with name, age, and language.
2. The app plays introductory videos available for the selected language.
3. The player answers a pretest based on the phrases from the final challenge.
4. A 20-minute escape timer starts.
5. The player reads messages from the security team and unlocks the ECHO social network.
6. Within ECHO, logs in with moderator credentials.
7. Completes the challenges in order and publishes the final Community Note.
8. When the final challenge is submitted, a localized success or failure outro video is played and the final survey is shown. If the timer expires before completion, the survey is made available without an outro.

Social app credentials:

```text
Username: echo
Password: MintAI_mod
```

## Challenges

| # | Challenge | Implementation |
|---|-----------|----------------|
| 1 | Suspicious Accounts | Classify 5 randomly selected accounts: 3 bots and 2 humans. Bots additionally require identifying mandatory indicators in a quiz. |
| 2 | AI-Generated Content | Review a case, watch an educational video, and reconstruct an AI-generated phrase word by word. |
| 3 | Incorrect Uses of AI | Review 3 random cases of problematic AI use and choose the correct community response. |
| 4 | Community Note | Select the correct statements and publish the final note from the new post button. |


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
| Simulated Backend | MirageJS |
| HTTP | Axios |
| i18n | i18next, react-i18next, i18next-browser-languagedetector |
| Auxiliary UI | react-hot-toast, react-awesome-reveal, react-icons |
| Dates | Day.js + custom helpers |
| Data/Scripts | ExcelJS, dotenv |

## Requirements

- Node.js 20.19 or higher, or Node.js 22.12 or higher.
- npm 9 or higher.

## Installation

```bash
git clone https://github.com/ENDGAMEPROJECT/ECHO
cd ECHO
npm install
```

For local development:

```bash
npm run dev
```

## Environment Variables

Create a `.env` at the root using `example.env` as a base.

```env
VITE_JWT_SECRET="any"
XLSX_URL="https://docs.google.com/spreadsheets/d/..."
```

Relevant variables:

| Variable | Usage |
|----------|-------|
| `XLSX_URL` | Required for `npm run update-i18n`. It is the URL of the master Excel file. |
| `VITE_BASE_PATH` | Vite base path. The `build:gh-pages` script sets it to `/ECHO/`. |
| `VITE_JWT_SECRET` | Preserved in `example.env`; the current app does not use real JWT authentication. |

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
  App.jsx                          # Onboarding, session recovery and desktop
  server.jsx                       # MirageJS server and /api routes
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
    PlayerOnboarding/              # Initial form, videos and pretest
    Post/                          # Post card and comments
    SocialMediaApp/                # Window/login/container of ECHO routes
    StatsPanel/                    # Progress panel, threat level and timer
    SurveyModal/                   # Final survey
    Taskbar/                       # Taskbar available for the simulation
  constants/langs/                 # Translations es, en, fi, sr
  contexts/                        # Global state for users, posts, messages, OS and stats
  pages/
    Admin/                         # Challenge 1
    AIContent/                     # Challenge 2
    AIIncorrectUses/               # Challenge 3
    CommunityNote/                 # Challenge 4 as modal
    Desktop/                       # Main desktop
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

MirageJS intercepts calls under `/api` and loads data by language. When changing language, `PostsProvider` reinitializes the server and reloads posts.

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

The language is selected during onboarding. i18next can also detect it from `?lang=`, `localStorage` (`i18nextLng`), or the browser.

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
| `UserProvider` | List of users loaded from Mirage. |
| `LoggedInUserProvider` | Official ECHO moderator user. |
| `PostsProvider` | Posts, likes, comments and reload by language. |
| `StatsProvider` | Challenge progress, misinformation level and timer. |
| `OSProvider` | Open apps, active app, minimize/close. |
| `MessagesProvider` | Messages, read/unread and unlockable instructions. |

Game progress is saved mainly in `sessionStorage`. There is support for session resumption and for resuming onboarding from a checkpoint if the page reloads during the pretest or the second video.

## Deployment

For GitHub Pages:

```bash
npm run build:gh-pages
npm run deploy
```

The build uses `VITE_BASE_PATH=/ECHO/`. `public/404.html` redirects to `/ECHO/` to support SPA routes on GitHub Pages.

For other static hosts, check `VITE_BASE_PATH` and the equivalent SPA rule. `public/_redirects` already includes a rule compatible with Netlify.

## Maintenance Notes

- `tmp/` is used for backups generated by Excel scripts and for the exported CSV.
- `node_modules/` and `dist/` are local artifacts.
- `App.test.jsx` is a legacy test and does not reflect the current app.

## License

Project developed within the ENDGAME project framework. Academic and research use.
