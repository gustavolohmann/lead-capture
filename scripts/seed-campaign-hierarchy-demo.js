/**
 * Seed local da hierarquia Meta Ads 1:N.
 *
 * Uso:
 *   npm run seed:campaign-hierarchy-demo
 *   npm run seed:campaign-hierarchy-demo -- --email=dev@localhost.com
 *   npm run seed:campaign-hierarchy-demo -- --clean
 */
import { createKnex } from './db.js';

const DEMO_PREFIX = 'demo_1n';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const [key, inline] = current.slice(2).split('=');
    const value =
      inline !== undefined
        ? inline
        : argv[index + 1] && !argv[index + 1].startsWith('--')
          ? argv[++index]
          : true;
    args[key] = value;
  }
  return args;
}

function assertLocalEnvironment() {
  const databaseName = String(process.env.DATABASE_NAME || '');
  const nodeEnvironment = String(process.env.NODE_ENV || 'development');
  if (
    nodeEnvironment.toLowerCase() === 'production' ||
    /(^|[_-])(prod|production)([_-]|$)/i.test(databaseName)
  ) {
    throw new Error(
      `Seed de demonstração recusado em ambiente de produção (${databaseName}).`
    );
  }
}

async function resolveCompanyId(db, email) {
  if (email) {
    const user = await db('users')
      .where({ email: String(email).toLowerCase() })
      .first();
    if (!user?.company_id) {
      throw new Error(`Usuário não encontrado ou sem empresa: ${email}`);
    }
    return Number(user.company_id);
  }

  const candidates = await db('users as u')
    .whereNotNull('u.company_id')
    .select('u.email', 'u.company_id')
    .orderBy('u.id', 'asc');
  const companies = new Map();
  for (const candidate of candidates) {
    if (!companies.has(Number(candidate.company_id))) {
      companies.set(Number(candidate.company_id), candidate.email);
    }
  }

  if (companies.size === 1) return companies.keys().next().value;
  if (companies.size > 1) {
    const choices = [...companies.entries()]
      .map(([companyId, userEmail]) => `${userEmail} (empresa ${companyId})`)
      .join(', ');
    throw new Error(
      `Há várias empresas no banco. Informe --email. Opções: ${choices}`
    );
  }

  const company = await db('companies').orderBy('id', 'asc').first();
  if (!company) {
    throw new Error('Nenhuma empresa encontrada. Execute npm run seed primeiro.');
  }
  return Number(company.id);
}

