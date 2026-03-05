// Demo budget data extracted from the Adriano Lelis spreadsheet
// Images from Unsplash (free, high-quality reference photos)

const img = (id: string, w = 400, h = 300) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

// Section cover images (16:9 aspect)
const covers = {
  projetos: img('1503387762-592deb58ef4e', 800, 450),      // Blueprints/plans
  civis: img('1504307651254-35680f356dfd', 800, 450),       // Construction/renovation
  revestimentos: img('1615529328331-f8917597711f', 800, 450), // Wood flooring
  pinturas: img('1562259949-e8e7689e7828', 800, 450),       // Painting walls
  instalacoes: img('1558618666-fcd25c85f1d7', 800, 450),    // Tools/installation
  luminarias: img('1524484485831-a92ffc0de03f', 800, 450),  // Modern lighting
  vidros: img('1552321554-5fefe8c9ef14', 800, 450),         // Mirror/glass bathroom
  limpeza: img('1581578731548-c64695cc6952', 800, 450),     // Clean room
  marcenaria: img('1556909114-f6e7ad7d3136', 800, 450),     // Custom cabinetry
  mobiliario: img('1555041469-a586c61ea9bc', 800, 450),     // Modern furniture
  eletro: img('1556909172-54557c7e4fb7', 800, 450),         // Kitchen appliances
  banheiro: img('1552321554-5fefe8c9ef14', 800, 450),       // Bathroom accessories
  diversos: img('1558618666-fcd25c85f1d7', 800, 450),       // Misc accessories
  cortinas: img('1513694203232-719a280e022f', 800, 450),     // Curtains/drapes
};

// Item thumbnail helper
const thumb = (id: string) => [{ url: img(id, 200, 200), is_primary: true }];

