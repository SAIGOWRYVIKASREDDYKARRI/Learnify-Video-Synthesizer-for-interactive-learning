import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import "./styles.css";

// Components
import Navbar from "./components/Navbar";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SearchPage from "./pages/SearchPage";
import HistoryPage from "./pages/HistoryPage";
import TranscriptPage from "./pages/TranscriptPage";
import SummaryPage from "./pages/SummaryPage";

function App() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState("");
  const [user, setUser] = useState(() => localStorage.getItem("username"));
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute user={user}><SearchPage query={query} setQuery={setQuery} videos={videos} setVideos={setVideos} error={error} setError={setError} /></ProtectedRoute>} />
          <Route path="/transcript/:videoId" element={<ProtectedRoute user={user}><TranscriptPage /></ProtectedRoute>} />
          <Route path="/summary" element={<ProtectedRoute user={user}><SummaryPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute user={user}><HistoryPage /></ProtectedRoute>} />
        </Routes>
      </main>
      <footer className="footer">
        <p>© {new Date().getFullYear()} LEARNIFY — Learn faster with summaries & quizzes</p>
      </footer>
    </Router>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default App;