CREATE INDEX IF NOT EXISTS idx_sections_budget_id ON public.sections (budget_id);
CREATE INDEX IF NOT EXISTS idx_sections_budget_order ON public.sections (budget_id, order_index);
CREATE INDEX IF NOT EXISTS idx_items_section_id ON public.items (section_id);
CREATE INDEX IF NOT EXISTS idx_items_section_order ON public.items (section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON public.item_images (item_id);