export const demoBudget = {
  id: 'demo',
  project_name: 'Reforma Completa — Adriano Lelis',
  client_name: 'Adriano Lelis',
  unit: 'Apartamento Compacto',
  date: '2026-02-21',
  validity_days: 30,
  status: 'published',
  public_id: 'demo',
  show_item_qty: true,
  show_item_prices: false,
  show_progress_bars: true,
  generated_at: '2026-02-21T00:00:00Z',
  disclaimer: 'Os valores apresentados são válidos pelo prazo indicado. Alterações de escopo podem impactar o orçamento final. Orçamento Bwild nº 000470 — Revisão 1.',
  notes: null,
  floor_plan_url: '/images/planta-baixa-adriano.jpeg',
  sections: [
    {
      id: 's1',
      title: 'Projetos e Documentações',
      subtitle: 'Planejamento completo: arquitetura, engenharia, gestão e documentação',
      order_index: 0,
      qty: null,
      section_price: 12100,
      cover_image_url: covers.projetos,
      tags: ['projeto', 'gestão'],
      included_bullets: [
        'Projeto Arquitetônico completo',
        'Engenharia e Gestão de obra',
        'Impostos e taxas legais',
        'Fretes e Logística de materiais',
      ],
      excluded_bullets: [
        'Projeto estrutural (se necessário)',
        'Licenças municipais extras',
      ],
      notes: 'O projeto contempla toda a gestão e acompanhamento da obra.',
      items: [
        { id: 'i1-1', title: 'Projeto Arquitetônico', description: 'Layout completo, detalhamento técnico e especificação de materiais', qty: 1, unit: 'VB', images: thumb('1503387762-592deb58ef4e') },
        { id: 'i1-2', title: 'Engenharia e Gestão', description: 'Acompanhamento de obra, cronograma e controle de qualidade', qty: 1, unit: 'VB', images: thumb('1504307651254-35680f356dfd') },
        { id: 'i1-3', title: 'Impostos', description: 'Tributos e encargos legais da reforma', qty: 1, unit: 'VB', images: [] },
        { id: 'i1-4', title: 'Fretes e Logística', description: 'Transporte de materiais e equipamentos ao canteiro', qty: 1, unit: 'VB', images: thumb('1566576912321-d58ddd7a6088') },
      ],
    },
    {
      id: 's2',
      title: 'Serviços Civis e Revestimentos',
      subtitle: 'Demolições, pisos, revestimentos e adequação elétrica',
      order_index: 1,
      qty: null,
      section_price: 7571.56,
      cover_image_url: covers.civis,
      tags: ['obra civil', 'revestimento', 'elétrica'],
      included_bullets: [
        'Demolições (recorte pedra, remoção porta varanda, bancadas, piso)',
        'Nivelamento e instalação de piso vinílico (24 m²)',
        'Revestimento backsplash da cozinha',
        'Rodapé de poliestireno (15,8 m)',
        'Proteção de piso durante a obra',
        'Adequação elétrica — 8 pontos',
        'Infraestrutura frigorífera para ar-condicionado',
      ],
      excluded_bullets: [
        'Material elétrico de alta complexidade',
        'Instalação de ar-condicionado (ver seção Eletrodomésticos)',
      ],
      notes: null,
      items: [
        { id: 'i2-1', title: 'Recorte da Pedra para Cooktop', description: 'Recorte preciso na bancada para encaixe do cooktop', qty: 1, unit: 'VB', images: thumb('1556909114-f6e7ad7d3136'), floor_zone: 'cozinha' },
        { id: 'i2-2', title: 'Remoção de Porta da Varanda', description: 'Remoção completa para integração de ambientes', qty: 1, unit: 'VB', images: thumb('1558618666-fcd25c85f1d7'), floor_zone: 'sala' },
        { id: 'i2-3', title: 'Remoção de Bancadas', description: 'Retirada das bancadas existentes para novas instalações', qty: 1, unit: 'VB', images: thumb('1552321554-5fefe8c9ef14'), floor_zone: 'banheiro' },
        { id: 'i2-4', title: 'Remoção de Piso Existente', description: 'Demolição do piso antigo em toda a área', qty: 1, unit: 'VB', images: thumb('1504307651254-35680f356dfd') },
        { id: 'i2-5', title: 'Nivelamento de Piso (Vinílico)', description: 'Preparação e nivelamento do contrapiso', qty: 24, unit: 'm²', images: thumb('1615529328331-f8917597711f') },
        { id: 'i2-6', title: 'Nivelamento para Integração', description: 'Nivelamento na área de integração sala/varanda', qty: 2, unit: 'm³', images: [], floor_zone: 'sala' },
        { id: 'i2-7', title: 'Instalação de Piso Vinílico', description: 'Piso vinílico cola sobre contrapiso nivelado', qty: 24, unit: 'm²', images: thumb('1615529328331-f8917597711f') },
        { id: 'i2-8', title: 'Revestimento Backsplash', description: 'Aplicação do revestimento na parede da cozinha', qty: 1, unit: 'VB', images: thumb('1600585152220-90363fe7e115'), floor_zone: 'cozinha' },
        { id: 'i2-9', title: 'Rodapé Poliestireno', description: 'Instalação de rodapé em todos os ambientes', qty: 15.8, unit: 'm', images: [] },
        { id: 'i2-10', title: 'Proteção de Piso', description: 'Materiais para proteção durante execução da obra', qty: 24, unit: 'm²', images: [] },
        { id: 'i2-11', title: 'Adequação Elétrica', description: 'Adaptação ou criação de 8 pontos elétricos', qty: 8, unit: 'UN', images: thumb('1621905252507-b35492cc74b4') },
        { id: 'i2-12', title: 'Infra Frigorífera', description: 'Infraestrutura para instalação do ar-condicionado (1 a 10 m)', qty: 1, unit: 'UN', images: [], floor_zone: 'quarto' },
      ],
    },
    {
      id: 's3',
      title: 'Revestimentos e Vinílicos',
      subtitle: 'Materiais de acabamento: piso vinílico, porcelanato e rodapé',
      order_index: 2,
      qty: null,
      section_price: 2636,
      cover_image_url: covers.revestimentos,
      tags: ['material', 'revestimento'],
      included_bullets: [
        'Piso Vinílico Cola Vita Vernazza — Biancogres (25 m²)',
        'Revestimento Metro White Eliane 10x20cm (1 m²)',
        'Rodapé Santa Luzia branco 3cm (25 m)',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i3-1', title: 'Piso Vinílico Cola Vita Vernazza', description: 'Madeira Marrom — Biancogres, acabamento premium', qty: 25, unit: 'm²', images: thumb('1615529328331-f8917597711f') },
        { id: 'i3-2', title: 'Revestimento Metro White Eliane', description: 'Porcelanato brilhante borda arredondada 10x20cm', qty: 1, unit: 'm²', images: thumb('1600585152220-90363fe7e115'), floor_zone: 'cozinha' },
        { id: 'i3-3', title: 'Rodapé Santa Luzia Branco 3cm', description: 'Rodapé de poliestireno em cor branca', qty: 25, unit: 'm', images: [] },
      ],
    },
    {
      id: 's4',
      title: 'Pinturas',
      subtitle: 'Pintura completa de paredes e teto em todos os ambientes',
      order_index: 3,
      qty: null,
      section_price: 4594.90,
      cover_image_url: covers.pinturas,
      tags: ['pintura', 'acabamento'],
      included_bullets: [
        'Pintura de paredes (67,3 m²) — materiais e mão de obra',
        'Pintura de teto (45 m²) — materiais e mão de obra',
      ],
      excluded_bullets: [
        'Textura especial ou efeitos decorativos',
      ],
      notes: null,
      items: [
        { id: 'i4-1', title: 'Pintura de Paredes', description: 'Fornecimento de materiais e mão de obra completa', qty: 67.3, unit: 'm²', images: thumb('1562259949-e8e7689e7828') },
        { id: 'i4-2', title: 'Pintura de Teto', description: 'Fornecimento de materiais e mão de obra completa', qty: 45, unit: 'm²', images: thumb('1589939705384-5185137a7f0f') },
      ],
    },
    {
      id: 's5',
      title: 'Instalações Gerais',
      subtitle: 'Instalação de luminárias, fechadura eletrônica e metais',
      order_index: 4,
      qty: null,
      section_price: 1296,
      cover_image_url: covers.instalacoes,
      tags: ['instalação'],
      included_bullets: [
        'Instalação de 6 luminárias',
        'Instalação de fechadura eletrônica',
        'Instalação de metais sanitários',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i5-1', title: 'Instalação de Luminárias', description: 'Instalação de 6 pontos de iluminação', qty: 6, unit: 'UN', images: thumb('1524484485831-a92ffc0de03f') },
        { id: 'i5-2', title: 'Instalação de Fechadura Eletrônica', description: 'Instalação na porta de entrada', qty: 1, unit: 'UN', images: thumb('1558002038-1055907df827'), floor_zone: 'sala' },
        { id: 'i5-3', title: 'Instalação de Metais', description: 'Metais sanitários no banheiro e cozinha', qty: 1, unit: 'UN', images: thumb('1552321554-5fefe8c9ef14'), floor_zone: 'banheiro' },
      ],
    },
    {
      id: 's6',
      title: 'Luminárias',
      subtitle: 'Spots, trilhos eletrificados e plafon para iluminação moderna',
      order_index: 5,
      qty: null,
      section_price: 1007.10,
      cover_image_url: covers.luminarias,
      tags: ['iluminação', 'material'],
      included_bullets: [
        'Spots de embutir PAR20 branco (2 un)',
        'Kit trilho eletrificado 1m + 4 spots 10W luz quente (3 un)',
        'Painel plafon quadrado 40x40cm 40W 3000K (1 un)',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i6-1', title: 'Spot de Embutir PAR20', description: 'Cor branco, com lâmpada inclusa', qty: 2, unit: 'UN', images: thumb('1507003211169-0a1dd7228f2d') },
        { id: 'i6-2', title: 'Kit Trilho Eletrificado', description: 'Branco, 1m + 4 spots 10W, luz quente', qty: 3, unit: 'UN', images: thumb('1524484485831-a92ffc0de03f') },
        { id: 'i6-3', title: 'Painel Plafon de Sobrepor', description: 'Branco, quadrado 40x40cm, 40W 3000K', qty: 1, unit: 'UN', images: thumb('1565814636199-ae8133055c1c') },
      ],
    },
    {
      id: 's7',
      title: 'Vidros e Espelhos',
      subtitle: 'Espelho decorativo e box de vidro para banheiro',
      order_index: 6,
      qty: null,
      section_price: 1777.14,
      cover_image_url: covers.vidros,
      tags: ['vidro', 'banheiro'],
      included_bullets: [
        'Espelho oval com moldura dourada 50×150cm',
        'Box de vidro incolor com alumínio branco de correr 110×190cm',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i7-1', title: 'Espelho Oval com Moldura Dourada', description: 'Dimensões 50×150cm, acabamento premium', qty: 1, unit: 'UN', images: thumb('1618220179428-22790b461013'), floor_zone: 'banheiro' },
        { id: 'i7-2', title: 'Box de Vidro Incolor', description: 'Com alumínio branco, porta de correr 110×190cm', qty: 1, unit: 'UN', images: thumb('1552321554-5fefe8c9ef14'), floor_zone: 'banheiro' },
      ],
    },
    {
      id: 's8',
      title: 'Limpeza',
      subtitle: 'Limpeza fina final pós-obra',
      order_index: 7,
      qty: null,
      section_price: 450,
      cover_image_url: covers.limpeza,
      tags: ['limpeza'],
      included_bullets: [
        'Limpeza fina completa de todos os ambientes',
      ],
      excluded_bullets: [
        'Limpeza de fachada ou áreas comuns',
      ],
      notes: null,
      items: [
        { id: 'i8-1', title: 'Limpeza Fina Final', description: 'Limpeza completa pós-obra em todos os ambientes', qty: 1, unit: 'VB', images: thumb('1581578731548-c64695cc6952') },
      ],
    },
    {
      id: 's9',
      title: 'Marcenaria',
      subtitle: 'Móveis planejados sob medida para cozinha, quarto, home office e banheiro',
      order_index: 8,
      qty: null,
      section_price: 20723,
      cover_image_url: covers.marcenaria,
      tags: ['marcenaria', 'mobiliário', 'bancada'],
      included_bullets: [
        'Armário aéreo + gabinete de cozinha (220×60×45 + 140×80×50 cm)',
        'Guarda-roupa de correr (140×60cm, h=260cm)',
        'Bancada + prateleira home office (130×60 + 130×40 cm)',
        'Gabinete de banheiro (70×50cm)',
        'Vassoureiro/gavetão de cozinha (180×15×55cm)',
        'Bancadas de granito (branco Siena ou preto São Gabriel) com cubas e torneiras',
      ],
      excluded_bullets: [
        'Puxadores especiais (inclui modelo padrão)',
        'Granitos especiais ou importados',
      ],
      notes: 'Toda a marcenaria é sob medida, produzida em MDF com acabamento de alta resistência.',
      items: [
        { id: 'i9-1', title: 'Armário Aéreo + Gabinete Cozinha', description: 'Aéreo 220×60×45cm + gabinete 140×80×50cm', qty: 1, unit: 'UN', images: thumb('1556909114-f6e7ad7d3136'), floor_zone: 'cozinha' },
        { id: 'i9-2', title: 'Guarda-roupa de Correr', description: 'Dimensões 140×60cm, altura 260cm', qty: 1, unit: 'UN', images: thumb('1558997519-83ea9252edf8'), floor_zone: 'quarto' },
        { id: 'i9-3', title: 'Bancada Home Office', description: 'Bancada + prateleira 130×60cm e 130×40cm', qty: 1, unit: 'UN', images: thumb('1593062096033-9a26b09da705'), floor_zone: 'sala' },
        { id: 'i9-4', title: 'Gabinete de Banheiro', description: 'Dimensões 70×50cm, com cuba embutida', qty: 1, unit: 'UN', images: thumb('1552321554-5fefe8c9ef14'), floor_zone: 'banheiro' },
        { id: 'i9-5', title: 'Vassoureiro / Gavetão Cozinha', description: 'Dimensões 180×15×55cm', qty: 1, unit: 'UN', images: thumb('1556909114-f6e7ad7d3136'), floor_zone: 'cozinha' },
        { id: 'i9-6', title: 'Bancadas de Granito + Cubas + Torneiras', description: 'Branco Siena ou Preto São Gabriel, cozinha e banheiro', qty: 1, unit: 'UN', images: thumb('1600585152220-90363fe7e115'), floor_zone: 'cozinha' },
      ],
    },
    {
      id: 's10',
      title: 'Mobiliário',
      subtitle: 'Móveis soltos: cama, sofá, cadeiras e mesa',
      order_index: 9,
      qty: null,
      section_price: 5602,
      cover_image_url: covers.mobiliario,
      tags: ['mobiliário'],
      included_bullets: [
        'Conjunto box + colchão casal Revitale Hotel II (molas tripower)',
        'Mesas laterais brancas (2 un)',
        'Cadeiras Eiffel Wood cinza (2 un)',
        'Sofá-cama casal inteiro espuma',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i10-1', title: 'Conj. Box + Colchão Casal', description: 'Revitale Hotel II, molas tripower, sem pillow top', qty: 1, unit: 'UN', images: thumb('1505693416388-ac5ce068fe85'), floor_zone: 'quarto' },
        { id: 'i10-2', title: 'Mesa Lateral Branca', description: 'Cor branco, design moderno', qty: 2, unit: 'UN', images: thumb('1555041469-a586c61ea9bc'), floor_zone: 'quarto' },
        { id: 'i10-3', title: 'Cadeira Eiffel Wood', description: 'Solo Design, cor cinza', qty: 2, unit: 'UN', images: thumb('1503602642458-232111445657'), floor_zone: 'sala' },
        { id: 'i10-4', title: 'Sofá-Cama Casal', description: 'Vira cama casal inteiro, espuma de alta densidade', qty: 1, unit: 'UN', images: thumb('1555041469-a586c61ea9bc'), floor_zone: 'sala' },
      ],
    },
    {
      id: 's11',
      title: 'Eletroeletrônicos e Eletrodomésticos',
      subtitle: 'Equipamentos completos para o dia a dia do apartamento',
      order_index: 10,
      qty: null,
      section_price: 7904,
      cover_image_url: covers.eletro,
      tags: ['eletrodoméstico', 'eletrônico'],
      included_bullets: [
        'Micro-ondas Consul 20L espelhado',
        'Geladeira Frost Free duplex Consul',
        'Cooktop indução 2 bocas 3500W',
        'Fechadura digital Intelbras FR101',
        'Smart TV Samsung 32" HD',
        'Ar-condicionado Split 9000 BTU/h',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i11-1', title: 'Micro-ondas Consul 20L', description: 'Espelhado, função descongelar, cinza/inox', qty: 1, unit: 'UN', images: thumb('1574269909862-7e1d70bb8078'), floor_zone: 'cozinha' },
        { id: 'i11-2', title: 'Geladeira Frost Free Duplex', description: 'Consul CRM44MK inox', qty: 1, unit: 'UN', images: thumb('1571175443880-49e1d25b2bc5'), floor_zone: 'cozinha' },
        { id: 'i11-3', title: 'Cooktop Indução 2 Bocas', description: 'Panda Plus 3500W, vitrocerâmico touch 220V', qty: 1, unit: 'UN', images: thumb('1556909172-54557c7e4fb7'), floor_zone: 'cozinha' },
        { id: 'i11-4', title: 'Fechadura Digital Intelbras', description: 'Sobrepor, touch screen FR101, preta', qty: 1, unit: 'UN', images: thumb('1558002038-1055907df827'), floor_zone: 'sala' },
        { id: 'i11-5', title: 'Smart TV Samsung 32"', description: 'H5000F HD 2025, bivolt', qty: 1, unit: 'UN', images: thumb('1593359677879-a4bb92f829d1'), floor_zone: 'sala' },
        { id: 'i11-6', title: 'Ar-condicionado Split 9000 BTU/h', description: 'Prime Air 9FC, frio, branco', qty: 1, unit: 'UN', images: thumb('1631545806609-05d3aaf1a59d'), floor_zone: 'quarto' },
      ],
    },
    {
      id: 's12',
      title: 'Acessórios de Banheiro',
      subtitle: 'Assento, kit de acessórios cromados e chuveiro',
      order_index: 11,
      qty: null,
      section_price: 798.99,
      cover_image_url: covers.banheiro,
      tags: ['banheiro', 'acessório'],
      included_bullets: [
        'Assento sanitário slow close',
        'Kit de acessórios cromados Master (4 peças)',
        'Chuveiro/ducha Docol Eden cromado',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i12-1', title: 'Assento Sanitário Slow Close', description: 'Fechamento suave, acabamento premium', qty: 1, unit: 'UN', images: thumb('1552321554-5fefe8c9ef14'), floor_zone: 'banheiro' },
        { id: 'i12-2', title: 'Kit Acessórios Cromado Master', description: '4 peças: porta-toalha, saboneteira, cabide e papeleira', qty: 1, unit: 'UN', images: thumb('1620626011761-996317b8d101'), floor_zone: 'banheiro' },
        { id: 'i12-3', title: 'Chuveiro Docol Eden Cromado', description: 'Ducha com acabamento cromado premium', qty: 1, unit: 'UN', images: thumb('1584622650111-993a426fbf0a'), floor_zone: 'banheiro' },
      ],
    },
    {
      id: 's13',
      title: 'Acessórios Diversos',
      subtitle: 'Suporte de TV e complementos',
      order_index: 12,
      qty: null,
      section_price: 182,
      cover_image_url: covers.diversos,
      tags: ['acessório'],
      included_bullets: ['Suporte articulado de TV'],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i13-1', title: 'Suporte de TV', description: 'Suporte articulado para fixação na parede', qty: 1, unit: 'UN', images: thumb('1593359677879-a4bb92f829d1'), floor_zone: 'sala' },
      ],
    },
    {
      id: 's14',
      title: 'Cortinas',
      subtitle: 'Cortina blackout dublada com voil para o dormitório',
      order_index: 13,
      qty: null,
      section_price: 1771,
      cover_image_url: covers.cortinas,
      tags: ['cortina', 'decoração'],
      included_bullets: [
        'Cortina blackout dublado liso com voil flame (350×250cm)',
        'Fornecimento e instalação inclusos',
      ],
      excluded_bullets: [],
      notes: null,
      items: [
        { id: 'i14-1', title: 'Cortina Blackout Dublada com Voil', description: 'Dimensões 350×250cm, fornecimento e instalação', qty: 1, unit: 'UN', images: thumb('1513694203232-719a280e022f'), floor_zone: 'quarto' },
      ],
    },
  ],
  adjustments: [],
  rooms: [
    { id: 'cozinha', name: 'Cozinha', polygon: [[0.10, 0.07], [0.42, 0.07], [0.42, 0.47], [0.10, 0.47]] },
    { id: 'banheiro', name: 'Banheiro', polygon: [[0.53, 0.07], [0.87, 0.07], [0.87, 0.37], [0.53, 0.37]] },
    { id: 'sala', name: 'Sala / Living', polygon: [[0.07, 0.50], [0.50, 0.50], [0.50, 0.93], [0.07, 0.93]] },
    { id: 'quarto', name: 'Dormitório', polygon: [[0.53, 0.42], [0.92, 0.42], [0.92, 0.93], [0.53, 0.93]] },
  ],
};

// Map floor_zone to coverage_type + included_rooms for demo items
demoBudget.sections.forEach((section: any) => {
  (section.items || []).forEach((item: any) => {
    if (item.floor_zone) {
      item.coverage_type = 'local';
      item.included_rooms = [item.floor_zone];
    } else {
      item.coverage_type = 'geral';
      item.included_rooms = [];
    }
  });
});

// Floor plan zone coordinates (approximate % positions on the floor plan image)
// Based on the actual Adriano Lelis floor plan layout
export const floorPlanZones: Record<string, { label: string; x: number; y: number; w: number; h: number }> = {
  cozinha: { label: 'Cozinha', x: 4, y: 18, w: 26, h: 25 },
  banheiro: { label: 'Banheiro', x: 52, y: 18, w: 30, h: 22 },
  sala: { label: 'Sala / Living', x: 4, y: 55, w: 45, h: 35 },
  quarto: { label: 'Dormitório', x: 52, y: 48, w: 38, h: 38 },
};
