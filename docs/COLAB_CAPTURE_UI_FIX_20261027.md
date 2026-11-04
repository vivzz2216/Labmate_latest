# Colab capture consistency and print readability

Fixed the assignment workflow's mixed capture paths. Colab source images previously came from the generic light source renderer while output came from the dark Colab page. Notebook source and execution evidence now both use the existing reference Colab interface. The generic renderer is skipped for the notebook category, including Python tasks explicitly requesting Colab.

The processing sidebar offers a nonblocking Colab screenshot theme selector. Dark is the default; Light is optional. The choice travels in validated question metadata, persists with the existing question JSON, and reaches both the renderer and isolated Matplotlib worker. No database migration is needed. Pure Colab assignments no longer display the unrelated Python IDLE layout control.

Source captures retain every line in sections of at most 22 lines, with original ranges recorded in captions and evidence metadata. Text uses 18 px type at a 1100 px viewport. Outputs and plots have separate, shorter Colab frames. These are views of the same execution receipt, never repeated executions. Oversized sections fail explicitly instead of silently cropping required code or results. Existing external-request blocking remains in place.

Validation: 24 distinct focused pytest cases passed across the successful final runs, covering both theme palettes, plot themes, complete source ranges, one execution per cell, diagnostic failures, workflow reports and planner behavior. TypeScript checking passed. A browser fixture verified desktop/mobile controls, saved preference restoration, request payload and horizontal overflow. Auth/API responses were mocked for this UI fixture; the runtime/report checks used real isolated Python execution.

Both previous Colab test exercises were executed again with their saved generated code in both themes, avoiding additional AI requests. Their computed output is unchanged. Each corrected Word export has 11 screenshots and 10 pages; all pages were rendered in Word and reviewed. Samples and receipts are in `backend/audit_artifacts/colab-ui-20261027/`. These changes were checked locally and have not been deployed to Railway.
