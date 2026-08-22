/**
 * Seed de leads diversificados para a tabela /leads.
 *
 * Uso:
 *   node scripts/seed-leads.js
 *   node scripts/seed-leads.js --email=dev@localhost.com
 *   node scripts/seed-leads.js --count=60 --replace
 *
 * --replace  remove leads anteriores com meta_lead_id seed_bulk_* desta empresa
 */
import { createKnex } from './db.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const [key, inline] = current.slice(2).split('=');
    const value =
      inline !== undefined
        ? inline
        : argv[i + 1] && !argv[i + 1].startsWith('--')
          ? argv[++i]
          : true;
    args[key] = value;
  }
  return args;
}

async function resolveCompanyId(db, email) {
  if (email) {
    const user = await db('users')
      .where({ email: String(email).toLowerCase() })
      .first();
    if (!user?.company_id) {
      throw new Error(`Usuário não encontrado ou sem company: ${email}`);
    }
    return Number(user.company_id);
  }

  const master = await db('users as u')
    .join('roles as r', 'r.id', 'u.role_id')
    .where('r.name', 'MASTER')
    .whereNotNull('u.company_id')
    .select('u.company_id')
    .first();

  if (master?.company_id) return Number(master.company_id);

  const any = await db('companies').orderBy('id', 'asc').first();
  if (!any) throw new Error('Nenhuma empresa no banco. Rode o seed MASTER antes.');
  return Number(any.id);
}

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olivia', 'Pedro',
  'Queila', 'Rafael', 'Sofia', 'Thiago', 'Ursula', 'Vitor', 'Wendy', 'Xavier',
  'Yasmin', 'Zeca', 'Beatriz', 'Caio', 'Daniela', 'Enzo', 'Fernanda', 'Gustavo',
  'Helena', 'Igor', 'Julia', 'Kevin', 'Larissa', 'Mateus', 'Natália', 'Otávio',
  'Patricia', 'Renato', 'Simone', 'Tales', 'Vanessa', 'Wagner', 'Aline', 'Breno',
  'Camila', 'Davi', 'Elisa', 'Fabio', 'Giovana', 'Hugo', 'Ingrid',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
  'Dias', 'Nunes', 'Moreira', 'Mendes', 'Cardoso', 'Teixeira', 'Correia',
  'Araujo', 'Cavalcanti', 'Monteiro', 'Moraes', 'Nascimento', 'Pinto',
];

const CITIES = [
  { city: 'São Paulo', state: 'SP', ddd: '11' },
  { city: 'Rio de Janeiro', state: 'RJ', ddd: '21' },
  { city: 'Belo Horizonte', state: 'MG', ddd: '31' },
  { city: 'Curitiba', state: 'PR', ddd: '41' },
  { city: 'Porto Alegre', state: 'RS', ddd: '51' },
  { city: 'Brasília', state: 'DF', ddd: '61' },
  { city: 'Salvador', state: 'BA', ddd: '71' },
  { city: 'Recife', state: 'PE', ddd: '81' },
  { city: 'Fortaleza', state: 'CE', ddd: '85' },
  { city: 'Manaus', state: 'AM', ddd: '92' },
  { city: 'Florianópolis', state: 'SC', ddd: '48' },
  { city: 'Campinas', state: 'SP', ddd: '19' },
  { city: 'Goiânia', state: 'GO', ddd: '62' },
  { city: 'Vitória', state: 'ES', ddd: '27' },
  { city: 'Belém', state: 'PA', ddd: '91' },
];

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