function demoDefinitions(prefix) {
  return [
    {
      key: 'legacy',
      name: '[DEMO 1:N] Campanha antiga — 1 anúncio',
      objective: 'LEAD_GENERATION',
      status: 'ACTIVE',
      dailyBudget: 35,
      adSets: [
        {
          key: 'legacy_leads',
          name: 'Público legado — Brasil',
          channel: null,
          ads: [
            {
              key: 'legacy_single',
              name: 'Anúncio legado único',
              title: 'Solicite uma avaliação',
              body: 'Exemplo de campanha antiga preservada com um anúncio.',
              cta: 'GET_QUOTE',
              status: 'ACTIVE',
            },
          ],
        },
      ],
    },
    {
      key: 'leads',
      name: '[DEMO 1:N] Captação de leads — 3 anúncios',
      objective: 'LEAD_GENERATION',
      status: 'ACTIVE',
      dailyBudget: 90,
      adSets: [
        {
          key: 'leads_shared',
          name: 'Leads — Público principal',
          channel: null,
          ads: [
            {
              key: 'leads_benefit',
              name: 'Leads — Benefício principal',
              title: 'Receba uma proposta personalizada',
              body: 'Preencha o formulário e fale com nossa equipe.',
              cta: 'GET_QUOTE',
              status: 'ACTIVE',
            },
            {
              key: 'leads_urgency',
              name: 'Leads — Urgência',
              title: 'Condições especiais nesta semana',
              body: 'Solicite agora uma análise gratuita.',
              cta: 'SIGN_UP',
              status: 'ACTIVE',
            },
            {
              key: 'leads_social_proof',
              name: 'Leads — Prova social',
              title: 'Mais de 500 clientes atendidos',
              body: 'Descubra a solução ideal para você.',
              cta: 'LEARN_MORE',
              status: 'PAUSED',
            },
          ],
        },
      ],
    },
    {
      key: 'traffic',
      name: '[DEMO 1:N] Tráfego para o site — 2 anúncios',
      objective: 'TRAFFIC',
      status: 'PAUSED',
      dailyBudget: 60,
      adSets: [
        {
          key: 'traffic_shared',
          name: 'Tráfego — Visitantes qualificados',
          channel: null,
          ads: [
            {
              key: 'traffic_content',
              name: 'Tráfego — Conteúdo educativo',
              title: 'Veja o guia completo',
              body: 'Acesse o conteúdo e tire suas principais dúvidas.',
              cta: 'LEARN_MORE',
              status: 'PAUSED',
            },
            {
              key: 'traffic_offer',
              name: 'Tráfego — Oferta direta',
              title: 'Conheça nossos planos',
              body: 'Compare as opções disponíveis em poucos minutos.',
              cta: 'GET_OFFER',
              status: 'PAUSED',
            },
          ],
        },
      ],
    },
    {
      key: 'messages',
      name: '[DEMO 1:N] Mensagens — WhatsApp + Instagram',
      objective: 'MESSAGES',
      status: 'ACTIVE',
      dailyBudget: 75,
      adSets: [
        {
          key: 'messages_whatsapp',
          name: 'Mensagens — WhatsApp',
          channel: 'WHATSAPP',
          ads: [
            {
              key: 'wa_questions',
              name: 'WhatsApp — Tire suas dúvidas',
              title: 'Fale conosco no WhatsApp',
              body: 'Nossa equipe está pronta para ajudar.',
              cta: 'WHATSAPP_MESSAGE',
              status: 'ACTIVE',
            },
            {
              key: 'wa_quote',
              name: 'WhatsApp — Solicite orçamento',
              title: 'Peça seu orçamento por mensagem',
              body: 'Comece uma conversa e receba uma proposta.',
              cta: 'WHATSAPP_MESSAGE',
              status: 'PAUSED',
            },
          ],
        },
        {
          key: 'messages_instagram',
          name: 'Mensagens — Instagram Direct',
          channel: 'INSTAGRAM',
          ads: [
            {
              key: 'ig_direct',
              name: 'Instagram — Conversa no Direct',
              title: 'Chame nossa equipe no Direct',
              body: 'Envie sua mensagem e receba atendimento.',
              cta: 'INSTAGRAM_MESSAGE',
              status: 'ACTIVE',
            },
          ],
        },
      ],
    },
  ].map((campaign) => ({
    ...campaign,
    metaCampaignId: `${prefix}_campaign_${campaign.key}`,
  }));
}

async function removeExistingDemo(trx, companyId, prefix) {
  const campaigns = await trx('campaigns')
    .where({ company_id: companyId })
    .where('campaign_id', 'like', `${prefix}_campaign_%`)
    .select('id');
  const campaignIds = campaigns.map((row) => row.id);
  if (campaignIds.length === 0) return;

  const adSets = await trx('ad_sets')
    .where({ company_id: companyId })
    .whereIn('campaign_id', campaignIds)
    .select('id');
  const adSetIds = adSets.map((row) => row.id);

  let creativeIds = [];
  if (adSetIds.length > 0) {
    const ads = await trx('ads')
      .where({ company_id: companyId })
      .whereIn('ad_set_id', adSetIds)
      .select('creative_id');
    creativeIds = [...new Set(ads.map((row) => row.creative_id).filter(Boolean))];
    await trx('ads')
      .where({ company_id: companyId })
      .whereIn('ad_set_id', adSetIds)
      .del();
    await trx('ad_sets')
      .where({ company_id: companyId })
      .whereIn('id', adSetIds)
      .del();
  }

  await trx('campaigns')
    .where({ company_id: companyId })
    .whereIn('id', campaignIds)
    .del();

  if (creativeIds.length > 0) {
    await trx('ad_creatives')
      .where({ company_id: companyId })
      .whereIn('id', creativeIds)
      .del();
  }
}

