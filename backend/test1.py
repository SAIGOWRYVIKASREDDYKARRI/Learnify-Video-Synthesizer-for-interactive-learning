import subprocess
import json
import re

def query_ollama(topic):
    try:
        prompt = f"""
        Write a detailed explanation of the topic "{topic}".
        Respond ONLY in valid JSON with exactly these keys:
        - definition: 2-3 sentences
        - examples: 2-3 detailed examples (about 100-150 words each)
        - explanation: a long essay of around 1000 words, structured in paragraphs
        If you cannot follow JSON formatting, just write plain text.
        """

        # Run Ollama with mistral:7b
        result = subprocess.run(
            ["ollama", "run", "mistral:7b"],
            input=prompt.encode("utf-8"),  # ensure utf-8 input
            capture_output=True
        )

        if result.returncode != 0:
            print("Ollama CLI error:", result.stderr.decode("utf-8", errors="ignore").strip())
            return None

        # Decode model output safely
        output = result.stdout.decode("utf-8", errors="ignore").strip()

        # Try to parse as JSON first
        try:
            json_text = re.search(r"\{.*\}", output, re.S).group()
            response_json = json.loads(json_text)
            return response_json
        except Exception:
            # Fallback: return plain text instead
            print("\n--- Plain Text Output ---\n")
            print(output)
            return None

    except Exception as e:
        print("Error:", str(e))
        return None


if __name__ == "__main__":
    topic = input("Enter the topic: ")
    response = query_ollama(topic)

    if response:
        print("\n--- Structured Output ---")
        print("Definition:", response.get("definition", "N/A"))
        print("\nExamples:", response.get("examples", "N/A"))
        print("\nExplanation:\n", response.get("explanation", "N/A"))