const CAMPAIGNS = [
  {
    id: 'SEED_CAMP_AUTO',
    name: 'Cotação Seguro Auto 2026',
    formId: 'SEED_FORM_AUTO',
    formName: 'Formulário Seguro Auto',
    adsets: [
      { id: 'SEED_ADSET_AUTO_SP', name: 'SP 25-55 Interesse Auto' },
      { id: 'SEED_ADSET_AUTO_RJ', name: 'RJ Lookalike Compradores' },
    ],
    ads: [
      { id: 'SEED_AD_AUTO_A', name: 'Criativo Cotação — Carro' },
      { id: 'SEED_AD_AUTO_B', name: 'Criativo Franquia Baixa' },
    ],
    answers: (p) => [
      ['custom_tipo_seguro', 'Tipo de seguro', 'Seguro auto'],
      ['custom_cobertura', 'Cobertura', pick(['Compreensiva', 'Terceiros', 'Roubo/Furto'], p.i)],
      ['custom_valor_bem', 'Valor do bem (R$)', String(40000 + (p.i % 20) * 5000)],
      ['custom_ja_cliente', 'Já é cliente?', pick(['Sim', 'Não', 'Outra seguradora'], p.i)],
      ['custom_melhor_horario', 'Melhor horário', pick(['Manhã', 'Tarde', 'Noite'], p.i)],
    ],
  },
  {
    id: 'SEED_CAMP_IMOVEL',
    name: 'Leads Imóveis Premium',
    formId: 'SEED_FORM_IMOVEL',
    formName: 'Interesse em Imóvel',
    adsets: [
      { id: 'SEED_ADSET_IMOVEL_ABC', name: 'ABC Paulista Investidores' },
      { id: 'SEED_ADSET_IMOVEL_ZONA', name: 'Zona Sul RJ' },
    ],
    ads: [
      { id: 'SEED_AD_IMOVEL_A', name: 'Apartamento 2 dorms' },
      { id: 'SEED_AD_IMOVEL_B', name: 'Lançamento com planta' },
    ],
    answers: (p) => [
      ['custom_tipo_imovel', 'Tipo de imóvel', pick(['Apartamento', 'Casa', 'Sala comercial'], p.i)],
      ['custom_faixa_preco', 'Faixa de preço', pick(['Até 400k', '400–800k', 'Acima de 800k'], p.i)],
      ['custom_finalidade', 'Finalidade', pick(['Moradia', 'Investimento'], p.i)],
      ['custom_quartos', 'Quartos', pick(['1', '2', '3+'], p.i)],
    ],
  },
  {
    id: 'SEED_CAMP_CURSO',
    name: 'Captação Curso Online',
    formId: 'SEED_FORM_CURSO',
    formName: 'Inscrição Curso',
    adsets: [
      { id: 'SEED_ADSET_CURSO_BR', name: 'Brasil Interesse Educação' },
    ],
    ads: [
      { id: 'SEED_AD_CURSO_A', name: 'Aula gratuita CTA' },
      { id: 'SEED_AD_CURSO_B', name: 'Depoimento aluno' },
    ],
    answers: (p) => [
      ['custom_curso', 'Curso de interesse', pick(['Marketing Digital', 'Excel Avançado', 'Inglês'], p.i)],
      ['custom_experiencia', 'Experiência', pick(['Iniciante', 'Intermediário', 'Avançado'], p.i)],
      ['custom_objetivo', 'Objetivo', pick(['Emprego', 'Empreender', 'Promoção'], p.i)],
    ],
  },
  {
    id: 'SEED_CAMP_SAAS',
    name: 'Demo SaaS B2B',
    formId: 'SEED_FORM_SAAS',
    formName: 'Agendar Demo',
    adsets: [
      { id: 'SEED_ADSET_SAAS_PME', name: 'PMEs LinkedIn-like' },
      { id: 'SEED_ADSET_SAAS_RET', name: 'Remarketing site' },
    ],
    ads: [
      { id: 'SEED_AD_SAAS_A', name: 'Demo 15 min' },
      { id: 'SEED_AD_SAAS_B', name: 'Case de sucesso' },
    ],
    answers: (p) => [
      ['company_name', 'Empresa', p.company],
      ['job_title', 'Cargo', pick(['CEO', 'Marketing', 'Vendas', 'Ops'], p.i)],
      ['custom_tamanho', 'Tamanho da empresa', pick(['1-10', '11-50', '51-200', '200+'], p.i)],
      ['custom_dor', 'Principal desafio', pick(['Leads', 'CRM', 'Automação', 'Relatórios'], p.i)],
    ],
  },
  {
    id: 'SEED_CAMP_CLINICA',
    name: 'Clínica Estética — Agendamentos',
    formId: 'SEED_FORM_CLINICA',
    formName: 'Agendar Avaliação',
    adsets: [
      { id: 'SEED_ADSET_CLINICA_MUL', name: 'Mulheres 28-45' },
    ],
    ads: [
      { id: 'SEED_AD_CLINICA_A', name: 'Antes e depois' },
      { id: 'SEED_AD_CLINICA_B', name: 'Promoção avaliação' },
    ],
    answers: (p) => [
      ['custom_procedimento', 'Procedimento', pick(['Botox', 'Preenchimento', 'Limpeza de pele', 'Laser'], p.i)],
      ['custom_quando', 'Quando pretende', pick(['Esta semana', 'Este mês', 'Só pesquisando'], p.i)],
    ],
  },
];

