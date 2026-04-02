import os
import uvicorn
import shutil
import uuid
import json
import concurrent.futures
from datetime import datetime, timedelta
from threading import Lock
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from mysql.connector.errors import PoolError
from dotenv import load_dotenv
import jwt as pyjwt
from werkzeug.security import generate_password_hash, check_password_hash
from googleapiclient.discovery import build

load_dotenv()

# Modular imports
from database import get_db
from video_utils import create_video_from_summary
from ai_service import query_ollama, generate_mcqs, evaluate_explanation

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────
app = FastAPI(title="Learnify API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fix 3: Fail loudly if secrets are missing in production
try:
    SECRET_KEY = os.environ["SECRET_KEY"]
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
except KeyError as e:
    print(f"❌ CRITICAL ERROR: {e.args[0]} missing from .env. See README for setup.")
    raise

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

VIDEO_STORAGE_DIR = os.path.join(os.getcwd(), "video_storage")
if not os.path.exists(VIDEO_STORAGE_DIR):
    os.makedirs(VIDEO_STORAGE_DIR)

# Fix 7: Thread-safe video task registry using Lock
_video_tasks_lock = Lock()
video_tasks: dict = {}
video_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

# Fix 6: Build YouTube client ONCE at startup (not per request)
youtube_client = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=YOUTUBE_API_KEY) if YOUTUBE_API_KEY else None

# ─────────────────────────────────────────────
# JWT Auth Dependency
# ─────────────────────────────────────────────
security = HTTPBearer(auto_error=False)

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Decode and validate the Bearer JWT token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    try:
        payload = pyjwt.decode(
            credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Fix 2: Mutable default argument fixed (dict={} → None)
def create_access_token(identity: str, extra_claims: dict = None) -> str:
    """Create a signed JWT token."""
    extra_claims = extra_claims or {}
    payload = {
        "sub": identity,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
        **extra_claims,
    }
    return pyjwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

# ─────────────────────────────────────────────
# Pydantic Request Models  (Fix 4: Field validators)
# ─────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

class AddSearchRequest(BaseModel):
    username: str = Field(..., max_length=50)
    email: EmailStr
    searches: str = Field(..., max_length=500)

class ToggleFavoriteRequest(BaseModel):
    historyId: int

class SummaryRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    historyId: Optional[int] = None

class SaveQuizRequest(BaseModel):
    historyId: int
    quiz: list

class SaveScoreRequest(BaseModel):
    historyId: int
    score: int = Field(..., ge=0)
    total: int = Field(..., ge=1)

class VideoRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=20000)
    keyword: Optional[str] = Field(default="technology", max_length=200)
    historyId: Optional[int] = None

class MCQRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000)

# Fix 8: Proper evaluate models
class AnswerItem(BaseModel):
    question: str
    selected: str
    correct: str

class EvaluateRequest(BaseModel):
    answers: List[AnswerItem]

# ─────────────────────────────────────────────
# Helper: Dict cursor
# ─────────────────────────────────────────────
def dict_cursor(db):
    """Return a cursor that gives rows as dicts instead of tuples."""
    return db.cursor(dictionary=True)

# ─────────────────────────────────────────────
# Authentication Routes
# ─────────────────────────────────────────────

@app.post("/register")
def register(data: RegisterRequest):
    db = get_db()
    cur = dict_cursor(db)
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        if cur.fetchone():
            return JSONResponse(status_code=400, content={"error": "Email already registered"})
        hashed_pw = generate_password_hash(data.password)
        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (data.username, data.email, hashed_pw),
        )
        db.commit()
        return {"message": "Registration successful"}
    finally:
        cur.close()
        db.close()

@app.post("/login")
def login(data: LoginRequest):
    db = get_db()
    cur = dict_cursor(db)
    try:
        # Fix 5: dict cursor — access by column name, not index
        cur.execute("SELECT id, username, email, password FROM users WHERE email = %s", (data.email,))
        user = cur.fetchone()
    finally:
        cur.close()
        db.close()

    if user and check_password_hash(user["password"], data.password):
        token = create_access_token(
            identity=str(user["email"]),
            extra_claims={"id": user["id"], "username": user["username"], "email": user["email"]},
        )
        return {
            "message": "Login successful",
            "username": user["username"],
            "email": user["email"],
            "token": token,
        }
    return JSONResponse(status_code=401, content={"error": "Invalid credentials"})

# ─────────────────────────────────────────────
# Search & History Routes
# ─────────────────────────────────────────────

