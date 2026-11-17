import catalog from "./lab-catalog.json";
import type { LabCategory } from "./labCatalog";
export const SMA_CATEGORY = catalog.find(category => category.slug === "social-media-analytics") as LabCategory;
