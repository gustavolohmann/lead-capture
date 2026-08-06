import { createKnex } from './db.js';

/**
 * Lead falso de cotação de seguro (como veio da Meta Lead Ads).
 * Uso: node scripts/seed-insurance-lead.js
 *      node scripts/seed-insurance-lead.js --company-id 1
 */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[key] = value;
  }
  return args;
}

const QUESTION_LABELS = {
  full_name: 'Nome completo',
  email: 'Email',
  phone_number: 'Telefone',
  company_name: 'Empresa',
  job_title: 'Cargo',
  city: 'Cidade',
  state: 'Estado',
  post_code: 'CEP',
  whatsapp_number: 'WhatsApp',
  gender: 'Gênero',
  date_of_birth: 'Data de nascimento',
  custom_tipo_seguro: 'Qual tipo de seguro deseja?',
  custom_cobertura: 'Qual cobertura prefere?',
  custom_valor_bem: 'Valor aproximado do bem (R$)',
  custom_ja_cliente: 'Já é cliente de alguma seguradora?',
  custom_interesses: 'Quais coberturas extras interessam?',
  custom_observacoes: 'Observações / detalhes do risco',
  custom_melhor_horario: 'Melhor horário para contato',
};

function buildInsuranceLeadPayload({ pageId, formId, metaLeadId }) {
  const fieldData = [
    { name: 'full_name', values: ['Ana Beatriz Ferreira'] },
    { name: 'email', values: ['ana.ferreira@emailteste.com'] },
    { name: 'phone_number', values: ['+5511998877665'] },
    { name: 'company_name', values: ['Ferreira & Cia Ltda'] },
    { name: 'job_title', values: ['Sócia-administradora'] },
    { name: 'city', values: ['São Paulo'] },
    { name: 'state', values: ['SP'] },
    { name: 'post_code', values: ['01310-100'] },
    { name: 'whatsapp_number', values: ['+5511998877665'] },
    { name: 'gender', values: ['Feminino'] },
    { name: 'date_of_birth', values: ['1988-03-14'] },
    { name: 'custom_tipo_seguro', values: ['Seguro auto'] },
    { name: 'custom_cobertura', values: ['Compreensiva (completa)'] },
    { name: 'custom_valor_bem', values: ['85000'] },
    { name: 'custom_ja_cliente', values: ['Sim, outra seguradora'] },
    {
      name: 'custom_interesses',
      values: ['Assistência 24h', 'Carro reserva', 'Vidros'],
    },
    {
      name: 'custom_observacoes',
      values: [
        'Carro estaciona na rua. Preciso de cotação com franquia reduzida e cobertura para motorista adicional.',
      ],
    },
    { name: 'custom_melhor_horario', values: ['Tarde (14h–18h)'] },
  ];

  return {
    id: metaLeadId,
    created_time: new Date().toISOString(),
    campaign_id: 'SEED_CAMP_SEGURO_100',
    campaign_name: 'Campanha Cotação Seguro Auto 2026',
    adset_id: 'SEED_ADSET_SEGURO_200',
    adset_name: 'Público SP 25-55 Interesse Auto',
    ad_id: 'SEED_AD_SEGURO_300',
    ad_name: 'Anúncio Cotação Seguro — Criativo A',
    form_id: formId,
    is_organic: false,
    platform: 'fb',
    field_data: fieldData,
    question_labels: QUESTION_LABELS,
    _seed: true,
    _seed_note: 'Lead fictício de cotação de seguro para preview da UI',
  };
}

async function resolveCompany(db, args) {
  if (args['company-id']) {
    const company = await db('companies')
      .where({ id: Number(args['company-id']) })
      .first();
    if (!company) throw new Error(`Empresa ${args['company-id']} não encontrada`);
    return company;
  }

  const company = await db('companies').orderBy('id', 'asc').first();
  if (!company) throw new Error('Nenhuma empresa no banco. Crie uma conta antes.');
  return company;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = createKnex();

  try {
    const company = await resolveCompany(db, args);
    const page = await db('meta_pages')
      .where({ company_id: company.id })
      .orderBy('id', 'asc')
      .first();

    const pageId = page?.page_id || 'SEED_PAGE_SEGURO';
    const formId = 'SEED_FORM_SEGURO_001';
    const metaLeadId = `seed_seguro_${Date.now()}`;

    const rawData = buildInsuranceLeadPayload({ pageId, formId, metaLeadId });
    const origin = `Lead Ads · ${rawData.campaign_name}`;

    const [id] = await db('leads').insert({
      company_id: company.id,
      page_id: pageId,
      form_id: formId,
      form_name: 'Formulário Cotação Seguro Auto',
      meta_lead_id: metaLeadId,
      name: 'Ana Beatriz Ferreira',
      email: 'ana.ferreira@emailteste.com',
      phone: '+5511998877665',
      status: 'NEW',
      source: 'META_LEAD_ADS',
      origin,
      campaign_id: rawData.campaign_id,
      campaign_name: rawData.campaign_name,
      adset_id: rawData.adset_id,
      adset_name: rawData.adset_name,
      ad_id: rawData.ad_id,
      ad_name: rawData.ad_name,
      platform: rawData.platform,
      is_organic: 0,
      raw_data: JSON.stringify(rawData),
    });

    // Atualiza seed antigo sem origem (id 1 / meta_lead_id seed_seguro_*)
    await db('leads')
      .where({ company_id: company.id })
      .where('meta_lead_id', 'like', 'seed_seguro_%')
      .whereNull('origin')
      .update({
        origin,
        form_name: 'Formulário Cotação Seguro Auto',
        campaign_id: rawData.campaign_id,
        campaign_name: rawData.campaign_name,
        adset_id: rawData.adset_id,
        adset_name: rawData.adset_name,
        ad_id: rawData.ad_id,
        ad_name: rawData.ad_name,
        platform: rawData.platform,
        is_organic: 0,
        raw_data: JSON.stringify(rawData),
      });

    console.log('Lead de seguro criado:');
    console.log(`  id:         ${id}`);
    console.log(`  company:    ${company.id} (${company.name || '—'})`);
    console.log(`  origem:     ${origin}`);
    console.log(`  metaLeadId: ${metaLeadId}`);
    console.log(`  respostas:  ${rawData.field_data.length} campos`);
    console.log('Abra /leads no frontend para ver.');
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
