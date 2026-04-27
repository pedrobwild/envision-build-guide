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

export type BulkActionType =
  | "financial_adjustment"
  | "status_change"
  | "assign_owner"
  | "priority_change"
  | "validity_change"
  | "due_date_change"
  | "pipeline_change"
  | "pipeline_stage_change"
  | "archive";

export type BulkFilters = {
  created_from: string | null;
  created_to: string | null;
  pipeline_stages?: string[] | null;
  internal_statuses?: string[] | null;
};

export type BulkOperationPlan = {
  operation_id: string;
  action_type: BulkActionType;
  summary: string;
  reasoning?: string;
  filters: BulkFilters;
  params: Record<string, unknown>;
  rows: BulkPlanRow[];
  applicable_count: number;
  protected_count: number;
  total_before: number;
  total_after: number;
  /** True se o backend rodará o apply em background (operations > 50 orçamentos). */
  will_run_in_background?: boolean;
  background_threshold?: number;
};

export type BulkOpStatus = "pending" | "applied" | "failed" | "reverted";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  /** End-to-end correlation id (also logged on the edge function and upstream calls). */
  correlationId?: string;
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
