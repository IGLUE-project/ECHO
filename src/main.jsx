import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter as Router } from "react-router-dom";
import { EscappProvider } from "./contexts/EscappProvider.jsx";
import { PostsProvider } from "./contexts/PostsProvider.jsx";
import { UserProvider } from "./contexts/UserProvider.jsx";
import { LoggedInUserProvider } from "./contexts/LoggedInUserProvider.jsx";
import { OSProvider } from "./contexts/OSProvider.jsx";
import { MessagesProvider } from "./contexts/MessagesProvider.jsx";
import { StatsProvider } from "./contexts/StatsProvider.jsx";
import './i18n.jsx';

// The Escapp environment owns identity, timer and escape state. EscappProvider
// boots the Escapp client, fixes the locale from Escapp settings, starts the
// simulated backend and validates the participant before rendering the app.
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Router basename={import.meta.env.BASE_URL}>
      <EscappProvider>
        <UserProvider>
          <LoggedInUserProvider>
            <PostsProvider>
              <StatsProvider>
                <OSProvider>
                  <MessagesProvider>
                    <App />
                  </MessagesProvider>
                </OSProvider>
              </StatsProvider>
            </PostsProvider>
          </LoggedInUserProvider>
        </UserProvider>
      </EscappProvider>
    </Router>
  </React.StrictMode>
);
