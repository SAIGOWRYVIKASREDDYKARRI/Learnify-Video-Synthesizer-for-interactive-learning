import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, Youtube, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CONFIG from "../utils/config";

function LoginPage({ setUser }) {
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("username", data.username);
                localStorage.setItem("email", data.email || form.email);
                setUser(data.username);
                navigate("/");
            } else {
                setError(data.error || "Invalid credentials");
            }
        } catch {
            setError("Server error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card"
                style={{ width: '100%', maxWidth: '450px', padding: '3rem' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <motion.div
                        initial={{ rotate: -10 }}
                        animate={{ rotate: 0 }}
                        style={{
                            background: 'var(--accent-gradient)',
                            width: '50px', height: '50px',
                            borderRadius: '1rem', margin: '0 auto 1.5rem auto',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.4)'
                        }}
                    >
                        <Youtube size={28} color="white" />
                    </motion.div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--fg-muted)' }}>Login to access your learning history</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            className="input-glass"
                            type="email"
                            name="email"
                            placeholder="Email address"
                            value={form.email}
                            onChange={handleChange}
                            required
                            style={{ width: '100%', paddingLeft: '3rem' }}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            className="input-glass"
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={handleChange}
                            required
                            style={{ width: '100%', paddingLeft: '3rem' }}
                        />
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.9rem' }}
                            >
                                <AlertCircle size={14} /> {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-primary"
                        type="submit"
                        disabled={isLoading}
                        style={{ marginTop: '0.5rem', fontSize: '1rem', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                    >
                        {isLoading ? "Signing in..." : (
                            <>
                                Sign In <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>New to LEARNIFY? </span>
                    <Link to="/register" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>Create an account</Link>
                </div>
            </motion.div>
        </div>
    );
}

export default LoginPage;