@app.post("/add_search")
def add_search(data: AddSearchRequest, _user=Depends(verify_jwt)):
    db = get_db()
    cur = db.cursor()
    try:
        timestamp = datetime.now()
        cur.execute(
            "INSERT INTO search_history (username, email, query, timestamp) VALUES (%s, %s, %s, %s)",
            (data.username, data.email, data.searches, timestamp),
        )
        history_id = cur.lastrowid
        db.commit()
        return {"message": "Search added", "historyId": history_id}
    finally:
        cur.close()
        db.close()

# Fix 9: Pagination added (page & limit query params, backwards-compatible)
@app.get("/get_history")
def get_history(
    username: str = Query(...),
    email: str = Query(...),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    _user=Depends(verify_jwt),
):
    offset = (page - 1) * limit
    db = get_db()
    cur = dict_cursor(db)
    try:
        cur.execute(
            """SELECT id, query, timestamp, video_filename, quiz_json,
                      quiz_score, quiz_total, is_favorite
               FROM search_history
               WHERE username=%s AND email=%s
               ORDER BY timestamp DESC
               LIMIT %s OFFSET %s""",
            (username, email, limit, offset),
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        db.close()

    history = []
    for row in rows:
        history.append({
            "id": row["id"],
            "query": row["query"],
            "time": row["timestamp"].strftime("%Y-%m-%d %H:%M:%S") if row["timestamp"] else "",
            "video_filename": row["video_filename"],
            "quiz_json": row["quiz_json"],
            "quiz_score": row["quiz_score"],
            "quiz_total": row["quiz_total"],
            "is_favorite": bool(row["is_favorite"]),
        })
    return history

@app.post("/toggle_favorite")
def toggle_favorite(data: ToggleFavoriteRequest, _user=Depends(verify_jwt)):
    db = get_db()
    cur = dict_cursor(db)
    try:
        cur.execute("SELECT is_favorite FROM search_history WHERE id = %s", (data.historyId,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        new_status = not bool(row["is_favorite"])
        cur.execute(
            "UPDATE search_history SET is_favorite = %s WHERE id = %s",
            (new_status, data.historyId),
        )
        db.commit()
        return {"message": "Toggled favorite", "is_favorite": new_status}
    finally:
        cur.close()
        db.close()

@app.get("/search")
def search_videos(q: str = Query(..., min_length=1, description="Search query")):
    if not youtube_client:
        raise HTTPException(status_code=503, detail="YouTube API not configured")
    try:
        res = youtube_client.search().list(q=q, part="snippet", type="video", maxResults=15).execute()
        return [
            {
                "videoId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "thumbnail": item["snippet"]["thumbnails"]["high"]["url"],
            }
            for item in res.get("items", [])
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Core Logic Routes
# ─────────────────────────────────────────────

@app.post("/summary")
def summary(data: SummaryRequest, _user=Depends(verify_jwt)):
    keyword = data.keyword
    history_id = data.historyId

    # Step 1: Check cache and get basic info (Quick)
    db = get_db()
    cur = dict_cursor(db)
    summary_text = None
    cached_quiz = None
    is_favorite = False
    try:
        cur.execute(
            "SELECT summary FROM search_history WHERE query = %s AND summary IS NOT NULL ORDER BY timestamp DESC LIMIT 1",
            (keyword,),
        )
        cached = cur.fetchone()
        if cached:
            summary_text = cached["summary"]

        if history_id:
            cur.execute(
                "SELECT quiz_json, is_favorite FROM search_history WHERE id = %s",
                (history_id,),
            )
            row = cur.fetchone()
            if row:
                cached_quiz = json.loads(row["quiz_json"]) if row["quiz_json"] else None
                is_favorite = bool(row["is_favorite"])
    finally:
        cur.close()
        db.close() # <--- RELEASE BEFORE AI CALL

    # Step 2: AI Generation (Slow - NO DB CONNECTION HELD)
    if not summary_text:
        summary_text = query_ollama(keyword)

    # Step 3: Persistence (Quick)
    if history_id:
        db = get_db()
        cur = db.cursor()
        try:
            cur.execute(
                "UPDATE search_history SET summary = %s WHERE id = %s",
                (summary_text, history_id),
            )
            db.commit()
        finally:
            cur.close()
            db.close()

    return {
        "summary": summary_text,
        "quiz": cached_quiz,
        "is_favorite": is_favorite,
    }

@app.post("/save_quiz")
def save_quiz(data: SaveQuizRequest, _user=Depends(verify_jwt)):
    quiz_json = json.dumps(data.quiz)
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            "UPDATE search_history SET quiz_json = %s WHERE id = %s",
            (quiz_json, data.historyId),
        )
        db.commit()
        return {"message": "Quiz saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        db.close()

@app.post("/save_score")
def save_score(data: SaveScoreRequest, _user=Depends(verify_jwt)):
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            "UPDATE search_history SET quiz_score = %s, quiz_total = %s WHERE id = %s",
            (data.score, data.total, data.historyId),
        )
        db.commit()
        return {"message": "Score saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        db.close()

# ─────────────────────────────────────────────
# Video Routes
# ─────────────────────────────────────────────

@app.post("/video")
def generate_video_route(data: VideoRequest, _user=Depends(verify_jwt)):
    try:
        text = data.text
        keyword = data.keyword or "technology"
        history_id = data.historyId

        print(f"Request for background video: {keyword}, History ID: {history_id}")

        # Check global cache first
        db = get_db()
        cur = dict_cursor(db)
        try:
            cur.execute(
                "SELECT video_filename FROM search_history WHERE query = %s AND video_filename IS NOT NULL ORDER BY timestamp DESC LIMIT 1",
                (keyword,),
            )
            cached = cur.fetchone()
        finally:
            cur.close()
            db.close()

        if cached and cached["video_filename"]:
            temp_path = os.path.join(VIDEO_STORAGE_DIR, cached["video_filename"])
            if os.path.exists(temp_path):
                return {"status": "completed", "video_url": f"/get_video/{cached['video_filename']}"}

        # Dispatch to background thread (Fix 7: lock-protected dict write)
        task_id = str(uuid.uuid4())
        with _video_tasks_lock:
            video_tasks[task_id] = {"status": "processing", "video_url": None, "error": None}
        video_executor.submit(_video_worker, task_id, text, keyword, history_id)

        return JSONResponse(
            content={"status": "processing", "task_id": task_id},
            status_code=202,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in /video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _video_worker(task_id: str, text: str, keyword: str, history_id):
    """Background worker — runs in thread pool."""
    try:
        temp_video_path = create_video_from_summary(text, keyword)
        if not temp_video_path or not os.path.exists(temp_video_path):
            with _video_tasks_lock:
                video_tasks[task_id] = {"status": "error", "error": "Video generation failed"}
            return

        permanent_filename = f"{uuid.uuid4()}.mp4"
        permanent_path = os.path.join(VIDEO_STORAGE_DIR, permanent_filename)
        shutil.move(temp_video_path, permanent_path)

        if history_id:
            db = get_db()
            cur = db.cursor()
            try:
                cur.execute(
                    "UPDATE search_history SET video_filename = %s WHERE id = %s",
                    (permanent_filename, history_id),
                )
                db.commit()
            except Exception as e:
                print(f"Background DB update failed: {e}")
            finally:
                cur.close()
                db.close()

        with _video_tasks_lock:
            video_tasks[task_id] = {
                "status": "completed",
                "video_url": f"/get_video/{permanent_filename}",
            }
    except Exception as e:
        with _video_tasks_lock:
            video_tasks[task_id] = {"status": "error", "error": str(e)}

@app.get("/video/status/{task_id}")
def get_video_status(task_id: str):
    with _video_tasks_lock:
        task = video_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.get("/get_video/{filename}")
def serve_video(filename: str):
    # Prevent path traversal attack
    safe_name = os.path.basename(filename)
    file_path = os.path.join(VIDEO_STORAGE_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(file_path, media_type="video/mp4")

# ─────────────────────────────────────────────
# MCQ / Evaluate Routes
# ─────────────────────────────────────────────

@app.post("/mcqs")
def get_mcqs(data: MCQRequest):
    return generate_mcqs(data.text)

# Fix 8: Evaluate endpoint now works — returns correct/wrong + AI explanation
@app.post("/evaluate")
def evaluate(data: EvaluateRequest):
    results = []
    for item in data.answers:
        is_correct = item.selected.strip() == item.correct.strip()
        if is_correct:
            explanation = f"✅ Correct! '{item.correct}' is the right answer."
        else:
            # Use AI to explain why the selected answer is wrong
            explanation = evaluate_explanation(item.question, item.selected, item.correct)
        results.append({
            "correct": is_correct,
            "explanation": explanation,
        })
    return results

# ─────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────
# Fix 5: Global Exception Handler for DB Pool Exhaustion
@app.exception_handler(PoolError)
async def pool_error_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={"error": "Server busy. Please try again in a few seconds."},
    )

if __name__ == "__main__":
    print("\n🚀 Starting Learnify FastAPI backend...")
    print("📡 API running at:  http://localhost:5000")
    print("📖 Swagger UI at:   http://localhost:5000/docs\n")
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)