// DEV ONLY. Copy this file to `config.mjs` (git-ignored) to run the app locally
// against an Escapp escape room while using `npm run dev`. In production the
// Escapp server injects these settings instead, so config.mjs is never used.
//
// Set `endpoint` to your escape room's API URL and `preview: true` so you can
// test as the author without a full participant team. The escape room must have
// 5 puzzles configured with the solutions documented in src/constants/escapp.js
// (1;3;6;8;9 / 10010 / AICONTENT / 0;0;0 / 1;3;6;8;9).

export let ESCAPP_APP_SETTINGS = {
  // App language (Escapp normally provides this): "en" | "es" | "sr" | "fi".
  locale: "es",

  escappClientSettings: {
    // Your escape room's API endpoint, e.g. https://escapp.es/api/escapeRooms/123
    endpoint: "https://escapp.es/api/escapeRooms/<YOUR_ESCAPE_ROOM_ID>",
    // Author preview mode: interact without a real participant session.
    preview: true,
    rtc: false,
  },
};
