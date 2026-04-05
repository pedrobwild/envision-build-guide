/**
 * Common lightweight types used across budget components.
 * These complement the full BudgetData types from ./budget.ts
 * and provide typed alternatives to `any` for inline Supabase query results.
 */

import type { Tables, Json } from "@/integrations/supabase/types";

// ─── Budget row from Supabase select("*") ───
export type BudgetRow = Tables<"budgets">;

// ─── Budget with nested sections/adjustments (from joined queries) ───
export interface BudgetWithSections extends BudgetRow {
  sections: SectionWithItems[];
  adjustments: AdjustmentRow[];
}

// ─── Section with nested items ───
export interface SectionWithItems {
  id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  cover_image_url?: string | null;
  tags?: Json;
  included_bullets?: Json;
  excluded_bullets?: Json;
  notes?: string | null;
  is_optional?: boolean;
  budget_id?: string;
  items: ItemWithImages[];
}

// ─── Item with images ───
export interface ItemWithImages {
  id: string;
  title: string;
  description?: string | null;
  order_index?: number;
  qty?: number | null;
  unit?: string | null;
  coverage_type?: string;
  included_rooms?: Json | string[];
  excluded_rooms?: Json | string[];
  internal_total?: number | null;
  internal_unit_price?: number | null;
  bdi_percentage?: number | null;
  reference_url?: string | null;
  section_id?: string;
  catalog_item_id?: string | null;
  catalog_snapshot?: Json | Record<string, unknown> | null;
  notes?: string | null;
  images?: ItemImageRow[];
  item_images?: ItemImageRow[];
}

// ─── Item image row ───
export interface ItemImageRow {
  id?: string;
  url: string;
  is_primary?: boolean | null;
  item_id?: string;
}

export interface AdjustmentRow {
  id: string;
  budget_id?: string;
  label: string;
  amount: number;
  sign: number;
}

// ─── Profile row (minimal) ───
export interface ProfileRow {
  id: string;
  full_name: string | null;
}

// ─── Recharts tooltip props ───
export interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey?: string;
  }>;
  label?: string;
}

// ─── PDF text content item (from pdfjs-dist) ───
export interface PdfTextItem {
  str?: string;
  transform?: number[];
}

// ─── Parsed PDF section for AI import ───
export interface ParsedPdfSection {
  title?: string;
  total?: number | string | null;
  items?: ParsedPdfItem[];
}

export interface ParsedPdfItem {
  title?: string;
  total?: number | string | null;
  qty?: number | null;
  unit?: string | null;
}

// ─── Sync result row ───
export interface SyncResultRow {
  status: string;
  error?: string;
}

// ─── Budget row for editor (from select("*") with sections/items joined) ───
export type EditorBudgetRow = BudgetRow;

// ─── Editor section with items (mutable for local state) ───
export interface EditorSection extends SectionWithItems {
  _expanded?: boolean;
}
