import re
from html.parser import HTMLParser

path = r"C:\Users\pilla\.gemini\antigravity-ide\brain\38c86ca7-53fe-4c40-8602-7a538eeef70a\.system_generated\steps\3933\content.md"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Extract headings
headings = re.findall(r'<h([1-4])[^>]*>(.*?)</h\1>', text, re.DOTALL | re.IGNORECASE)
print("\n--- HEADINGS ---")
for level, content in headings:
    clean = re.sub(r'<[^>]+>', '', content).strip()
    if clean:
        print(f"H{level}: {clean}")

# Extract media / videos
videos = re.findall(r'<video[^>]*>(.*?)</video>', text, re.DOTALL | re.IGNORECASE)
print(f"\n--- VIDEOS ({len(videos)}) ---")
video_tags = re.findall(r'<video[^>]*>', text, re.IGNORECASE)
for v in video_tags[:5]:
    print("Video tag:", v)

sources = re.findall(r'<source[^>]*src=[\"\']([^\"\']+)[\"\']', text, re.IGNORECASE)
print("Sources:", sources[:10])

# Media links
mux_matches = set(re.findall(r'https?://[^\s\"\'\<\>]+(?:\.mp4|\.webm|mux\.com[^\s\"\'\<\>]*)', text))
print("\n--- MEDIA URLS ---")
for m in list(mux_matches)[:10]:
    print(m)

# Find navigation / buttons
btn_matches = re.findall(r'<button[^>]*>(.*?)</button>', text, re.DOTALL | re.IGNORECASE)
print(f"\n--- BUTTONS ({len(btn_matches)}) ---")
for b in btn_matches[:15]:
    clean = re.sub(r'<[^>]+>', '', b).strip()
    if clean:
        print("BTN:", clean)

# Check notable text sections
sections = re.findall(r'<section[^>]*>(.*?)</section>', text, re.DOTALL | re.IGNORECASE)
print(f"\n--- SECTIONS ({len(sections)}) ---")
for s in sections[:5]:
    clean = re.sub(r'<[^>]+>', ' ', s)
    clean = ' '.join(clean.split())
    print("SEC:", clean[:150], "...")
