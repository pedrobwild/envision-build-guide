/**
 * Garante que o indicador do link público distingue os 3 estados visuais:
 * publicado (verde), rascunho (âmbar) e ausente (oculto por padrão).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PublicLinkStatusBadge,
  derivePublicLinkStatus,
} from "../PublicLinkStatusBadge";

describe("derivePublicLinkStatus", () => {
  it("retorna 'missing' quando não há public_id", () => {
    expect(derivePublicLinkStatus(null, "published")).toBe("missing");
    expect(derivePublicLinkStatus("", "published")).toBe("missing");
  });
  it("retorna 'published' para published e minuta_solicitada", () => {
    expect(derivePublicLinkStatus("abc", "published")).toBe("published");
    expect(derivePublicLinkStatus("abc", "minuta_solicitada")).toBe("published");
  });
  it("retorna 'draft' quando há public_id mas status não está publicado", () => {
    expect(derivePublicLinkStatus("abc", "draft")).toBe("draft");
    expect(derivePublicLinkStatus("abc", null)).toBe("draft");
    expect(derivePublicLinkStatus("abc", "in_progress")).toBe("draft");
  });
});

describe("<PublicLinkStatusBadge />", () => {
  it("mostra 'Público' em verde quando publicado", () => {
    render(<PublicLinkStatusBadge publicId="abc" status="published" />);
    expect(screen.getByText("Público")).toBeInTheDocument();
    expect(screen.getByLabelText(/Status do link público: Público/i)).toBeInTheDocument();
  });

  it("mostra 'Rascunho' em âmbar quando há link mas não publicado", () => {
    render(<PublicLinkStatusBadge publicId="abc" status="in_progress" />);
    const el = screen.getByText("Rascunho");
    expect(el).toBeInTheDocument();
    // Tooltip deixa explícito o que vai acontecer no clique
    expect(screen.getByLabelText(/Rascunho/i).getAttribute("title")).toMatch(
      /última publicada|publicada do grupo/i,
    );
  });

  it("não renderiza nada quando não há public_id (default)", () => {
    const { container } = render(<PublicLinkStatusBadge publicId={null} status="draft" />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza 'Sem link' quando showMissing=true", () => {
    render(<PublicLinkStatusBadge publicId={null} status="draft" showMissing />);
    expect(screen.getByText("Sem link")).toBeInTheDocument();
  });
});
