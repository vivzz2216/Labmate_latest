import api, { apiService } from "./api";

export type LabLanguage =
  | "auto"
  | "python"
  | "java"
  | "c"
  | "cpp"
  | "html"
  | "react"
  | "node"
  | "theory";
export interface LabQuestion {
  id: number;
  text: string;
  language: LabLanguage;
}
export interface LabResult {
  id: number;
  question: string;
  answer: string;
  code: string;
  language: string;
  output: string;
  error: string;
  status: string;
  screenshots: number;
}
export interface LabWorkflow {
  id: number;
  upload_id: number;
  status: "queued" | "extracting" | "ready" | "processing" | "completed" | "failed" | "paused";
  queue_position: number | null;
  stage: string;
  progress: number;
  questions: LabQuestion[];
  results: LabResult[];
  logs: { time: string; message: string }[];
  error: string | null;
  language: LabLanguage;
  instructions: string;
  output_name: string;
  report: {
    id: number;
    filename: string;
    size: number;
    download_url: string;
  } | null;
}

export type ManualMode = "code_only" | "theory_and_code";

export interface BatchItem {
  id: string;
  file: File;
  uploadId?: number;
  status: "idle" | "uploading" | "extracting" | "ready" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  error?: string | null;
  workflow?: LabWorkflow | null;
  reportId?: number;
  reportFilename?: string;
}

export const workflowApi = {
  async extract(uploadId: number): Promise<LabWorkflow> {
    return (await api.post(`/api/workflows/${uploadId}/extract`)).data;
  },
  async status(uploadId: number): Promise<LabWorkflow> {
    return (await api.get(`/api/workflows/${uploadId}`)).data;
  },
  async process(
    uploadId: number,
    data: {
      questions: LabQuestion[];
      language: LabLanguage;
      instructions: string;
      output_name: string;
      screenshot_style?: string;
      mode?: ManualMode;
    },
  ): Promise<LabWorkflow> {
    return (await api.post(`/api/workflows/${uploadId}/process`, data)).data;
  },
  async preview(uploadId: number): Promise<string> {
    return (
      await api.get(`/api/workflows/${uploadId}/preview`, {
        responseType: "text",
      })
    ).data;
  },
  async batchStatus(batchId: string): Promise<any> {
    return (await api.get(`/api/workflows/batch/${batchId}`)).data;
  },
  async downloadBatchZip(batchId: string): Promise<Blob> {
    const response = await api.get(`/api/workflows/batch/${batchId}/download-zip`, {
      responseType: "blob",
    });
    return response.data;
  },
};

export async function saveReport(reportId: number, filename: string) {
  const blob = await apiService.downloadReport(reportId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string"
    ? detail
    : "The request could not finish. Please try again.";
}
