export interface BudgetSection {
  id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  cover_image_url?: string | null;
  tags?: string[] | null;
  included_bullets?: string[] | null;
  excluded_bullets?: string[] | null;
  notes?: string | null;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  title: string;
  description?: string | null;
  reference_url?: string | null;
  qty?: number | null;
  unit?: string | null;
  coverage_type?: string;
  included_rooms?: string[];
  excluded_rooms?: string[];
  internal_total?: number | null;
  internal_unit_price?: number | null;
  bdi_percentage?: number | null;
  images?: BudgetItemImage[];
}

export interface BudgetItemImage {
  id?: string;
  url: string;
  is_primary?: boolean;
}

export interface BudgetAdjustment {
  id: string;
  label: string;
  amount: number;
  sign: number;
}

export interface BudgetRoom {
  id: string;
  name: string;
  polygon: number[][];
}

export interface BudgetData {
  id: string;
  project_name: string;
  client_name: string;
  condominio?: string | null;
  bairro?: string | null;
  metragem?: string | null;
  unit?: string | null;
  date?: string | null;
  validity_days?: number | null;
  prazo_dias_uteis?: number | null;
  estimated_weeks?: number | null;
  versao?: string | null;
  version_number?: number | null;
  parent_budget_id?: string | null;
  change_reason?: string | null;
  is_published_version?: boolean | null;
  consultora_comercial?: string | null;
  email_comercial?: string | null;
  status: string;
  public_id?: string | null;
  show_item_qty?: boolean | null;
  show_item_prices?: boolean | null;
  show_progress_bars?: boolean | null;
  generated_at?: string | null;
  disclaimer?: string | null;
  notes?: string | null;
  floor_plan_url?: string | null;
  view_count?: number;
  approved_at?: string | null;
  approved_by_name?: string | null;
  lead_email?: string | null;
  lead_name?: string | null;
  sections: BudgetSection[];
  adjustments: BudgetAdjustment[];
  rooms: BudgetRoom[];
}
