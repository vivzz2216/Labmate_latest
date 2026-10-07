import asyncio
import os
from playwright.async_api import async_playwright

async def generate_video():
    out_dir = os.path.abspath(r"frontend\public\videos")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "hero_labmate.webm")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="msedge")
        page = await browser.new_page(viewport={"width": 1280, "height": 720})

        loop = asyncio.get_running_loop()
        future = loop.create_future()

        async def save_blob(base64_data):
            import base64
            raw = base64.b64decode(base64_data)
            with open(out_path, "wb") as f:
                f.write(raw)
            print(f"Video saved successfully! Size: {len(raw)} bytes")
            if not future.done():
                future.set_result(True)

        await page.expose_function("onRecordingComplete", save_blob)

        html = """
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; background: #000; overflow: hidden; }
            canvas { width: 1280px; height: 720px; }
          </style>
        </head>
        <body>
          <canvas id="c" width="1280" height="720"></canvas>
          <script>
            const canvas = document.getElementById('c');
            const ctx = canvas.getContext('2d');
            
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp9',
              videoBitsPerSecond: 3000000
            });
            const chunks = [];
            
            recorder.ondataavailable = e => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'video/webm' });
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                window.onRecordingComplete(base64);
              };
              reader.readAsDataURL(blob);
            };

            recorder.start(100); // chunk every 100ms

            let frame = 0;
            const totalFrames = 180; // 6 seconds

            // Star/particle field
            const particles = [];
            for (let i = 0; i < 70; i++) {
              particles.push({
                x: Math.random() * 1280,
                y: Math.random() * 720,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                r: Math.random() * 2 + 1,
                alpha: Math.random() * 0.7 + 0.3
              });
            }

            function draw() {
              // Deep pure black background like Runway
              ctx.fillStyle = '#050508';
              ctx.fillRect(0, 0, 1280, 720);

              // Faint architectural grid lines
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
              ctx.lineWidth = 1;
              for (let x = 0; x < 1280; x += 64) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke();
              }
              for (let y = 0; y < 720; y += 64) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
              }

              // Subtle ambient glow
              const t = frame * 0.04;
              const grad = ctx.createRadialGradient(
                640 + Math.sin(t) * 80, 360 + Math.cos(t) * 40, 20,
                640, 360, 480
              );
              grad.addColorStop(0, 'rgba(120, 119, 198, 0.22)');
              grad.addColorStop(0.4, 'rgba(79, 70, 229, 0.08)');
              grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, 1280, 720);

              // Floating neural particles
              for (let p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = 1280;
                if (p.x > 1280) p.x = 0;
                if (p.y < 0) p.y = 720;
                if (p.y > 720) p.y = 0;

                ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.5})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
              }

              // Terminal card with Runway-style sleek border and glassmorphism
              ctx.fillStyle = 'rgba(15, 17, 23, 0.88)';
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.roundRect(200, 110, 880, 500, 14);
              ctx.fill();
              ctx.stroke();

              // Top window header
              ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
              ctx.beginPath();
              ctx.roundRect(200, 110, 880, 48, [14, 14, 0, 0]);
              ctx.fill();

              // Window controls
              ctx.fillStyle = '#ff5f56'; ctx.beginPath(); ctx.arc(230, 134, 5.5, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(248, 134, 5.5, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#27c93f'; ctx.beginPath(); ctx.arc(266, 134, 5.5, 0, Math.PI * 2); ctx.fill();

              // Header text & badge
              ctx.fillStyle = '#f8fafc';
              ctx.font = '600 13px -apple-system, sans-serif';
              ctx.fillText('LABMATE INTELLIGENCE ENGINE', 295, 138);

              ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
              ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
              ctx.beginPath();
              ctx.roundRect(930, 122, 120, 24, 6);
              ctx.fill(); ctx.stroke();
              ctx.fillStyle = '#34d399';
              ctx.font = '11px monospace';
              ctx.fillText('● LIVE ENGINE', 944, 138);

              // Live Terminal Output lines
              ctx.font = '14px "JetBrains Mono", Consolas, monospace';
              const logLines = [
                { text: 'λ [INGESTION] Source: Operating_Systems_Lab_Exam.pdf', color: '#94a3b8' },
                { text: 'λ [AST_PARSER] Detected 5 programs | Multi-turn reasoning initialized', color: '#818cf8' },
                { text: 'λ [SYNTHESIS]  Generating kernel scheduler (Round Robin & Multi-Level Queue)', color: '#c084fc' },
                { text: 'λ [SANDBOX]    Enforcing RLIMIT_AS (512MB) & Universal static security check', color: '#38bdf8' },
                { text: 'λ [EXECUTION]  gcc -O2 scheduler.c -o scheduler && ./scheduler', color: '#e2e8f0' },
                { text: '               >> Process 104 completed in 12ms. Context switch overhead: 0.4%', color: '#34d399' },
                { text: '               >> Average Turnaround Time: 14.2ms | Tests: 5/5 PASSED', color: '#34d399' },
                { text: 'λ [CAPTURE]    High-res genuine screenshot snapped (1920x1080 timestamped)', color: '#f472b6' },
                { text: 'λ [DOCX_GEN]   Compiling collegiate report with pagination and college headers', color: '#fbbf24' },
                { text: 'λ [COMPLETED]  Word Report & Execution Artifacts synced to Student Workspace 🚀', color: '#ffffff' }
              ];

              const progress = frame / totalFrames;
              const lineCount = Math.min(logLines.length, Math.floor(progress * (logLines.length + 3)));

              for (let i = 0; i < lineCount; i++) {
                const item = logLines[i];
                ctx.fillStyle = item.color;
                ctx.fillText(item.text, 230, 195 + i * 38);
              }

              // Blinking prompt cursor
              if (Math.floor(frame / 8) % 2 === 0 && lineCount < logLines.length) {
                const curY = 195 + lineCount * 38;
                ctx.fillStyle = '#6366f1';
                ctx.fillRect(230, curY - 12, 8, 16);
              }

              frame++;
              if (frame < totalFrames) {
                requestAnimationFrame(draw);
              } else {
                recorder.stop();
              }
            }

            draw();
          </script>
        </body>
        </html>
        """

        await page.set_content(html)
        await asyncio.wait_for(future, timeout=25)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(generate_video())
