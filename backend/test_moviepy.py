from moviepy.editor import ColorClip
import os

try:
    print("Testing MoviePy...")
    clip = ColorClip(size=(640, 480), color=(255, 0, 0), duration=2)
    clip.write_videofile("test_video.mp4", fps=24, codec="libx264", preset="ultrafast")
    if os.path.exists("test_video.mp4"):
        print("SUCCESS: Video generated successfully.")
        os.remove("test_video.mp4")
    else:
        print("FAILURE: Video file not found after generation.")
except Exception as e:
    print(f"CRITICAL FAILURE: {e}")
