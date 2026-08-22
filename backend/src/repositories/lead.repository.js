import { db } from '../config/database.js';
import { LeadStatus } from '../models/lead.model.js';

export const leadRepository = {
  async create({
    companyId,
    pageId,
    formId,
    companyFormId,
    metaLeadId,
    name,
    email,
    phone,
    status = LeadStatus.NEW,
    source = 'META_LEAD_ADS',
    origin = null,
    formName = null,
    campaignId = null,
    campaignName = null,
    adsetId = null,
    adsetName = null,
    adId = null,
    adName = null,
    platform = null,
    isOrganic = false,
    rawData,
  }) {
    const [id] = await db('leads').insert({
      company_id: companyId,
      page_id: pageId ?? null,
      form_id: formId ?? null,
      company_form_id: companyFormId ?? null,
      meta_lead_id: metaLeadId ?? null,
      name: name ?? null,
      email: email ?? null,
      phone: phone ?? null,
      status,
      source,
      origin: origin ?? null,
      form_name: formName ?? null,
      campaign_id: campaignId ?? null,
      campaign_name: campaignName ?? null,
      adset_id: adsetId ?? null,
      adset_name: adsetName ?? null,
      ad_id: adId ?? null,
      ad_name: adName ?? null,
      platform: platform ?? null,
      is_organic: isOrganic ? 1 : 0,
      raw_data: rawData ? JSON.stringify(rawData) : null,
    });

    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('leads').where({ company_id: companyId, id }).first();
  },

  async findByCompanyId(companyId, { limit = 200, offset = 0 } = {}) {
    return db('leads')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  },

  async findByMetaLeadId(companyId, metaLeadId) {
    return db('leads')
      .where({ company_id: companyId, meta_lead_id: metaLeadId })
      .first();
  },

  async findByPhoneDigits(companyId, phoneDigits) {
    if (!phoneDigits) return null;
    const digits = String(phoneDigits).replace(/\D/g, '');
    if (digits.length < 8) return null;

    const leads = await db('leads')
      .where({ company_id: companyId })
      .whereNotNull('phone')
      .select('*');

    const match = leads.find((lead) => {
      const leadDigits = String(lead.phone || '').replace(/\D/g, '');
      if (!leadDigits) return false;
      if (leadDigits === digits) return true;
      const shorter = leadDigits.length < digits.length ? leadDigits : digits;
      const longer = leadDigits.length < digits.length ? digits : leadDigits;
      return longer.endsWith(shorter) && shorter.length >= 8;
    });

    return match || null;
  },

  async existsByMetaLeadId(metaLeadId) {
    const row = await db('leads').where({ meta_lead_id: metaLeadId }).first('id');
    return Boolean(row);
  },

  async updateStatus(companyId, id, status) {
    await db('leads').where({ company_id: companyId, id }).update({ status });
    return this.findById(companyId, id);
  },

  async updateProfile(companyId, id, { name, rawData, platform } = {}) {
    const data = {};
    if (name != null) data.name = name;
    if (platform != null) data.platform = platform;
    if (rawData !== undefined) {
      data.raw_data = rawData ? JSON.stringify(rawData) : null;
    }
    if (!Object.keys(data).length) {
      return this.findById(companyId, id);
    }
    await db('leads').where({ company_id: companyId, id }).update(data);
    return this.findById(companyId, id);
  },
};
