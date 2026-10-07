# LabMate product context

LabMate helps students work through programming-lab assignments from an uploaded PDF or DOCX manual to organized questions, code, execution output, and a downloadable report.

Primary audience: students completing programming labs. Primary action on the public homepage: begin a new assignment or sign in. The public site should feel like a credible, clean software product: light blue and white, clear writing, a still study-desk photograph, and an illustrative workspace preview. Avoid invented adoption numbers, testimonials, ratings, and claims that every runtime is available in every installation.

Product reality: the codebase includes a Next.js frontend and FastAPI backend. The backend has parser, code-generation, execution, screenshot, and report services. Execution includes Python, Java, C/C++, and web-related handlers, subject to available tools and configuration. PostgreSQL is the production data store, not a lab language. The homepage does not list SQL or Ubuntu as student-facing language options.

Current visual direction: match the user-provided LabMate business-homepage reference in structure and tone, excluding its “AI-Powered Lab Assistant for Students” badge and unverified metrics. The hero photograph is static, the product preview is illustrative HTML/CSS, and primary controls remain interactive.
