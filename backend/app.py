import os
import shutil
import uuid
from flask import Flask, request, jsonify, send_file, session, send_from_directory
from dotenv import load_dotenv
load_dotenv()
from flask_cors import CORS
from googleapiclient.discovery import build
import random
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import concurrent.futures
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

# Modular imports
from database import init_db, get_db
from video_utils import create_video_from_summary
from ai_service import query_ollama, generate_mcqs, evaluate_explanation

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "supersecretkey")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "superjwtsecret")
jwt = JWTManager(app)
CORS(app)

# Initialize Database
init_db(app)

# Background Video Execution Setup
video_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
video_tasks = {}

# Video Storage Config
VIDEO_STORAGE_DIR = os.path.join(os.getcwd(), "video_storage")
if not os.path.exists(VIDEO_STORAGE_DIR):
    os.makedirs(VIDEO_STORAGE_DIR)

# YouTube API Setup
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# --- Authentication Routes ---

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username, email, password = data.get('username'), data.get('email'), data.get('password')
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        return jsonify({'error': 'Email already registered'}), 400
    hashed_pw = generate_password_hash(password)
    cur.execute("INSERT INTO users (username, email, password) VALUES (%s, %s, %s)", (username, email, hashed_pw))
    db.commit()
    cur.close()
    return jsonify({'message': 'Registration successful'}), 200

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email, password = data.get('email'), data.get('password')
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    if user and check_password_hash(user[3], password):
        # JWT identity must be a string; pass extra info as additional_claims
        access_token = create_access_token(
            identity=str(user[2]),  # email as string identity
            additional_claims={'id': user[0], 'username': user[1], 'email': user[2]}
        )
        session['user'] = {'id': user[0], 'username': user[1], 'email': user[2]}
        return jsonify({'message': 'Login successful', 'username': user[1], 'email': user[2], 'token': access_token}), 200
    return jsonify({'error': 'Invalid credentials'}), 401

# --- Search & History (Normalized) ---

@app.route('/add_search', methods=['POST'])
@jwt_required()
def add_search():
    data = request.get_json()
    username, email, query = data.get("username"), data.get("email"), data.get("searches")
    timestamp = datetime.now()

    db = get_db()
    cur = db.cursor()
    # Normalized: Every search is a NEW row
    cur.execute("INSERT INTO search_history (username, email, query, timestamp) VALUES (%s, %s, %s, %s)",
                (username, email, query, timestamp))
    history_id = cur.lastrowid
    db.commit()
    cur.close()
    return jsonify({"message": "Search added", "historyId": history_id}), 200

@app.route("/get_history", methods=["GET"])
@jwt_required()
def get_history():
    username, email = request.args.get("username"), request.args.get("email")
    db = get_db()
    cur = db.cursor()
    # Fetch rows, including video_filename, quiz_json, quiz_score, quiz_total, and is_favorite
    cur.execute("SELECT id, query, timestamp, video_filename, quiz_json, quiz_score, quiz_total, is_favorite FROM search_history WHERE username=%s AND email=%s ORDER BY timestamp DESC", 
                (username, email))
    rows = cur.fetchall()
    cur.close()
    
    history = []
    for row in rows:
        history.append({
            "id": row[0],
            "query": row[1],
            "time": row[2].strftime("%Y-%m-%d %H:%M:%S") if row[2] else "",
            "video_filename": row[3],
            "quiz_json": row[4],
            "quiz_score": row[5],
            "quiz_total": row[6],
            "is_favorite": bool(row[7]) if len(row) > 7 else False
        })
    return jsonify(history)

@app.route("/toggle_favorite", methods=["POST"])
@jwt_required()
def toggle_favorite():
    data = request.get_json()
    history_id = data.get("historyId")
    if not history_id: return "Missing historyId", 400
    
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT is_favorite FROM search_history WHERE id = %s", (history_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return "Not found", 404
    
    new_status = not bool(row[0])
    cur.execute("UPDATE search_history SET is_favorite = %s WHERE id = %s", (new_status, history_id))
    db.commit()
    cur.close()
    return jsonify({"message": "Toggled favorite", "is_favorite": new_status}), 200

