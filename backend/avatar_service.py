import os
import textwrap
import tempfile
from PIL import Image, ImageDraw, ImageFont
from moviepy.editor import ImageClip, CompositeVideoClip, ColorClip

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
AVATAR_PATH = os.path.join(ASSETS_DIR, "avatar.png")
CLASSROOM_BG_PATH = os.path.join(ASSETS_DIR, "classroom_bg.png")

def create_lime_slide(text, duration, image_path=None):
    """
    Creates a video clip with a solid Lime Green background, black text, 
    and an optional image positioned to avoid collision.
    """
    lime_color = (168, 230, 29) # #A8E61D
    bg_img = Image.new("RGB", (1280, 720), lime_color)
    draw = ImageDraw.Draw(bg_img)
    
    try:
        header_font = ImageFont.truetype("arial.ttf", 55)
        body_font = ImageFont.truetype("arial.ttf", 35)
    except:
        header_font = ImageFont.load_default()
        body_font = ImageFont.load_default()

    paragraphs = text.split('\n\n')
    header_text = paragraphs[0] if paragraphs else ""
    body_text = "\n\n".join(paragraphs[1:]) if len(paragraphs) > 1 else text

    if image_path and os.path.exists(image_path):
        # Layout: Text on Left (60%), Image on Right (40%)
        text_width = 700
        image_width = 400
        margin = 60
        
        # 1. Header (Left Aligned)
        header_lines = textwrap.wrap(header_text, width=25)
        y_pos = 80
        for line in header_lines[:2]:
            draw.text((margin, y_pos), line, fill=(0, 0, 0), font=header_font)
            y_pos += 70

        # 2. Body (Left Aligned)
        body_lines = textwrap.wrap(body_text, width=35)
        y_pos += 30
        for line in body_lines[:12]:
            draw.text((margin, y_pos), line, fill=(0, 0, 0), font=body_font)
            y_pos += 45

        # 3. Image (Right Aligned)
        try:
            icon = Image.open(image_path).convert("RGBA")
            # Resize to fit the allocated area
            icon.thumbnail((image_width, 600), Image.LANCZOS)
            img_x = 1280 - margin - icon.width
            img_y = (720 - icon.height) // 2
            # Handle transparency if any
            bg_img.paste(icon, (int(img_x), int(img_y)), icon if icon.mode == 'RGBA' else None)
        except Exception as e:
            print(f"Image load error: {e}")
    else:
        # Full width layout (Centered Header, Left Body)
        header_lines = textwrap.wrap(header_text, width=35)
        y_pos = 100
        for line in header_lines[:2]:
            bbox = draw.textbbox((0, 0), line, font=header_font)
            x_pos = (1280 - (bbox[2] - bbox[0])) // 2
            draw.text((x_pos, y_pos), line, fill=(0, 0, 0), font=header_font)
            y_pos += 80

        body_lines = textwrap.wrap(body_text, width=50)
        y_pos += 40
        for line in body_lines[:12]:
            draw.text((150, y_pos), line, fill=(0, 0, 0), font=body_font)
            y_pos += 45

    temp_bg = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    bg_img.save(temp_bg.name)
    return ImageClip(temp_bg.name).set_duration(duration)

def create_classroom_slide(text, duration, image_path=None):
    # Backward compatibility alias for video_utils.py
    return create_lime_slide(text, duration, image_path=image_path)





def get_avatar_overlay(duration):
    """Returns a simple moving avatar overlay for corners if needed."""
    try:
        avatar = ImageClip(AVATAR_PATH).set_duration(duration).resize(height=200)
        # Add a subtle "talking" animation (slight scale pulse)
        def pulse(t):
            return 1 + 0.02 * (t % 1) # pulsate 2% every second
        
        avatar = avatar.set_position(("right", "bottom")).margin(bottom=20, right=20, opacity=0)
        return avatar
    except:
        return None
