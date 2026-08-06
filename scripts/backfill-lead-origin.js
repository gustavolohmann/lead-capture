import { createKnex } from './db.js';

/**
 * Preenche origin/campanha/anúncio a partir do raw_data nos leads antigos.
 */
async function main() {
  const db = createKnex();
  try {
    const rows = await db('leads').select('*');
    let updated = 0;

    for (const row of rows) {
      let raw = row.raw_data;
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = null;
        }
      }
      if (!raw || typeof raw !== 'object') continue;

      const campaignId = row.campaign_id || raw.campaign_id || null;
      const campaignName = row.campaign_name || raw.campaign_name || null;
      const adsetId = row.adset_id || raw.adset_id || null;
      const adsetName = row.adset_name || raw.adset_name || null;
      const adId = row.ad_id || raw.ad_id || null;
      const adName = row.ad_name || raw.ad_name || null;
      const platform = row.platform || raw.platform || null;
      const isOrganic = row.is_organic || raw.is_organic ? 1 : 0;
      const formName =
        row.form_name ||
        raw.formName ||
        raw.form_name ||
        (row.source === 'FORM' ? 'Formulário' : null);

      let origin = row.origin;
      if (!origin) {
        if (row.source === 'FORM') {
          origin = formName ? `Formulário · ${formName}` : 'Formulário';
        } else {
          const parts = ['Lead Ads'];
          if (isOrganic) parts.push('Orgânico');
          if (campaignName) parts.push(campaignName);
          else if (adName) parts.push(adName);
          origin = parts.join(' · ');
        }
      }

      // Enrich raw_data with labels if missing for seed-like fields
      if (raw.field_data && !raw.question_labels) {
        raw.question_labels = {
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
      }

      await db('leads')
        .where({ id: row.id })
        .update({
          origin,
          form_name: formName,
          campaign_id: campaignId ? String(campaignId) : null,
          campaign_name: campaignName ? String(campaignName) : null,
          adset_id: adsetId ? String(adsetId) : null,
          adset_name: adsetName ? String(adsetName) : null,
          ad_id: adId ? String(adId) : null,
          ad_name: adName ? String(adName) : null,
          platform: platform ? String(platform) : null,
          is_organic: isOrganic,
          raw_data: JSON.stringify(raw),
        });
      updated += 1;
    }

    console.log(`Leads atualizados: ${updated}/${rows.length}`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
