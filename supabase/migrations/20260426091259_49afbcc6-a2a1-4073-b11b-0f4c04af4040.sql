-- Bulk operations executed via the AI assistant (admin-only)
CREATE TABLE public.ai_bulk_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  command TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('financial_adjustment', 'status_change', 'assign_owner')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot JSONB,
  affected_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'reverted', 'failed')),
  error_message TEXT,
  applied_at TIMESTAMP WITH TIME ZONE,
  reverted_at TIMESTAMP WITH TIME ZONE,
  reverted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_bulk_ops_admin ON public.ai_bulk_operations(admin_id, created_at DESC);
CREATE INDEX idx_ai_bulk_ops_status ON public.ai_bulk_operations(status, created_at DESC);

ALTER TABLE public.ai_bulk_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all bulk operations"
  ON public.ai_bulk_operations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert bulk operations"
  ON public.ai_bulk_operations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

CREATE POLICY "Admins can update bulk operations"
  ON public.ai_bulk_operations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bulk operations"
  ON public.ai_bulk_operations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_bulk_ops_updated_at
  BEFORE UPDATE ON public.ai_bulk_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();