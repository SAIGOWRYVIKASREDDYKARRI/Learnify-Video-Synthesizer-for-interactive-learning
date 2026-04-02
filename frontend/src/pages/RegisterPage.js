import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, AlertCircle, Youtube, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import CONFIG from "../utils/config";

function RegisterPage() {
    const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        if (e) e.preventDefault();

        if (form.password !== form.confirm) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success("Registration successful! Please login.");
                navigate("/login");
            } else {
                const data = await res.json();
                toast.error(data.error || "Registration failed");
            }
        } catch {
            toast.error("Server error");
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
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Create Account</h1>
                    <p style={{ color: 'var(--fg-muted)' }}>Join LEARNIFY to start your learning journey</p>
                </div>

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            className="input-glass"
                            type="text"
                            name="username"
                            placeholder="Username"
                            value={form.username}
                            onChange={handleChange}
                            required
                            style={{ width: '100%', paddingLeft: '3rem' }}
                        />
                    </div>

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

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            className="input-glass"
                            type="password"
                            name="confirm"
                            placeholder="Confirm Password"
                            value={form.confirm}
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
                        {isLoading ? "Creating account..." : (
                            <>
                                Get Started <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>Already have an account? </span>
                    <Link to="/login" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
                </div>
            </motion.div>
        </div>
    );
}

export default RegisterPage;
