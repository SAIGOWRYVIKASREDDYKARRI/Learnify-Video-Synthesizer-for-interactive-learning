import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CONFIG from "../utils/config";

function TranscriptPage() {
    const { videoId } = useParams();
    const [captions, setCaptions] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTranscript = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${CONFIG.API_BASE_URL}/captions?videoId=${videoId}`);
                const data = await res.json();
                if (data.error) setError(data.error);
                else setCaptions(data.captions || data.translated_captions || "");
            } catch {
                setError("Failed to load transcript");
            } finally {
                setLoading(false);
            }
        };
        fetchTranscript();
    }, [videoId]);

    return (
        <div className="card center-card">
            <h2>Transcript</h2>
            {loading ? <p>Loading...</p> : error ? <p className="text-error">{error}</p> : <div className="transcript">{captions}</div>}
            <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginTop: 10 }}>Back</button>
        </div>
    );
}

export default TranscriptPage;
