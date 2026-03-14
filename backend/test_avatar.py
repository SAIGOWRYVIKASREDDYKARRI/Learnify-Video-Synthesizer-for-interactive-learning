from avatar_service import create_classroom_slide
import os

def test_classroom_generation():
    print("Starting classroom slide generation test...")
    text = "Welcome to our lesson on AI. Today we will explore how related photos and flowcharts can be integrated into slides to make them more informative and visually appealing, all while maintaining a clean layout."
    duration = 5
    image_path = "assets/classroom_bg.png" # Using an existing image for testing
    
    try:
        clip = create_classroom_slide(text, duration, image_path=image_path)

        output_path = "test_classroom.mp4"
        clip.write_videofile(output_path, fps=24, codec="libx264")
        print(f"Success! Test video saved to {os.path.abspath(output_path)}")
    except Exception as e:
        print(f"Failed to generate test video: {e}")

if __name__ == "__main__":
    test_classroom_generation()
