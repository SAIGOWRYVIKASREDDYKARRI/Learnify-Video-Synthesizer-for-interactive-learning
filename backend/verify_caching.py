import requests
import time
import json

BASE_URL = "http://localhost:5000"
KEYWORD = f"VerificationTest_{int(time.time())}"
USER = {"username": "test_user", "email": "test@example.com"}

def test_caching():
    print(f"Testing caching for keyword: {KEYWORD}")
    
    # 1. Add Search
    res = requests.post(f"{BASE_URL}/add_search", json={
        "username": USER["username"],
        "email": USER["email"],
        "searches": KEYWORD
    })
    history_id = res.json().get("historyId")
    print(f"Added search, historyId: {history_id}")
    
    # 2. First Summary (should be slow)
    start_time = time.time()
    res = requests.post(f"{BASE_URL}/summary", json={
        "keyword": KEYWORD,
        "historyId": history_id
    })
    first_summary_time = time.time() - start_time
    print(f"First summary took: {first_summary_time:.2f}s")
    summary_text = res.text
    
    # 3. First Video (should be slow)
    start_time = time.time()
    res = requests.post(f"{BASE_URL}/video", json={
        "text": summary_text,
        "keyword": KEYWORD,
        "historyId": history_id
    })
    first_video_time = time.time() - start_time
    print(f"First video took: {first_video_time:.2f}s")
    
    # 4. Second Search (New entry)
    res = requests.post(f"{BASE_URL}/add_search", json={
        "username": USER["username"],
        "email": USER["email"],
        "searches": KEYWORD
    })
    new_history_id = res.json().get("historyId")
    print(f"Added second search, historyId: {new_history_id}")
    
    # 5. Second Summary (should be instant)
    start_time = time.time()
    res = requests.post(f"{BASE_URL}/summary", json={
        "keyword": KEYWORD,
        "historyId": new_history_id
    })
    second_summary_time = time.time() - start_time
    print(f"Second summary (cached) took: {second_summary_time:.2f}s")
    
    # 6. Second Video (should be instant)
    start_time = time.time()
    res = requests.post(f"{BASE_URL}/video", json={
        "text": summary_text,
        "keyword": KEYWORD,
        "historyId": new_history_id
    })
    second_video_time = time.time() - start_time
    print(f"Second video (cached) took: {second_video_time:.2f}s")
    
    if second_summary_time < 1.0 and second_video_time < 1.0:
        print("VERIFICATION SUCCESSFUL: Cached results returned in under 1 second.")
    else:
        print("VERIFICATION FAILED: Cached results were not returned instantly.")

if __name__ == "__main__":
    try:
        test_caching()
    except Exception as e:
        print(f"Verification script error: {e}")
