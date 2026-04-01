import os
import re
import random
import subprocess
import threading
import requests
from bs4 import BeautifulSoup
from googlesearch import search as google_search
import spacy

nlp = spacy.load("en_core_web_sm")

def scrape_educational_content_safe(topic, result_container):
    """Actual scraping logic to be run in a thread."""
    try:
        query = f"{topic} site:geeksforgeeks.org OR site:tutorialspoint.com"
        search_results = list(google_search(query, num_results=1))
        if not search_results: return
        url = search_results[0]
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code != 200: return
        soup = BeautifulSoup(response.content, 'html.parser')
        content = []
        for p in soup.find_all('p')[:15]: 
            text = p.get_text().strip()
            if len(text) > 50: content.append(text)
        result_container[0] = "\n".join(content[:5])
    except requests.exceptions.RequestException as e:
        print(f"Scrape network error: {e}")
    except Exception as e:
        print(f"Scrape parsing error: {e}")
def scrape_educational_content(topic):
    """Wrapper to run scraping with timeout."""
    result_container = [""]
    t = threading.Thread(target=scrape_educational_content_safe, args=(topic, result_container))
    t.start()
    t.join(timeout=10)
    return result_container[0]

def query_ollama(topic):
    external_context = scrape_educational_content(topic)
    programming_keywords = ["java", "python", "c++", "javascript", "code", "programming", "sql", "html", "css", "algorithm", "function", "array", "loop"]
    is_programming = any(k in topic.lower() for k in programming_keywords)
    
    context_instruction = f"\nHere is context from educational sources:\n{external_context}\n" if external_context else ""

    if is_programming:
        structure = "1. Definition (100 words), 2. Syntax, 3. Key Concepts, 4. Comparison Table [[[TABLE]]], 5. Code Example (```python...```), 6. Output, 7. Applications, 8. Pros/Cons, 9. Notes, 10. Conclusion."
    else:
        structure = "1. Definition, 2. Process/Mechanism, 3. Importance, 4. Comparison/Types, 5. Notes, 6. Conclusion."

    prompt = f"""
    Generate a 5-minute educational script for "{topic}". Approx 800 words.
    {context_instruction}
    Follow this structure strictly: {structure}
    Format: triple backticks for code, [[[TABLE]]] for tables. No bold/italic in body.
    """
    try:
        result = subprocess.run(["ollama", "run", "gemma:2b"], input=prompt.encode("utf-8"), capture_output=True, timeout=300)
        return result.stdout.decode("utf-8", errors="ignore").strip() or "Error: Empty output"
    except Exception as e:
        return f"Error: {e}"

def extract_keywords(text):
    doc = nlp(text)
    keywords = {token.text for token in doc if token.pos_ in ["PROPN", "NOUN"] and len(token.text) > 4}
    for chunk in doc.noun_chunks:
        if len(chunk.text.split()) > 1 and all(len(w) > 3 for w in chunk.text.split()):
            keywords.add(chunk.text)
    return list(keywords)

def generate_mcqs(text, num_questions=10):
    sentences = [sent.text.strip() for sent in nlp(text).sents if len(sent.text.split()) > 5]
    keywords = extract_keywords(text)
    mcqs = []
    if not keywords or not sentences: return []
    for sent in random.sample(sentences, min(len(sentences), num_questions*2)):
        possible_keywords = [kw for kw in keywords if kw in sent]
        if not possible_keywords: continue
        key = random.choice(possible_keywords)
        distractors = random.sample([kw for kw in keywords if kw != key], k=min(3, len(keywords)-1))
        options = [key] + distractors
        random.shuffle(options)
        mcqs.append({"question": sent.replace(key, "_"), "options": options, "answer": key})
        if len(mcqs) >= num_questions: break
    return mcqs

def evaluate_explanation(question, selected, correct):
    prompt = f"""
    Explain why "{selected}" is wrong and "{correct}" is right for the question: "{question}".
    Tone: educational, 3-5 sentences, plain text.
    """
    try:
        result = subprocess.run(["ollama", "run", "gemma:2b"], input=prompt.encode("utf-8"), capture_output=True)
        return result.stdout.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        return f"Could not generate feedback: {e}"
