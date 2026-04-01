import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { History, Play, Video as VideoIcon, Calendar, X, Youtube, BookOpen, CheckCircle2, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CONFIG, { fetchAuth } from "../utils/config";

function HistoryPage() {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [activeVideo, setActiveVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showFavorites, setShowFavorites] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            const username = localStorage.getItem("username");
            const email = localStorage.getItem("email");
            if (!username || !email) {
                setLoading(false);
                return;
            }
            try {
                const res = await fetchAuth(`${CONFIG.API_BASE_URL}/get_history?username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
                const data = await res.json();
                if (res.ok) {
                    setHistory(Array.isArray(data) ? data : []);
                } else {
                    console.error("Error from backend:", data);
                    setHistory([]);
                }
            } catch (err) {
                console.error("Error fetching history:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const toggleFavorite = async (e, historyId) => {
        e.stopPropagation();
        try {
            const res = await fetchAuth(`${CONFIG.API_BASE_URL}/toggle_favorite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ historyId }),
            });
            const data = await res.json();
            if (res.ok) {
                setHistory(prev => prev.map(item =>
                    item.id === historyId ? { ...item, is_favorite: data.is_favorite } : item
                ));
            }
        } catch (err) {
            console.error("Failed to toggle favorite", err);
        }
    };

    const filteredHistory = showFavorites ? history.filter(item => item.is_favorite) : history;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="container"
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
                <div style={{
                    background: 'var(--accent-gradient)',
                    padding: '0.75rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)'
                }}>
                    <History size={24} color="white" />
                </div>
                <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Your <span className="text-gradient">History</span></h1>
                <button
                    onClick={() => setShowFavorites(!showFavorites)}
                    className="glass"
                    style={{
                        marginLeft: 'auto',
                        padding: '0.6rem 1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: showFavorites ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                        borderColor: showFavorites ? '#8b5cf6' : 'var(--glass-border)',
                        color: showFavorites ? '#8b5cf6' : 'var(--fg-muted)',
                        cursor: 'pointer',
                        borderRadius: '0.75rem',
                        fontWeight: 600
                    }}
                >
                    <Heart size={18} fill={showFavorites ? "#8b5cf6" : "none"} />
                    {showFavorites ? "Showing Favorites" : "Show Favorites"}
                </button>
            </div>

            <AnimatePresence>
                {activeVideo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            backgroundColor: 'rgba(9, 9, 11, 0.9)', zIndex: 1000,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(8px)'
                        }}
                        onClick={() => setActiveVideo(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{ position: 'relative', width: '90%', maxWidth: '1000px' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setActiveVideo(null)}
                                style={{
                                    position: 'absolute', top: '-3rem', right: 0,
                                    background: 'transparent', border: 'none', color: 'white',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '1rem'
                                }}
                            >
                                <X size={20} /> Close
                            </button>
                            <div style={{
                                borderRadius: '1.5rem', overflow: 'hidden',
                                border: '1px solid var(--glass-border)',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                            }}>
                                <video width="100%" controls autoPlay src={`${CONFIG.API_BASE_URL}/get_video/${activeVideo}`}></video>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}>
                    <p style={{ color: 'var(--fg-muted)' }}>Loading your learning journey...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '5rem' }}>
                    <Youtube size={48} color="var(--fg-muted)" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
                    <h3 style={{ marginBottom: '1rem' }}>No {showFavorites ? 'favorites' : 'history'} yet</h3>
                    <p style={{ color: 'var(--fg-muted)' }}>{showFavorites ? 'You haven\'t bookmarked any learning paths yet.' : 'Start searching and learning to see your history here.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                    {filteredHistory.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="glass-card"
                            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px', cursor: 'pointer' }}
                            onClick={() => navigate("/summary", { state: { keyword: item.query, historyId: item.id } })}
                        >
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{
                                        padding: '0.4rem 0.8rem',
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        border: '1px solid rgba(139, 92, 246, 0.2)',
                                        borderRadius: '2rem',
                                        fontSize: '0.8rem',
                                        color: '#1e1b4b',
                                        fontWeight: 600
                                    }}>
                                        Technical Summary
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.2 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => toggleFavorite(e, item.id)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <Heart size={20} color={item.is_favorite ? "#ef4444" : "var(--fg-muted)"} fill={item.is_favorite ? "#ef4444" : "none"} />
                                        </motion.button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                                            <Calendar size={14} /> {item.time ? new Date(item.time).toLocaleDateString() : 'Recent'}
                                        </div>
                                    </div>
                                </div>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>{item.query}</h3>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                                {item.video_filename ? (
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="btn-primary"
                                        onClick={(e) => { e.stopPropagation(); setActiveVideo(item.video_filename); }}
                                        style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
                                    >
                                        <Play size={16} fill="white" /> Play Summary
                                    </motion.button>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
                                        <VideoIcon size={16} /> No Video
                                    </div>
                                )}
                                {item.quiz_score !== null && item.quiz_score !== undefined ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22c55e', fontSize: '0.9rem', fontWeight: 700 }}>
                                        <CheckCircle2 size={16} /> Quiz Marks: {item.quiz_score}/{item.quiz_total}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22c55e', fontSize: '0.9rem', fontWeight: 600 }}>
                                        <BookOpen size={16} /> View Quiz
                                    </div>
                                )}
                                <div style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', opacity: 0.6 }}>
                                    ID: #{item.id}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

export default HistoryPage;
