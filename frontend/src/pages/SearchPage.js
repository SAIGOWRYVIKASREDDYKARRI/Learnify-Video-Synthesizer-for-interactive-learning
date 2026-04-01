import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Youtube, ExternalLink, CheckCircle, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CONFIG, { fetchAuth } from "../utils/config";

function SearchPage({ query, setQuery, videos, setVideos, error, setError }) {
    const [selected, setSelected] = useState([]);
    const [currentHistoryId, setCurrentHistoryId] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const navigate = useNavigate();
    const suggestionRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (query.trim().length < 2) {
                setSuggestions([]);
                return;
            }
            try {
                // Using Google's autocomplete API (JSONP-like but can be used with a proxy or direct if CORS allows, 
                // typically for demo/client-side it's common to use this or a similar service)
                const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setSuggestions(data[1] || []);
            } catch (err) {
                console.error("Suggestion fetch failed", err);
            }
        };

        const timeoutId = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSearch = async () => {
        handleSearchSync(query);
    };

    const handleSearchSync = async (searchQuery) => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setShowSuggestions(false);
        try {
            const username = localStorage.getItem("username");
            const email = localStorage.getItem("email");

            if (username && email) {
                const hRes = await fetchAuth(`${CONFIG.API_BASE_URL}/add_search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, searches: searchQuery }),
                });
                const hData = await hRes.json();
                setCurrentHistoryId(hData.historyId);
            }

            const res = await fetch(`${CONFIG.API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data.error) {
                setError(data.error);
                setVideos([]);
            } else {
                setVideos(data);
                setError("");
                setSelected([]);
            }
        } catch {
            setError("Failed to fetch videos");
            setVideos([]);
        } finally {
            setIsSearching(false);
        }
    };

    const toggleSelect = (videoId) => {
        setSelected((prev) => prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]);
    };

    const handleSummary = () => {
        if (selected.length > 0) {
            navigate("/summary", {
                state: {
                    videoIds: selected,
                    keyword: query,
                    historyId: currentHistoryId
                }
            });
        } else {
            alert("Please select at least one video.");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="container"
        >
            <div style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ fontSize: '3.5rem', marginBottom: '1rem' }}
                >
                    Master Any Topic with <span className="text-gradient">AI</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{ color: 'var(--fg-muted)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}
                >
                    Search YouTube, select the best videos, and let LEARNIFY generate technical summaries and quizzes for you.
                </motion.p>
            </div>

            <div className="glass" style={{
                padding: '0.5rem',
                display: 'flex',
                gap: '0.5rem',
                maxWidth: '800px',
                margin: '0 auto 3rem auto',
                borderRadius: '1.5rem',
                border: '1px solid var(--glass-border)',
                position: 'relative'
            }} ref={suggestionRef}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '1.5rem', gap: '0.75rem' }}>
                    <Search size={20} color="var(--fg-muted)" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowSuggestions(true);
                            setSuggestionIndex(-1);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (suggestionIndex >= 0) {
                                    setQuery(suggestions[suggestionIndex]);
                                    setShowSuggestions(false);
                                    // Trigger search with the selected suggestion
                                    handleSearchSync(suggestions[suggestionIndex]);
                                } else {
                                    handleSearch();
                                }
                            } else if (e.key === 'ArrowDown') {
                                setSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                            } else if (e.key === 'ArrowUp') {
                                setSuggestionIndex(prev => Math.max(prev - 1, -1));
                            } else if (e.key === 'Escape') {
                                setShowSuggestions(false);
                            }
                        }}
                        placeholder="What do you want to learn today?"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--fg-main)',
                            width: '100%',
                            padding: '1rem 0',
                            fontSize: '1.1rem',
                            outline: 'none'
                        }}
                    />
                </div>
                <button
                    className="btn-primary"
                    onClick={handleSearch}
                    disabled={isSearching}
                    style={{ padding: '0 2rem', borderRadius: '1.25rem' }}
                >
                    {isSearching ? "Searching..." : "Search"}
                </button>

                {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(20px)',
                            marginTop: '0.5rem',
                            borderRadius: '1rem',
                            border: '1px solid var(--glass-border)',
                            overflow: 'hidden',
                            zIndex: 100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}
                    >
                        {suggestions.map((s, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    setQuery(s);
                                    setShowSuggestions(false);
                                    handleSearchSync(s);
                                }}
                                onMouseEnter={() => setSuggestionIndex(i)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    cursor: 'pointer',
                                    background: suggestionIndex === i ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                                    color: suggestionIndex === i ? '#8b5cf6' : 'var(--fg-main)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Search size={14} opacity={0.5} />
                                {s}
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {error && (
                    <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ color: '#ef4444', textAlign: 'center', marginBottom: '2rem' }}
                    >
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>

            {videos.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <h2 style={{ fontSize: '1.5rem' }}>Results for <span className="text-gradient">"{query}"</span></h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <span style={{ color: 'var(--fg-muted)', display: 'flex', alignItems: 'center' }}>
                            {selected.length} selected
                        </span>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="btn-primary"
                            onClick={handleSummary}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Sparkles size={18} /> Generate Learning Path
                        </motion.button>
                    </div>
                </motion.div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1.5rem'
            }}>
                {videos.map((video, index) => (
                    <motion.div
                        key={video.videoId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="glass-card"
                        style={{
                            padding: '0',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            border: selected.includes(video.videoId) ? '1px solid #8b5cf6' : '1px solid var(--glass-border)',
                            background: selected.includes(video.videoId) ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-card)'
                        }}
                        onClick={() => toggleSelect(video.videoId)}
                    >
                        <div style={{ position: 'relative' }}>
                            <img src={video.thumbnail} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                {selected.includes(video.videoId) ? (
                                    <CheckCircle size={24} color="#8b5cf6" fill="white" />
                                ) : (
                                    <Circle size={24} color="rgba(255,255,255,0.5)" />
                                )}
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {video.title}
                            </h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Youtube size={14} /> YouTube
                                </span>
                                <a
                                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: 'var(--fg-muted)', transition: 'color 0.2s' }}
                                    onMouseEnter={(e) => e.target.style.color = 'var(--fg-main)'}
                                    onMouseLeave={(e) => e.target.style.color = 'var(--fg-muted)'}
                                >
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

export default SearchPage;
