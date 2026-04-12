import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Video, BookOpen, ChevronLeft, CheckCircle2, XCircle, Lightbulb, PlayCircle, Heart, RotateCcw, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
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
    const [taskId, setTaskId] = useState(null);
    const [analysis, setAnalysis] = useState("");
    const [activeTab, setActiveTab] = useState("analysis");
    const videoRef = useRef(null);
    const [skipFeedback, setSkipFeedback] = useState(null);

    const skipTime = (amount) => {
        if (videoRef.current) {
            // Fix: Clear feedback first to allow re-triggering same side quickly
            setSkipFeedback(null);
            
            const newTime = videoRef.current.currentTime + amount;
            // Ensure we don't go out of bounds
            videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration));
            
            // Show visual feedback
            setSkipFeedback(amount > 0 ? "forward" : "back");
            setTimeout(() => setSkipFeedback(null), 800);
        }
    };

    const handleVideoClick = (e) => {
        if (!videoRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        // Define zones: Left 30%, Right 30%
        if (x < width * 0.3) {
            e.preventDefault();
            skipTime(-5);
        } else if (x > width * 0.7) {
            e.preventDefault();
            skipTime(5);
        }
        // Middle clicks are left to standard play/pause controls
    };

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
        if (summaryText && !videoUrl && !videoLoading && !error && !taskId) generateVideo();
    }, [summaryText, error]);

    // Fix 11: Polling with cleanup and robust error handling
    useEffect(() => {
        if (!taskId) return;

        let errorCount = 0;
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetchAuth(`${CONFIG.API_BASE_URL}/video/status/${taskId}`);
                
                // If it hangs safely or returns 401 wrapper
                if (!statusRes) return;

                if (!statusRes.ok) {
                    throw new Error(`HTTP error! status: ${statusRes.status}`);
                }

                const statusData = await statusRes.json();
                
                if (statusData.status === "completed") {
                    clearInterval(pollInterval);
                    setVideoUrl(`${CONFIG.API_BASE_URL}${statusData.video_url}`);
                    setVideoLoading(false);
                    setTaskId(null);
                    toast.success("Video synthesis complete!");
                } else if (statusData.status === "error") {
                    clearInterval(pollInterval);
                    toast.error("Video generation failed: " + statusData.error);
                    setVideoLoading(false);
                    setTaskId(null);
                }
            } catch (e) {
                console.error("Polling error", e);
                errorCount++;
                if (errorCount >= 3) {
                    clearInterval(pollInterval);
                    toast.error("Connection lost during video synthesis.");
                    setVideoLoading(false);
                    setTaskId(null);
                }
            }
        }, 3000);

        return () => clearInterval(pollInterval); // cleanup on unmount
    }, [taskId]);

    const generateVideo = async () => {
        if (videoLoading || videoUrl) return; // Prevent double trigger
        setVideoLoading(true);
        const t = toast.loading("AI is synthesizing your learning video...");
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
                toast.dismiss(t);
                toast.success("Ready to watch!");
                return;
            }
            
            if (data.task_id) {
                setTaskId(data.task_id);
                toast.dismiss(t); // Task polling will take over notifications
            } else {
                // No task_id or video_url returned
                setVideoLoading(false);
                toast.dismiss(t);
                toast.error("Video synthesis failed to start.");
            }
        } catch (err) { 
            console.error("Video gen error:", err);
            toast.error("Failed to generate video"); 
            setVideoLoading(false);
            toast.dismiss(t);
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
            if (!data || data.length === 0) {
                toast.error("AI could not generate questions for this summary.");
                return;
            }
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
        } catch { toast.error("Failed to generate MCQs"); }
    };

    const handleSubmitMCQs = async () => {
        try {
            const payload = {
                topic: keyword,
                answers: mcqs.map((m, i) => ({ question: m.question, selected: answers[i], correct: m.answer })),
                historyId: historyId
            };
            const res = await fetchAuth(`${CONFIG.API_BASE_URL}/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            setEvaluatedResults(data.results);
            setAnalysis(data.analysis);
            setSubmitted(true);
            const finalScore = data.results.filter(r => r.correct).length;
            setScore(finalScore);

            if (historyId) {
                fetchAuth(`${CONFIG.API_BASE_URL}/save_score`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ historyId, score: finalScore, total: mcqs.length }),
                }).catch(err => console.error("Failed to save score", err));
            }
            toast.success(`Analysis complete! You scored ${finalScore}/${mcqs.length}.`);
        } catch { toast.error("Evaluation failed"); }
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
                            {submitted && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Total Score</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }} className="text-gradient">{score}/{mcqs.length}</div>
                                        </div>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Questions</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{mcqs.length}</div>
                                        </div>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Correct</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e' }}>{score}</div>
                                        </div>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Incorrect</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{mcqs.length - score}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
                                        {["analysis", "review"].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                style={{
                                                    padding: '1rem 0',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderBottom: activeTab === tab ? '3px solid #8b5cf6' : '3px solid transparent',
                                                    color: activeTab === tab ? '#8b5cf6' : 'var(--fg-muted)',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}
                                            >
                                                {tab === "analysis" ? "Performance Analysis" : "Question Review"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {submitted && activeTab === "analysis" ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{ 
                                            padding: '1rem', 
                                            lineHeight: '1.8', 
                                            color: 'var(--fg-main)', 
                                            fontSize: '1.1rem',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {analysis ? analysis : "Generating your detailed performance report..."}
                                    </motion.div>
                                ) : (
                                    <>
                                        {(activeTab === "review" || !submitted) && mcqs.map((m, i) => (
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
                                    </>
                                )}
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                <div 
                                    style={{ position: 'relative', cursor: 'pointer' }}
                                    onClick={handleVideoClick}
                                >
                                    <video 
                                        ref={videoRef} 
                                        width="100%" 
                                        controls 
                                        src={videoUrl} 
                                        style={{ display: 'block' }}
                                    ></video>
                                    
                                    <AnimatePresence>
                                        {skipFeedback && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 1.5 }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: skipFeedback === 'back' ? '15%' : '85%',
                                                    transform: 'translate(-50%, -50%)',
                                                    pointerEvents: 'none',
                                                    background: 'rgba(0,0,0,0.5)',
                                                    borderRadius: '50%',
                                                    width: '80px',
                                                    height: '80px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    zIndex: 10
                                                }}
                                            >
                                                {skipFeedback === 'back' ? (
                                                    <>
                                                        <RotateCcw size={32} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>-5s</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <RotateCw size={32} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>+5s</span>
                                                    </>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
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
