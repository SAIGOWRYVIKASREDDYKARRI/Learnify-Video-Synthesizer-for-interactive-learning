import os
import re
import random
import tempfile
import textwrap
import concurrent.futures
import requests
from gtts import gTTS
from PIL import Image, ImageDraw, ImageFont
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
from pydub import AudioSegment
from avatar_service import create_classroom_slide

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
DEFAULT_IMAGE = "default.png" 

def download_image(url):
    try:
        if not url: return None
        img_data = requests.get(url, timeout=5).content
        tmp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        with open(tmp_img.name, "wb") as f:
            f.write(img_data)
        return tmp_img.name
    except:
        return None

def fetch_topic_images(keyword, count=15):
    """Fetch multiple images in parallel."""
    images = []
    urls = []
    try:
        url = f"https://api.unsplash.com/search/photos?query={keyword}&orientation=landscape&per_page={count}&client_id={UNSPLASH_ACCESS_KEY}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            urls = [item["urls"]["regular"] for item in data.get("results", [])]
    except Exception as e:
        print("Unsplash API Error:", e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = executor.map(download_image, urls)
        images = [r for r in results if r]

    return images if images else [DEFAULT_IMAGE]

def generate_tts_audio(text, speed=False):
    """Generate audio file for text. Returns path."""
    try:
        tts = gTTS(text=text, lang='en', slow=False)
        f = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(f.name)
        f.close()
        return f.name
    except Exception as e:
        print("TTS Error:", e)
        return None

def create_video_from_summary(text, keyword):
    """Refactored logic to generate video from summary text."""
    # 1. Fetch Images (Parallel)
    topic_images = fetch_topic_images(keyword, count=15)

    # 2. Parse Text into Valid Slides
    parts = re.split(r'((?:```[\s\S]*?```)|(?:\[\[\[TABLE\]\]\][\s\S]*?\[\[\[TABLE\]\]\]))', text)
    
    slides_data = [] 
    for part in parts:
        part = part.strip()
        if not part: continue
        
        if part.startswith("```") and part.endswith("```"):
            code_content = part.strip("`").strip()
            if code_content.startswith("python") or code_content.startswith("java") or code_content.startswith("cpp"):
                 code_content = code_content.split('\n', 1)[-1]
            slides_data.append({'type': 'code', 'content': code_content})
        elif part.startswith("[[[TABLE]]]") and part.endswith("[[[TABLE]]]"):
            table_content = part.replace("[[[TABLE]]]", "").strip()
            slides_data.append({'type': 'comparison', 'content': table_content})
        else:
            paragraphs = [p.strip() for p in part.split('\n\n') if p.strip()]
            for para in paragraphs:
                if len(para) > 300:
                     sentences = re.split(r'(?<=[.!?])\s+', para)
                     current_chunk = ""
                     for s in sentences:
                         if len(current_chunk) + len(s) < 250:
                             current_chunk += s + " "
                         else:
                             slides_data.append({'type': 'text', 'content': current_chunk.strip()})
                             current_chunk = s + " "
                     if current_chunk:
                         slides_data.append({'type': 'text', 'content': current_chunk.strip()})
                else:
                    slides_data.append({'type': 'text', 'content': para})

    # 3. Generate Audio for all text slides (Parallel)
    slides_data = [s for s in slides_data if s['content']]
    tts_tasks = []
    for i, slide in enumerate(slides_data):
        if slide['type'] == 'text':
            tts_tasks.append((i, slide['content']))
        elif slide['type'] == 'code':
            tts_tasks.append((i, f"Here is a code example. The code is: {slide['content']}"))
        elif slide['type'] == 'comparison':
             clean_text = slide['content'].replace("|", ". ")
             tts_tasks.append((i, f"Comparison Table. {clean_text}"))

    audio_map = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_index = {executor.submit(generate_tts_audio, t[1]): t[0] for t in tts_tasks}
        for future in concurrent.futures.as_completed(future_to_index):
            idx = future_to_index[future]
            audio_path = future.result()
            audio_map[idx] = audio_path

    # 4. Create Clips
    video_clips = []
    combined_audio = AudioSegment.empty()

    for i, slide in enumerate(slides_data):
        audio_path = audio_map.get(i)
        if not audio_path: continue
        
        audio_segment = AudioSegment.from_file(audio_path)
        duration_sec = len(audio_segment) / 1000.0
        combined_audio += audio_segment

        # Visual Generation
        img = Image.new("RGB", (1280, 720), "#FFFFFF")
        draw = ImageDraw.Draw(img)
        colors = [((255, 183, 197), (255, 221, 225)), ((173, 216, 230), (224, 255, 255)), ((200, 230, 201), (232, 245, 233))]
        c1, c2 = random.choice(colors)
        for y in range(720):
            r = int(c1[0] + (c2[0] - c1[0]) * y / 720)
            g = int(c1[1] + (c2[1] - c1[1]) * y / 720)
            b = int(c1[2] + (c2[2] - c1[2]) * y / 720)
            draw.line([(0, y), (1280, y)], fill=(r, g, b))

        if slide['type'] == 'code':
            try: font = ImageFont.truetype("consola.ttf", 24) 
            except: 
                try: font = ImageFont.truetype("arial.ttf", 24)
                except: font = ImageFont.load_default()
            draw.rectangle([(50, 50), (1230, 670)], fill=(30, 30, 30))
            lines = slide['content'].split('\n')
            y_text = 80
            for line in lines:
                if y_text > 650: break
                draw.text((70, y_text), line, fill=(200, 255, 200), font=font)
                y_text += 30
            draw.text((70, 50), "Code Example", fill=(255, 255, 255), font=font)

        elif slide['type'] == 'comparison':
            try: font = ImageFont.truetype("arial.ttf", 28)
            except: font = ImageFont.load_default()
            draw.line([(640, 50), (640, 670)], fill=(0,0,0), width=3)
            rows = [r for r in slide['content'].split('\n') if "|" in r]
            if not rows: continue
            try:
                header_parts = rows[0].split('|')
                left_header = header_parts[1].strip() if len(header_parts) > 1 else "Topic A"
                right_header = header_parts[2].strip() if len(header_parts) > 2 else "Topic B"
                heading_font = ImageFont.truetype("arial.ttf", 36)
                draw.text((150, 50), left_header, fill=(0,0,100), font=heading_font)
                draw.text((790, 50), right_header, fill=(0,0,100), font=heading_font)
                y_pos = 120
                for row in rows[1:]:
                    parts = row.split('|')
                    if len(parts) < 3: continue
                    left_lines = textwrap.wrap(parts[1].strip(), width=35)
                    right_lines = textwrap.wrap(parts[2].strip(), width=35)
                    max_lines = max(len(left_lines), len(right_lines))
                    for i in range(max_lines):
                        if i < len(left_lines): draw.text((60, y_pos), left_lines[i], fill=(0,0,0), font=font)
                        if i < len(right_lines): draw.text((700, y_pos), right_lines[i], fill=(0,0,0), font=font)
                        y_pos += 35
                    y_pos += 20
                    if y_pos > 700: break
            except Exception as e:
                print("Table Render Error:", e)
                draw.text((50, 50), slide['content'], fill=(0,0,0), font=font)
        else:
            layout = random.choice(["left", "right"])
            margin, image_region_width = 50, 450
            text_region_width = 1280 - image_region_width - (margin * 3)
            
            # Default layout values in case image loading fails
            text_start_x = (margin + image_region_width + margin) if layout == "left" else margin
            
            if topic_images:
                selected_image = random.choice(topic_images)
                try:
                    icon = Image.open(selected_image).convert("RGBA")
                    icon.thumbnail((image_region_width, 600), Image.LANCZOS)
                    img_x = (margin + (image_region_width - icon.width) // 2) if layout == "left" else (1280 - margin - image_region_width + (image_region_width - icon.width) // 2)
                    text_start_x = (margin + image_region_width + margin) if layout == "left" else margin
                    img_y = (720 - icon.height) // 2
                    img.paste(icon, (int(img_x), int(img_y)), icon)
                except Exception as e:
                    print(f"Image paste failed for {selected_image}: {e}")
                    # Fallback to center text if image fails
                    text_region_width = 1280 - (margin * 2)
                    text_start_x = margin
            try: font = ImageFont.truetype("arial.ttf", 40)
            except: font = ImageFont.load_default()
            lines = textwrap.wrap(slide['content'], width=32)
            line_height = 60
            y_text = (720 - (line_height * len(lines))) // 2
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                x_text = text_start_x + (text_region_width - (bbox[2] - bbox[0])) // 2
                draw.text((int(x_text), int(y_text)), line, fill=(0, 0, 0), font=font)
                y_text += line_height

        # Visual Generation: Use Classroom Layout (Lime style) for text slides
        if slide['type'] == 'text':
            selected_image = random.choice(topic_images) if topic_images else None
            clip = create_classroom_slide(slide['content'], duration_sec, image_path=selected_image)
            clip = clip.fadein(0.5).fadeout(0.5)
        else:
            # For code/comparison, still use existing logic but maybe add avatar overlay
            img_file = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            img.save(img_file.name)
            clip = ImageClip(img_file.name).set_duration(duration_sec).fadein(0.5).fadeout(0.5)
            
        video_clips.append(clip)

    if not video_clips: return None

    final_video = concatenate_videoclips(video_clips, method="compose", padding=-0.2)
    
    # 5. Loop to 10 minutes (600 seconds) as requested by user
    target_duration = 600
    current_duration = final_video.duration
    if current_duration > 0 and current_duration < target_duration:
        n_loops = int(target_duration // current_duration) + 1
        print(f"Looping video {n_loops} times to reach {target_duration}s (current: {current_duration}s)")
        # Loop audio
        combined_audio = combined_audio * n_loops
        combined_audio = combined_audio[:target_duration * 1000]
        # Loop video
        final_video = concatenate_videoclips([final_video] * n_loops).set_duration(target_duration)

    final_audio_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    combined_audio.export(final_audio_file.name, format="mp3")
    final_video = final_video.set_audio(AudioFileClip(final_audio_file.name))
    
    output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    final_video.write_videofile(output_file.name, fps=24, codec="libx264", preset="ultrafast")
    return output_file.name
