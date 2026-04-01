import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Video, BookOpen, ChevronLeft, CheckCircle2, XCircle, Lightbulb, PlayCircle, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CONFIG, { fetchAuth } from "../utils/config";

function SummaryPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { keyword, videoIds, historyId } = location.state || {};

    const [summaryText, setSummaryText] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [mcqs, setMcqs] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(true);
    const [videoLoading, setVideoLoading] = useState(false);
    const [error, setError] = useState("");
    const [evaluatedResults, setEvaluatedResults] = useState([]);
    const [showExplanation, setShowExplanation] = useState({});
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        const fetchSummary = async () => {
            if (!keyword) { setError("No keyword"); setLoading(false); return; }
            try {
                setLoading(true);
                const res = await fetchAuth(`${CONFIG.API_BASE_URL}/summary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keyword, videoIds, historyId }),
                });
                const data = await res.json();
                if (res.ok && data.summary && !data.summary.startsWith("Error:")) {
                    setSummaryText(data.summary);
                    if (data.quiz) {
                        try {
                            const parsedQuiz = typeof data.quiz === 'string' ? JSON.parse(data.quiz) : data.quiz;
                            setMcqs(parsedQuiz);
                            setAnswers(Array(parsedQuiz.length).fill(""));
                        } catch (e) {
                            console.error("Failed to parse cached quiz", e);
                        }
                    }
                    if (data.is_favorite !== undefined) {
                        setIsFavorite(!!data.is_favorite);
                    }
                } else {
                    setError(data.summary || "Failed to fetch summary");
                    setSummaryText("");
                }
            } catch {
                setError("Server error");
                setSummaryText("");
            }
            finally { setLoading(false); }
        };
        fetchSummary();
    }, [keyword, videoIds]);

    useEffect(() => {
        if (summaryText && !videoUrl && !videoLoading && !error) generateVideo();
    }, [summaryText, error]);

    const generateVideo = async () => {
        setVideoLoading(true);
        try {
            const res = await fetchAuth(`${CONFIG.API_BASE_URL}/video`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: summaryText, keyword, historyId }),
            });
            if (!res.ok) throw new Error("Video failed");
            const data = await res.json();
            
            if (data.video_url) {
                setVideoUrl(`${CONFIG.API_BASE_URL}${data.video_url}`);
                setVideoLoading(false);
                return;
            }
            
            if (data.task_id) {
                const pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await fetchAuth(`${CONFIG.API_BASE_URL}/video/status/${data.task_id}`);
                        const statusData = await statusRes.json();
                        
                        if (statusData.status === "completed") {
                            clearInterval(pollInterval);
                            setVideoUrl(`${CONFIG.API_BASE_URL}${statusData.video_url}`);
                            setVideoLoading(false);
                        } else if (statusData.status === "error") {
                            clearInterval(pollInterval);
                            alert("Video generation failed: " + statusData.error);
                            setVideoLoading(false);
                        }
                    } catch (e) {
                        console.error("Polling error", e);
                    }
                }, 3000);
            }
        } catch { 
            alert("Failed to generate video"); 
            setVideoLoading(false);
        }
    };

    const generateMCQs = async () => {
        try {
            const res = await fetchAuth(`${CONFIG.API_BASE_URL}/mcqs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: summaryText }),
            });
            const data = await res.json();
            setMcqs(data);
            setAnswers(Array(data.length).fill(""));
            setSubmitted(false);

            // Persist to backend
            if (historyId) {
                fetchAuth(`${CONFIG.API_BASE_URL}/save_quiz`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ historyId, quiz: data }),
                }).catch(err => console.error("Failed to save quiz", err));
            }
        } catch { alert("Failed to generate MCQs"); }
    };

    const handleSubmitMCQs = async () => {
        try {
            const payload = {
                answers: mcqs.map((m, i) => ({ question: m.question, selected: answers[i], correct: m.answer })),
            };
            const res = await fetchAuth(`${CONFIG.API_BASE_URL}/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const results = await res.json();
            setEvaluatedResults(results);
            setSubmitted(true);
            const finalScore = results.filter(r => r.correct).length;
            setScore(finalScore);

            // Save score to backend
            if (historyId) {
                fetchAuth(`${CONFIG.API_BASE_URL}/save_score`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ historyId, score: finalScore, total: mcqs.length }),
                }).catch(err => console.error("Failed to save score", err));
            }
        } catch { alert("Evaluation failed"); }
    };

    const toggleFavorite = async () => {
        if (!historyId) return;
        try {
            const res = await fetchAuth(`${CONFIG.API_BASE_URL}/toggle_favorite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ historyId }),
            });
            const data = await res.json();
            if (res.ok) {
                setIsFavorite(data.is_favorite);
            }
        } catch (err) {
            console.error("Failed to toggle favorite", err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="container"
            style={{ maxWidth: '1000px' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    className="glass"
                    style={{ padding: '0.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--fg-muted)' }}
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 style={{ margin: 0, fontSize: '2rem' }}>Learning Path: <span className="text-gradient">{keyword}</span></h1>
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleFavorite}
                    style={{
                        marginLeft: 'auto',
                        padding: '0.6rem 1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        background: isFavorite ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid',
                        borderColor: isFavorite ? 'rgba(239, 68, 68, 0.4)' : 'var(--glass-border)',
                        color: isFavorite ? '#ef4444' : 'var(--fg-muted)',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    <Heart size={18} fill={isFavorite ? "#ef4444" : "none"} />
                    {isFavorite ? "Favorited" : "Favorite"}
                </motion.button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Summary Section */}
                    <div className="glass-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <BookOpen size={24} className="text-gradient" />
                            <h2 style={{ margin: 0 }}>Technical Summary</h2>
                        </div>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                    <Sparkles size={32} color="#8b5cf6" />
                                </motion.div>
                                <p style={{ marginTop: '1rem', color: 'var(--fg-muted)' }}>AI is distilling information...</p>
                            </div>
                        ) : error ? (
                            <p style={{ color: '#ef4444' }}>{error}</p>
                        ) : (
                            <div style={{ color: 'var(--fg-main)', opacity: 0.9, whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                                {summaryText}
                            </div>
                        )}
                    </div>

                    {/* MCQs Section */}
                    {mcqs.length > 0 && (
                        <div className="glass-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                                <Sparkles size={24} className="text-gradient" />
                                <h2 style={{ margin: 0 }}>Knowledge Check</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {mcqs.map((m, i) => (
                                    <div key={i} style={{
                                        padding: '1.5rem',
                                        borderRadius: '1rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <p style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '1.1rem' }}>{i + 1}. {m.question}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {m.options.map((opt, j) => {
                                                const isSelected = answers[i] === opt;
                                                const isCorrect = submitted && opt === m.answer;
                                                const isWrong = submitted && isSelected && opt !== m.answer;

                                                return (
                                                    <label key={j} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '1rem',
                                                        padding: '1rem',
                                                        borderRadius: '0.75rem',
                                                        cursor: submitted ? 'default' : 'pointer',
                                                        background: isCorrect ? 'rgba(34, 197, 94, 0.1)' : isWrong ? 'rgba(239, 68, 68, 0.1)' : isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                                                        border: isCorrect ? '1px solid #22c55e' : isWrong ? '1px solid #ef4444' : isSelected ? '1px solid #8b5cf6' : '1px solid var(--glass-border)',
                                                        transition: 'all 0.2s'
                                                    }}>
                                                        <input
                                                            type="radio"
                                                            name={`q-${i}`}
                                                            disabled={submitted}
                                                            checked={isSelected}
                                                            onChange={() => { const a = [...answers]; a[i] = opt; setAnswers(a); }}
                                                            style={{ accentColor: '#8b5cf6' }}
                                                        />
                                                        <span style={{ flex: 1, color: 'var(--fg-main)' }}>{opt}</span>
                                                        {isCorrect && <CheckCircle2 size={18} color="#22c55e" />}
                                                        {isWrong && <XCircle size={18} color="#ef4444" />}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {submitted && evaluatedResults[i] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '0.75rem', borderLeft: '4px solid #8b5cf6' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#8b5cf6', fontWeight: 600 }}>
                                                    <Lightbulb size={16} /> Explanation
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--fg-main)' }}>{evaluatedResults[i].explanation}</p>
                                            </motion.div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {submitted && (
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                        Final Score: <span className="text-gradient">{score} / {mcqs.length}</span>
                                    </div>
                                )}
                                <button
                                    className="btn-primary"
                                    onClick={submitted ? generateMCQs : handleSubmitMCQs}
                                    style={{ marginLeft: 'auto' }}
                                >
                                    {submitted ? "Try Again" : "Submit Answers"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Section */}
                <div style={{ position: 'sticky', top: '7rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <Video size={20} className="text-gradient" />
                            <h3 style={{ margin: 0 }}>Visual Summary</h3>
                        </div>

                        {videoLoading ? (
                            <div style={{ aspectRatio: '16/9', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                    <PlayCircle size={40} color="#8b5cf6" />
                                </motion.div>
                                <span style={{ fontSize: '0.9rem', color: 'var(--fg-muted)' }}>Synthesizing video...</span>
                            </div>
                        ) : videoUrl ? (
                            <div style={{ borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                                <video width="100%" controls src={videoUrl} style={{ display: 'block' }}></video>
                            </div>
                        ) : (
                            <button
                                className="btn-primary"
                                onClick={generateVideo}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                <PlayCircle size={18} /> Generate Video
                            </button>
                        )}

                        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
                                {mcqs.length > 0
                                    ? "Quiz is ready! Test your understanding below."
                                    : "Practice makes perfect. Generate a quiz based on the summary."}
                            </p>
                            {!loading && !error && mcqs.length === 0 && (
                                <button
                                    className="btn-primary"
                                    onClick={generateMCQs}
                                    style={{ width: '100%', marginTop: '1rem' }}
                                >
                                    Generate Quiz
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default SummaryPage;
