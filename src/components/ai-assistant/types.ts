export type Attachment = {
  name: string;
  mimeType: string;
  size: number;
  /** image data URL (preview + vision payload) */
  dataUrl?: string;
  /** base64 (no prefix) for non-image files */
  base64?: string;
};

export type BulkPlanRow = {
  budget_id: string;
  sequential_code: string | null;
  client_name: string;
  project_name: string;
  current_status: string;
  before_total: number;
  after_total: number;
  delta: number;
  changes_summary: string;
  protected: boolean;
};

export type BulkActionType = "financial_adjustment" | "status_change" | "assign_owner";

export type BulkOperationPlan = {
  operation_id: string;
  action_type: BulkActionType;
  summary: string;
  reasoning?: string;
  filters: { created_from: string; created_to?: string };
  params: Record<string, unknown>;
  rows: BulkPlanRow[];
  applicable_count: number;
  protected_count: number;
  total_before: number;
  total_after: number;
};

export type BulkOpStatus = "pending" | "applied" | "failed" | "reverted";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  /** When set, render an interactive bulk-op card instead of plain markdown */
  bulkOp?: {
    plan?: BulkOperationPlan;
    status: BulkOpStatus;
    appliedCount?: number;
    /** Number of individual updates that failed during apply (0 = full success). */
    partialFailures?: number;
    error?: string;
    /** Live progress estimate while apply is in flight. */
    progress?: {
      processed: number;
      total: number;
      /** True while we're estimating client-side (real total only known after apply returns). */
      estimated: boolean;
    };
  };
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_FILES = 5;
export const STORAGE_KEY = "ai-assistant-history-v3";

export const ACCEPTED_MIME = [
  "image/*",
  "application/pdf",
  ".pdf,.png,.jpg,.jpeg,.webp,.gif",
  ".xlsx,.xls,.csv",
  ".docx,.txt,.md,.json",
  "audio/*",
  ".mp3,.wav,.m4a,.ogg",
].join(",");
