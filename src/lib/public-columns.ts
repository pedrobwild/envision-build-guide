// ── Public-safe column lists ──
// These define EXACTLY which columns are returned in public/anonymous contexts.
// Internal fields (ownership, costs, notes, status, briefing) are excluded.

export const PUBLIC_BUDGET_COLUMNS = [
  "id",
  "project_name",
  "client_name",
  "condominio",
  "bairro",
  "metragem",
  "unit",
  "date",
  "validity_days",
  "prazo_dias_uteis",
  "estimated_weeks",
  "versao",
  "version_number",
  "consultora_comercial",
  "email_comercial",
  "status",
  "public_id",
  "show_item_qty",
  "show_item_prices",
  "show_progress_bars",
  "show_optional_items",
  "generated_at",
  "disclaimer",
  "notes",
  "floor_plan_url",
  "view_count",
  "approved_at",
  "approved_by_name",
  "lead_email",
  "lead_name",
  "header_config",
  "budget_pdf_url",
  "manual_total",
  // Addendum-related (visible publicly so client sees badge + summary + delta)
  "is_addendum",
  "addendum_number",
  "addendum_summary",
  "addendum_approved_at",
  "addendum_approved_by_name",
] as const;

export const PUBLIC_BUDGET_SELECT = PUBLIC_BUDGET_COLUMNS.join(", ");

// Fields that are INTERNAL ONLY (never sent to public routes):
// - briefing, demand_context, internal_notes, reference_links
// - internal_status, priority, due_at, closed_at
// - created_by, commercial_owner_id, estimator_owner_id
// - internal_cost, public_token_hash
// - property_type, city (used internally for triage)

export const PUBLIC_SECTION_COLUMNS = [
  "id",
  "budget_id",
  "title",
  "subtitle",
  "order_index",
  "qty",
  "section_price",
  "cover_image_url",
  "tags",
  "included_bullets",
  "excluded_bullets",
  "notes",
  "is_optional",
  "addendum_action",
] as const;

export const PUBLIC_SECTION_SELECT = PUBLIC_SECTION_COLUMNS.join(", ");

export const PUBLIC_ITEM_COLUMNS = [
  "id",
  "section_id",
  "title",
  "description",
  "order_index",
  "qty",
  "unit",
  "coverage_type",
  "included_rooms",
  "excluded_rooms",
  // Pricing fields are needed for accurate total/subtotal calculation
  // even though individual item prices are not displayed to the client.
  "internal_unit_price",
  "internal_total",
  "bdi_percentage",
  "addendum_action",
] as const;

export const PUBLIC_ITEM_SELECT = PUBLIC_ITEM_COLUMNS.join(", ");

export const PUBLIC_ITEM_IMAGE_COLUMNS = [
  "id",
  "item_id",
  "url",
  "is_primary",
] as const;

export const PUBLIC_ITEM_IMAGE_SELECT = PUBLIC_ITEM_IMAGE_COLUMNS.join(", ");

export const PUBLIC_ADJUSTMENT_COLUMNS = [
  "id",
  "budget_id",
  "label",
  "amount",
  "sign",
] as const;

export const PUBLIC_ADJUSTMENT_SELECT = PUBLIC_ADJUSTMENT_COLUMNS.join(", ");

export const PUBLIC_ROOM_COLUMNS = [
  "id",
  "budget_id",
  "name",
  "polygon",
  "order_index",
] as const;

export const PUBLIC_ROOM_SELECT = PUBLIC_ROOM_COLUMNS.join(", ");
