from youtube_transcript_api import YouTubeTranscriptApi
from googletrans import Translator
import re

def get_video_id(url):
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    return match.group(1) if match else None

def fetch_dynamic_captions(url):
    video_id = get_video_id(url)
    if not video_id:
        print("Invalid YouTube URL")
        return

    try:
        api = YouTubeTranscriptApi()
        transcripts = api.list(video_id)

        # Collect available languages
        available_langs = [t.language_code for t in transcripts]
        print("\nAvailable caption languages:", available_langs)

        # Prefer English if available, else first available
        if "en" in available_langs:
            lang_code = "en"
        else:
            lang_code = available_langs[0]

        # Fetch captions
        transcript = api.fetch(video_id, languages=[lang_code])
        captions_text = " ".join([entry.text for entry in transcript])

        # If captions are already English
        if lang_code == "en":
            print("\n=== English Captions ===\n")
            print(captions_text)

        else:
            # Translate to English
            translator = Translator()
            translated = translator.translate(captions_text, src=lang_code, dest="en")

            print(f"\n=== Original Captions ({lang_code}) ===\n")
            print(captions_text)

            print("\n=== Translated to English ===\n")
            print(translated.text)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    url = input("Enter YouTube video URL: ")
    fetch_dynamic_captions(url)
