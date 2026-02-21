import { Link } from "react-router-dom";
import { ArrowRight, FileText, Eye, Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-charcoal-light to-charcoal" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-8">
            <span className="text-primary-foreground font-display font-bold text-3xl">B</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-cream mb-4 leading-tight">
            Orçamentos de reforma<br />
            <span className="text-primary">visuais e profissionais</span>
          </h1>
          <p className="text-cream/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10 font-body leading-relaxed">
            Crie orçamentos que impressionam seus clientes. Cards com imagens, layout premium e link compartilhável.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium font-body hover:bg-primary/90 transition-colors"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/o/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-cream/20 text-cream font-medium font-body hover:bg-cream/5 transition-colors"
            >
              <Eye className="h-4 w-4" /> Ver exemplo
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: FileText, title: "Visual, não planilha", desc: "Cards com imagens de capa, miniaturas de itens, e layout que seus clientes vão adorar." },
            { icon: Eye, title: "Link público", desc: "Publique e compartilhe via link. Seus clientes acessam de qualquer dispositivo." },
            { icon: Shield, title: "Preços protegidos", desc: "Cliente vê apenas o total por seção. Valores unitários ficam internos, sob seu controle." },
          ].map((feat, i) => (
            <div key={i} className="p-6 rounded-xl bg-card border border-border hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mb-4">
                <feat.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <h3 className="font-display font-bold text-foreground mb-2">{feat.title}</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground font-body">
          Bwild — Orçamento Visual de Reforma
        </p>
      </footer>
    </div>
  );
};

export default Index;
