import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, History, User, Search, Youtube, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

function Navbar({ user, onLogout, theme, toggleTheme }) {
    const navigate = useNavigate();

    return (
        <header className="glass" style={{
            background: 'var(--nav-bg)',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            margin: '1rem',
            padding: '1rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: '1.25rem'
        }}>
            <motion.div
                className="brand"
                style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer'
                }}
                whileHover={{ scale: 1.05 }}
                onClick={() => navigate('/')}
            >
                <div style={{
                    background: 'var(--accent-gradient)',
                    padding: '0.5rem',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Youtube size={24} color="white" />
                </div>
                <span className="text-gradient">LEARNIFY</span>
            </motion.div>

            <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {user ? (
                    <>
                        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--fg-main)', fontWeight: 600 }}>
                            <Search size={18} /> Search
                        </Link>
                        <Link to="/history" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--fg-main)', fontWeight: 600 }}>
                            <History size={18} /> History
                        </Link>
                        <div style={{ height: '1.5rem', width: '1px', background: 'var(--glass-border)' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--fg-main)' }}>
                            <User size={18} />
                            <span style={{ fontWeight: 600 }}>{user}</span>
                        </div>
                        <motion.button
                            className="glass"
                            onClick={toggleTheme}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                            style={{
                                padding: '0.5rem',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--fg-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                                borderRadius: '0.75rem'
                            }}
                            whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.1)' }}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </motion.button>
                        <motion.button
                            className="glass"
                            onClick={onLogout}
                            style={{
                                padding: '0.5rem 1rem',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--fg-main)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer'
                            }}
                            whileHover={{ scale: 1.05, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)' }}
                        >
                            <LogOut size={16} /> Logout
                        </motion.button>
                    </>
                ) : (
                    <>
                        <Link to="/login" style={{ textDecoration: 'none', color: 'var(--fg-main)', fontWeight: 600 }}>Login</Link>
                        <Link to="/register" className="btn-primary" style={{ textDecoration: 'none' }}>Get Started</Link>
                    </>
                )}
            </nav>
        </header>
    );
}

export default Navbar;