@app.route("/search", methods=["GET"])
def search_videos():
    query = request.args.get("q", "").strip()
    if not query: return jsonify({"error": "No query"}), 400
    try:
        youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=YOUTUBE_API_KEY)
        res = youtube.search().list(q=query, part="snippet", type="video", maxResults=15).execute()
        videos = []
        for item in res.get("items", []):
            videos.append({
                "videoId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "thumbnail": item["snippet"]["thumbnails"]["high"]["url"]
            })
        return jsonify(videos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Core Logic & Video Storage ---

@app.route("/summary", methods=["POST"])
@jwt_required()
def summary():
    data = request.get_json()
    keyword = data.get("keyword")
    history_id = data.get("historyId")
    if not keyword: return "No keyword", 400

    db = get_db()
    cur = db.cursor()

    # 1. Check for global cache (any user's previous summary)
    cur.execute("SELECT summary, quiz_json FROM search_history WHERE query = %s AND summary IS NOT NULL ORDER BY timestamp DESC LIMIT 1", (keyword,))
    cached = cur.fetchone()
    
    cached_quiz = None
    if cached and cached[0]:
        summary_text = cached[0]
        cached_quiz = cached[1]
        print(f"Returning cached summary for keyword: {keyword}")
    else:
        # 2. Generate new summary
        summary_text = query_ollama(keyword)
        print(f"Generated new summary for keyword: {keyword}")

    # 3. Update current history record if history_id provided
    if history_id and summary_text and not summary_text.startswith("Error:"):
        try:
            cur.execute("UPDATE search_history SET summary = %s WHERE id = %s", (summary_text, history_id))
            db.commit()
        except Exception as e:
            print(f"Database update for summary failed: {e}")

    # 4. Get is_favorite status
    cur.execute("SELECT is_favorite FROM search_history WHERE id = %s", (history_id,))
    fav_row = cur.fetchone()
    is_favorite = bool(fav_row[0]) if fav_row else False

    cur.close()
    return jsonify({
        "summary": summary_text,
        "quiz": cached_quiz,
        "is_favorite": is_favorite
    }), 200

@app.route("/save_quiz", methods=["POST"])
@jwt_required()
def save_quiz():
    data = request.get_json()
    history_id = data.get("historyId")
    quiz_data = data.get("quiz")
    if not history_id or not quiz_data:
        return jsonify({"error": "Missing data"}), 400
    
    import json
    quiz_json = json.dumps(quiz_data)
    
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("UPDATE search_history SET quiz_json = %s WHERE id = %s", (quiz_json, history_id))
        db.commit()
        return jsonify({"message": "Quiz saved"}), 200
    except Exception as e:
        print(f"Error saving quiz: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

@app.route("/save_score", methods=["POST"])
@jwt_required()
def save_score():
    data = request.get_json()
    history_id = data.get("historyId")
    score = data.get("score")
    total = data.get("total")
    
    if history_id is None or score is None or total is None:
        return jsonify({"error": "Missing data"}), 400
    
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("UPDATE search_history SET quiz_score = %s, quiz_total = %s WHERE id = %s", (score, total, history_id))
        db.commit()
        return jsonify({"message": "Score saved"}), 200
    except Exception as e:
        print(f"Error saving score: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

@app.route("/video", methods=["POST"])
@jwt_required()
def generate_video_route():
    try:
        data = request.get_json()
        text = data.get("text")
        keyword = data.get("keyword", "technology")
        history_id = data.get("historyId") 
        
        print(f"Request for background video: {keyword}, History ID: {history_id}")
        
        if not text: return jsonify({"error": "No text provided"}), 400

        db = get_db()
        cur = db.cursor()

        # 1. Check for global cache
        cur.execute("SELECT video_filename FROM search_history WHERE query = %s AND video_filename IS NOT NULL ORDER BY timestamp DESC LIMIT 1", (keyword,))
        cached = cur.fetchone()
        cur.close()
        
        permanent_filename = None
        if cached and cached[0]:
            temp_filename = cached[0]
            temp_path = os.path.join(VIDEO_STORAGE_DIR, temp_filename)
            if os.path.exists(temp_path):
                permanent_filename = temp_filename
                
        if permanent_filename:
            return jsonify({"status": "completed", "video_url": f"/get_video/{permanent_filename}"})

        # 2. Dispatch to background worker
        task_id = str(uuid.uuid4())
        video_tasks[task_id] = {"status": "processing", "video_url": None, "error": None}
        video_executor.submit(_video_worker, task_id, text, keyword, history_id)
        
        return jsonify({"status": "processing", "task_id": task_id}), 202

    except Exception as e:
        print(f"CRITICAL ERROR in /video: {e}")
        return jsonify({"error": str(e)}), 500

def _video_worker(task_id, text, keyword, history_id):
    try:
        temp_video_path = create_video_from_summary(text, keyword)
        if not temp_video_path or not os.path.exists(temp_video_path):
            video_tasks[task_id] = {"status": "error", "error": "Video generation failed"}
            return
        
        permanent_filename = f"{uuid.uuid4()}.mp4"
        permanent_path = os.path.join(VIDEO_STORAGE_DIR, permanent_filename)
        shutil.move(temp_video_path, permanent_path)
        
        if history_id:
            with app.app_context(): # required if db needs context
                db = get_db()
                cur = db.cursor()
                try:
                    cur.execute("UPDATE search_history SET video_filename = %s WHERE id = %s", (permanent_filename, history_id))
                    db.commit()
                except Exception as e:
                    print(f"Background DB update failed: {e}")
                finally:
                    cur.close()

        video_tasks[task_id] = {
            "status": "completed", 
            "video_url": f"/get_video/{permanent_filename}"
        }
    except Exception as e:
        video_tasks[task_id] = {"status": "error", "error": str(e)}

@app.route("/video/status/<task_id>", methods=["GET"])
def get_video_status(task_id):
    task = video_tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)

@app.route("/get_video/<filename>")
def serve_video(filename):
    return send_from_directory(VIDEO_STORAGE_DIR, filename)

@app.route("/mcqs", methods=["POST"])
def get_mcqs():
    data = request.get_json()
    text = data.get("text")
    if not text: return "No text provided for MCQs", 400
    return jsonify(generate_mcqs(text))

@app.route("/evaluate", methods=["POST"])
def evaluate():
    data = request.get_json()
    answers = data.get("answers", [])
    results = []
    for ans in answers:
        q, sel, cor = ans.get("question"), ans.get("selected"), ans.get("correct")
        is_correct = (sel == cor)
        results.append({
            "question": q, "selected": sel, "correct": is_correct,
            "explanation": "✅ Correct!" if is_correct else evaluate_explanation(q, sel, cor)
        })
    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)