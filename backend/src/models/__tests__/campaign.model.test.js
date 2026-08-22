import { describe, expect, it } from 'vitest';
import { isLocalDemoCampaign, toPublicCampaign } from '../campaign.model.js';

describe('campaign.model local demo marker', () => {
  it('marks only hierarchy seed campaigns as local demos', () => {
    const demo = {
      ad_account_id: 'act_demo_1n_local',
      campaign_id: 'demo_1n_company_2_campaign_leads',
    };

    expect(isLocalDemoCampaign(demo)).toBe(true);
    expect(toPublicCampaign(demo).isLocalDemo).toBe(true);
  });

  it('does not mark real Meta campaigns or unrelated local accounts', () => {
    expect(
      isLocalDemoCampaign({
        ad_account_id: 'act_123456',
        campaign_id: '120000000000001',
      })
    ).toBe(false);
    expect(
      isLocalDemoCampaign({
        ad_account_id: 'act_demo_1n_local',
        campaign_id: 'another_campaign',
      })
    ).toBe(false);
  });
});
