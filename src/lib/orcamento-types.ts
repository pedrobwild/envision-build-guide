export interface BudgetMeta {
  projectId: string;
  clientName: string;
  projectName: string;
  area: string;
  version: string;
  validUntil: string;
  architect: string;
  engineer: string;
}

export interface ServiceCard {
  id: string;
  title: string;
  valueProp: string;
  includes: string[];
  result: string;
}

export interface JourneyStep {
  id: number;
  title: string;
  whatHappens: string[];
  result: string;
  proof?: string;
}

export interface ScopeItem {
  title: string;
  summary: string;
  bullets: string[];
}

export interface ScopeCategory {
  id: string;
  title: string;
  items: ScopeItem[];
}

export interface PortalTab {
  id: string;
  label: string;
  screenshot?: string;
  bullets: string[];
}

export interface BudgetSummary {
  meta: BudgetMeta;
  included: string[];
  services: ServiceCard[];
  journey: JourneyStep[];
  scope: ScopeCategory[];
  portalTabs: PortalTab[];
}
