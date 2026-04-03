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

    structure = "Definition :, Syntax:, Types:, Uses:, Simple Example:, Advantages:, Disadvantages:"
    
    prompt = f"""
    Generate a comprehensive educational script for "{topic}". 
    Target length: at least 1000 words. Proceed with whatever length is generated if it falls short.
    {context_instruction}
    
    Follow this structure strictly with these exact header labels:
    Definition : 
    (Provide a detailed definition)
    
    Syntax:
    (Provide the syntax or structural rules)
    
    Types:
    (List the types if applicable, otherwise summarize categories)
    
    Uses:
    (List the practical applications)
    
    Simple Example:
    (Provide a clear, standalone example. If programming, provide the code here. DO NOT use backquotes.)
    
    Advantages:
    (List the benefits)
    
    Disadvantages:
    (List the drawbacks)

    CRITICAL FORMATTING RULES:
    1. DO NOT use asterisks (*), double asterisks (**), underscores (_), or backquotes (`) anywhere in the output.
    2. For sections that require lists (Types, Uses, Advantages, Disadvantages), use numeric labels like "1.", "2.", "3." etc.
    3. The header labels MUST be exactly as shown above (e.g., "Definition :", "Syntax:").
    4. Provide the content in plain text format only. No markdown formatting for bold, italic, or code blocks.
    """
    try:
        result = subprocess.run(["ollama", "run", "gemma:2b"], input=prompt.encode("utf-8"), capture_output=True, timeout=600)
        output = result.stdout.decode("utf-8", errors="ignore").strip()
        
        # Post-processing: Forcefully remove common markdown symbols as requested by user for TTS safety
        if output and not output.startswith("Error:"):
            # Remove asterisks, backquotes, and underscores
            output = re.sub(r'[*_`]', '', output)
            # Ensure multiple newlines are normalized but kept for paragraph splitting
            output = re.sub(r'\n{3,}', '\n\n', output)
            
        return output or "Error: Empty output"
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

def generate_performance_analysis(topic, answers_data):
    performance_summary = ""
    for idx, item in enumerate(answers_data):
        status = "Correct" if item['is_correct'] else "Incorrect"
        performance_summary += f"Q{idx+1}: {item['question']}\nCandidate Answer: {item['selected']}\nCorrect Answer: {item['correct']}\nResult: {status}\n\n"

    prompt = f"""
    You are an expert technical interviewer and mentor. Analyze the candidate's performance in a mock test about "{topic}".
    
    Candidate's performance details:
    {performance_summary}
    
    Based on this data, provide a structured feedback report with the following sections exactly:
    
    Strengths
    [Summary of what they did well, e.g., "Mastered basic concepts of {topic}, algorithms, and functions."]
    
    Areas for Improvement
    [Specific topics where they struggled, e.g., "Nuances of version control, integration testing vs end-to-end testing."]
    
    Recommended Topics
    - [Topic Name]: [Brief explanation of why it's recommended]
    
    Learning Path
    [Topic Name]
    Steps:
    - [Step 1]
    - [Step 2]
      
    Tone: Professional, encouraging, and highly technical. 
    Format: Use the exact headers "Strengths", "Areas for Improvement", "Recommended Topics", and "Learning Path". Use bullet points for steps. No bold or italic markdown.
    """
    try:
        result = subprocess.run(["ollama", "run", "gemma:2b"], input=prompt.encode("utf-8"), capture_output=True, timeout=300)
        return result.stdout.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        return f"Error generating performance analysis: {e}"
