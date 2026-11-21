import api from "@/lib/api";

export interface PollOption { id: number; label: string; votes: number; percent: number }
export interface Poll {
  id: number;
  question: string;
  description: string | null;
  open: boolean;
  created_at: string | null;
  closes_at: string | null;
  total_votes: number;
  my_option_id: number | null;
  options: PollOption[];
}
export interface FeatureUpdate { id: number; title: string; body: string; tag: string | null; created_at: string | null }
export interface CommunitySummary { latest_update_id: number; unanswered_polls: number }
export interface PublicReview { id: number; rating: number; message: string; created_at: string | null }
export interface PublicReviews { total: number; average_rating: number | null; reviews: PublicReview[] }

const SEEN_KEY = "labmate.updates.seen.v1";

export async function getSummary(signal?: AbortSignal): Promise<CommunitySummary> {
  return (await api.get("/api/community/summary", { signal })).data;
}
export async function getPolls(signal?: AbortSignal): Promise<Poll[]> {
  return (await api.get("/api/polls", { signal })).data.polls;
}
export async function votePoll(pollId: number, optionId: number): Promise<Poll> {
  return (await api.post(`/api/polls/${pollId}/vote`, { option_id: optionId })).data;
}
export async function getUpdates(signal?: AbortSignal): Promise<FeatureUpdate[]> {
  return (await api.get("/api/updates", { signal })).data.updates;
}
/** `fresh` skips the 60-second public cache so a student sees their own review right after sending it. */
export async function getReviews(limit = 6, offset = 0, signal?: AbortSignal, fresh = false): Promise<PublicReviews> {
  const bust = fresh ? `&_=${Date.now()}` : "";
  return (await api.get(`/api/feedback/reviews?limit=${limit}&offset=${offset}${bust}`, { signal })).data;
}

export async function adminCreatePoll(body: { question: string; description?: string; options: string[]; closes_in_days?: number }): Promise<Poll> {
  return (await api.post("/api/admin/polls", body)).data;
}
export async function adminClosePoll(id: number): Promise<Poll> {
  return (await api.post(`/api/admin/polls/${id}/close`)).data;
}
export async function adminDeletePoll(id: number): Promise<void> {
  await api.delete(`/api/admin/polls/${id}`);
}
export async function adminCreateUpdate(body: { title: string; body: string; tag?: string }): Promise<FeatureUpdate> {
  return (await api.post("/api/admin/updates", body)).data;
}
export async function adminDeleteUpdate(id: number): Promise<void> {
  await api.delete(`/api/admin/updates/${id}`);
}

export function lastSeenUpdate(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY) || 0);
  } catch {
    return 0;
  }
}
export function markUpdatesSeen(id: number): void {
  try {
    window.localStorage.setItem(SEEN_KEY, String(id));
    window.dispatchEvent(new Event("labmate-updates-seen"));
  } catch {
    /* storage blocked */
  }
}

export function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}