async function seedCampaign(trx, { companyId, adAccountId, prefix, campaign }) {
  const [campaignId] = await trx('campaigns').insert({
    company_id: companyId,
    ad_account_id: adAccountId,
    campaign_id: campaign.metaCampaignId,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    daily_budget: campaign.dailyBudget,
  });

  let adSetCount = 0;
  let adCount = 0;
  for (const adSet of campaign.adSets) {
    const [adSetId] = await trx('ad_sets').insert({
      company_id: companyId,
      campaign_id: campaignId,
      meta_adset_id: `${prefix}_adset_${adSet.key}`,
      name: adSet.name,
      daily_budget: null,
      targeting: JSON.stringify({
        geo_locations: { countries: ['BR'] },
        age_min: 25,
        age_max: 55,
        ...(adSet.channel ? { messageChannel: adSet.channel } : {}),
      }),
      status: campaign.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
    });
    adSetCount += 1;

    for (const ad of adSet.ads) {
      const metaCreativeId = `${prefix}_creative_${ad.key}`;
      const [creativeId] = await trx('ad_creatives').insert({
        company_id: companyId,
        ad_account_id: adAccountId,
        meta_creative_id: metaCreativeId,
        name: `Criativo — ${ad.name}`,
        title: ad.title,
        body: ad.body,
        image_hash: `${prefix}_image_${ad.key}`,
        cta_type: ad.cta,
        status: 'ACTIVE',
      });

      await trx('ads').insert({
        company_id: companyId,
        ad_set_id: adSetId,
        creative_id: creativeId,
        meta_ad_id: `${prefix}_ad_${ad.key}`,
        name: ad.name,
        status: ad.status,
      });
      adCount += 1;
    }
  }

  return { adSetCount, adCount };
}

async function main() {
  assertLocalEnvironment();
  const args = parseArgs(process.argv.slice(2));
  const db = createKnex();

  try {
    const companyId = await resolveCompanyId(db, args.email || null);
    const prefix = `${DEMO_PREFIX}_company_${companyId}`;
    const adAccountId = String(args.accountId || 'act_demo_1n_local');

    // O identificador existe apenas para marcar a origem local nas campanhas.
    // Ele não deve aparecer como uma conta selecionável nem chegar à Graph API.
    await db('meta_ad_accounts')
      .where({
        company_id: companyId,
        account_id: adAccountId,
        name: 'Conta Demo Hierarquia 1:N (fake)',
      })
      .del();

    const result = await db.transaction(async (trx) => {
      await removeExistingDemo(trx, companyId, prefix);
      if (args.clean) return { campaigns: 0, adSets: 0, ads: 0 };

      let adSets = 0;
      let ads = 0;
      const definitions = demoDefinitions(prefix);
      for (const campaign of definitions) {
        const counts = await seedCampaign(trx, {
          companyId,
          adAccountId,
          prefix,
          campaign,
        });
        adSets += counts.adSetCount;
        ads += counts.adCount;
      }
      return { campaigns: definitions.length, adSets, ads };
    });

    if (args.clean) {
      console.log('OK — hierarquias de demonstração removidas');
    } else {
      console.log('OK — hierarquias de campanha criadas');
      console.log(`  empresa: ${companyId}`);
      console.log(`  campanhas: ${result.campaigns}`);
      console.log(`  ad sets: ${result.adSets}`);
      console.log(`  anúncios: ${result.ads}`);
      console.log('  acesse: http://localhost:5173/campaigns');
    }
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(`Falha no seed de hierarquias: ${error.message || error}`);
  process.exit(1);
});
