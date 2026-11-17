# Homepage pricing — direction contract

Mode: Persuade. Scope: replace only the existing homepage pricing section inside the established dark homepage; code-led implementation. No global identity replacement.

User-confirmed direction: dark pricing with a compact Diwali accent. Preserve server prices, credit counts, offer expiry, trial allowance and Razorpay checkout routes. Preserve the protected owner check and public ₹1 payment check. Do not invent usage numbers, popularity, guarantees or subscription products.

FIRST VIEWPORT: A strong left-aligned two-line headline with the homepage's serif italic counterpoint. The current oversized festive banner becomes a single compact amber offer strip. Four paid tiers form a unified comparison with one warm-paper recommended tier. The ₹1 payment check is a separate, subordinate row rather than competing with the paid tiers.

Signature interaction: A small experiment-count calculator recommends the least expensive single pack covering the entered count, using only the current server catalogue. Never include test packs in this recommendation. Invalid input and counts exceeding a single pack have explicit states. Prices and checkout are never computed authoritatively in the client.

Hierarchy: headline/free trial → compact real offer → paid tiers → shared included features → payment checks → experiment-credit explanation and calculator → two relevant FAQ disclosures / Razorpay attribution.

Visual contract: existing monochrome homepage world; near-black base, thin neutral rules, warm ivory emphasis, restrained gold only for offer and focus. Real plan content, no generated scene assets. Responsive: four columns desktop, two tablet, one mobile. Keep every pack and action reachable. Distinct hover/focus/disabled/loading/error/empty states. Preserve checkout component and payment backend.

Evidence: incumbent live pricing capture at .impeccable/review/pricing-before.png. Code-led build has no approved image comp; the current homepage is the brand reference. PRODUCT.md's light-blue homepage note predates the current deployed dark homepage and is stale; no unrelated repair is authorized.

Final implementation: `frontend/components/billing/PricingSection.tsx` and its scoped `PricingSection.module.css` retain the incumbent homepage's dark surfaces, neutral dividers, sans-serif hierarchy and italic serif counterpoint. The warm-paper Lab Pack and compact amber Diwali strip are local pricing treatments, not new global rules. Four/two/one-column comparison, separate payment-check rails, server-catalogue calculator and FAQ disclosures implement the chosen direction. The sole review fix moved plan status labels beside their headings; final review verdict: pass, disposition: ship.

Final evidence checked: `.impeccable/review/desktop-section.png`, `mobile-section.png`, `desktop.png` and `mobile.png`, compared with `frontend/app/page.tsx` and `home.module.css`. Desktop and 390px mobile retain the incumbent homepage relationship with no reported overflow. TypeScript, target ESLint and five existing checkout tests passed; detector returned `[]`. Browser checks covered calculator counts 1/11/36/81 selecting Quick/Lab/Semester/College, 301 showing the multi-pack message, blank/invalid input, opening FAQs, six correct checkout links and no console errors. Final screenshots used Playwright after the in-app long mobile capture failed. Backend prices, credits and checkout remain authoritative; no payment was made.

Documentation boundary: ordinary extension only. `PRODUCT.md` remains unchanged despite its pre-existing stale light-blue direction; the absent root `DESIGN.md` and `.impeccable/design.json` remain absent. No global visual system was approved or created, and unrelated drift was neither repaired nor canonized.