const FORM_ONLY = [
  {
    formName: 'Landing Black Friday',
    originPrefix: 'Formulário',
    answers: (p) => [
      ['custom_produto', 'Produto', pick(['Plano Pro', 'Plano Starter', 'Consultoria'], p.i)],
      ['custom_cupom', 'Cupom', pick(['BF10', 'BF20', 'SEM CUPOM'], p.i)],
    ],
  },
  {
    formName: 'Newsletter Site',
    originPrefix: 'Formulário',
    answers: (p) => [
      ['custom_interesse', 'Interesse', pick(['Novidades', 'Promoções', 'Conteúdo'], p.i)],
    ],
  },
  {
    formName: 'Contato Institucional',
    originPrefix: 'Formulário',
    answers: (p) => [
      ['custom_assunto', 'Assunto', pick(['Parceria', 'Suporte', 'Comercial'], p.i)],
      ['custom_mensagem', 'Mensagem', `Olá, gostaria de mais informações. Ref #${p.i + 1}.`],
    ],
  },
];

function pick(list, i) {
  return list[i % list.length];
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

function buildPhone(ddd, i) {
  const suffix = String(90000000 + (i * 137) % 9999999).padStart(8, '0');
  return `+55${ddd}9${suffix}`;
}

function daysAgo(n, hourOffset = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hourOffset % 24, (n * 7) % 60, (n * 3) % 60, 0);
  return d;
}

