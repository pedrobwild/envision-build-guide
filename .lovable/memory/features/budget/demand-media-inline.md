---
name: Demand media inline
description: Módulo "Mídias & Anexos" no painel da demanda (BudgetInternalDetail) abre MediaUploadSection inline para anexar fotos da planta, estado do imóvel, renders 3D, vídeos e Tour 3D sem navegar para o editor
type: feature
---
- Sidebar do `/admin/demanda/:budgetId` tem item "Mídias & Anexos" que ativa `activeModule="media"` (antes navegava para o editor).
- O painel renderiza `<MediaUploadSection publicId={budget.public_id || budget.id} budgetId={budget.id} />` no Sheet de detalhes.
- Suporta upload em lote, drag-to-reorder, marcação de capa, remoção em massa e Tour 3D (Enscape).
- Resolve a dor do comercial de não ter onde anexar fotos da planta/estado do apto/referências do cliente direto no pipeline — agora não precisa abrir o editor de orçamento para subir mídia.