function buildLead(i, pageId) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
  const name = `${first} ${last}`;
  const loc = CITIES[i % CITIES.length];
  const status = STATUSES[i % STATUSES.length];
  const email = `${slugify(first)}.${slugify(last)}${i + 1}@emailteste.com`;
  const phone = buildPhone(loc.ddd, i);
  const company = `${last} ${pick(['Ltda', 'ME', 'Soluções', 'Group'], i)}`;

  // ~70% Meta Lead Ads, ~30% formulário próprio
  const isForm = i % 10 >= 7;
  const createdAt = daysAgo(i % 55, 8 + (i % 12));

  if (isForm) {
    const form = FORM_ONLY[i % FORM_ONLY.length];
    const extra = form.answers({ i, company });
    const fieldData = [
      { name: 'full_name', values: [name] },
      { name: 'email', values: [email] },
      { name: 'phone_number', values: [phone] },
      { name: 'city', values: [loc.city] },
      { name: 'state', values: [loc.state] },
      ...extra.map(([key, , value]) => ({
        name: key,
        values: Array.isArray(value) ? value : [value],
      })),
    ];
    const labels = Object.fromEntries([
      ['full_name', 'Nome completo'],
      ['email', 'Email'],
      ['phone_number', 'Telefone'],
      ['city', 'Cidade'],
      ['state', 'Estado'],
      ...extra.map(([key, label]) => [key, label]),
    ]);

    const rawData = {
      id: `seed_bulk_form_${i + 1}`,
      created_time: createdAt.toISOString(),
      is_organic: true,
      platform: null,
      field_data: fieldData,
      question_labels: labels,
      _seed: true,
    };

    return {
      page_id: null,
      form_id: `SEED_OWN_FORM_${form.formName.slice(0, 12).toUpperCase().replace(/\s+/g, '_')}`,
      form_name: form.formName,
      meta_lead_id: `seed_bulk_${String(i + 1).padStart(3, '0')}`,
      name,
      email,
      phone,
      status,
      source: 'FORM',
      origin: `Formulário · ${form.formName}`,
      campaign_id: null,
      campaign_name: null,
      adset_id: null,
      adset_name: null,
      ad_id: null,
      ad_name: null,
      platform: null,
      is_organic: 1,
      raw_data: JSON.stringify(rawData),
      created_at: createdAt,
      updated_at: createdAt,
    };
  }

  const campaign = CAMPAIGNS[i % CAMPAIGNS.length];
  const adset = campaign.adsets[i % campaign.adsets.length];
  const ad = campaign.ads[i % campaign.ads.length];
  const platform = pick(['fb', 'ig', 'fb', 'ig', 'an'], i);
  const isOrganic = i % 17 === 0 ? 1 : 0;
  const extra = campaign.answers({ i, company });

  const fieldData = [
    { name: 'full_name', values: [name] },
    { name: 'email', values: [email] },
    { name: 'phone_number', values: [phone] },
    { name: 'city', values: [loc.city] },
    { name: 'state', values: [loc.state] },
    { name: 'whatsapp_number', values: [phone] },
    ...extra.map(([key, , value]) => ({
      name: key,
      values: Array.isArray(value) ? value : [String(value)],
    })),
  ];

  const labels = Object.fromEntries([
    ['full_name', 'Nome completo'],
    ['email', 'Email'],
    ['phone_number', 'Telefone'],
    ['city', 'Cidade'],
    ['state', 'Estado'],
    ['whatsapp_number', 'WhatsApp'],
    ...extra.map(([key, label]) => [key, label]),
  ]);

  const originParts = ['Lead Ads'];
  if (isOrganic) originParts.push('Orgânico');
  originParts.push(campaign.name);

  const rawData = {
    id: `seed_bulk_meta_${i + 1}`,
    created_time: createdAt.toISOString(),
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    adset_id: adset.id,
    adset_name: adset.name,
    ad_id: ad.id,
    ad_name: ad.name,
    form_id: campaign.formId,
    is_organic: Boolean(isOrganic),
    platform,
    field_data: fieldData,
    question_labels: labels,
    _seed: true,
  };

  return {
    page_id: pageId,
    form_id: campaign.formId,
    form_name: campaign.formName,
    meta_lead_id: `seed_bulk_${String(i + 1).padStart(3, '0')}`,
    name,
    email,
    phone,
    status,
    source: 'META_LEAD_ADS',
    origin: originParts.join(' · '),
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    adset_id: adset.id,
    adset_name: adset.name,
    ad_id: ad.id,
    ad_name: ad.name,
    platform,
    is_organic: isOrganic,
    raw_data: JSON.stringify(rawData),
    created_at: createdAt,
    updated_at: createdAt,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const count = Math.max(1, Number(args.count) || 55);
  const replace = Boolean(args.replace);
  const db = createKnex();

  try {
    const companyId = await resolveCompanyId(db, args.email || null);
    const company = await db('companies').where({ id: companyId }).first();
    const page = await db('meta_pages')
      .where({ company_id: companyId })
      .orderBy('id', 'asc')
      .first();
    const pageId = page?.page_id || 'SEED_PAGE_BULK';

    if (replace) {
      const deleted = await db('leads')
        .where({ company_id: companyId })
        .where('meta_lead_id', 'like', 'seed_bulk_%')
        .del();
      console.log(`Removidos ${deleted} leads seed_bulk_* anteriores.`);
    }

    const rows = [];
    for (let i = 0; i < count; i += 1) {
      rows.push({
        company_id: companyId,
        ...buildLead(i, pageId),
      });
    }

    // Upsert por meta_lead_id único
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const existing = await db('leads')
        .where({ meta_lead_id: row.meta_lead_id })
        .first();
      if (existing) {
        const { meta_lead_id, created_at, ...rest } = row;
        await db('leads').where({ id: existing.id }).update({
          ...rest,
          updated_at: db.fn.now(),
        });
        updated += 1;
      } else {
        await db('leads').insert(row);
        inserted += 1;
      }
    }

    const byStatus = {};
    const bySource = {};
    const byOrigin = {};
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      bySource[row.source] = (bySource[row.source] || 0) + 1;
      byOrigin[row.origin] = (byOrigin[row.origin] || 0) + 1;
    }

    console.log('Seed de leads concluído:');
    console.log(`  company:  ${companyId} (${company?.name || '—'})`);
    console.log(`  total:    ${count} (inseridos ${inserted}, atualizados ${updated})`);
    console.log(`  status:   ${JSON.stringify(byStatus)}`);
    console.log(`  source:   ${JSON.stringify(bySource)}`);
    console.log(`  origens:  ${Object.keys(byOrigin).length} distintas`);
    console.log('Abra /leads no frontend para ver a tabela.');
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
