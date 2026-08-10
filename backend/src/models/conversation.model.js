export const ConversationChannel = Object.freeze({
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM',
  MESSENGER: 'MESSENGER',
});

export const ConversationStatus = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
});

export function toPublicConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    status: row.status,
    leadName: row.lead_name || null,
    leadPhone: row.lead_phone || null,
    leadEmail: row.lead_email || null,
    lastMessagePreview: row.last_message_preview || null,
    lastMessageAt: row.last_message_at || null,
    lastMessageDirection: row.last_message_direction || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Contato da conversa — apenas dados já persistidos (sem scraping).
 * Campos ausentes → null (UI exibe "Não informado").
 */
export function toPublicConversationContact(row, lead = null) {
  if (!row) return null;

  const raw = parseJson(lead?.raw_data);
  const social = extractSocialProfile(row.channel, raw);

  return {
    conversationId: row.id,
    leadId: row.lead_id,
    name: lead?.name || row.lead_name || null,
    phone: lead?.phone || row.lead_phone || null,
    email: lead?.email || row.lead_email || null,
    channel: row.channel,
    platform: lead?.platform || social.platform || null,
    socialUsername: social.username,
    socialProfileName: social.profileName,
    profilePictureUrl: social.profilePictureUrl,
    campaignName: lead?.campaign_name || null,
    adName: lead?.ad_name || null,
    formName: lead?.form_name || null,
    origin: lead?.origin || null,
    leadCreatedAt: lead?.created_at || null,
    externalUserId: row.external_user_id || null,
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractSocialProfile(channel, raw) {
  const empty = {
    platform: null,
    username: null,
    profileName: null,
    profilePictureUrl: null,
  };
  if (!raw || typeof raw !== 'object') {
    if (channel === 'INSTAGRAM') return { ...empty, platform: 'INSTAGRAM' };
    if (channel === 'WHATSAPP') return { ...empty, platform: 'WHATSAPP' };
    return empty;
  }

  const contact =
    raw.contact ||
    raw.sender ||
    raw.profile ||
    raw.instagram_profile ||
    raw.facebook_profile ||
    null;

  // Não usar igUsername do raw de inbound (é a conta da empresa, não do lead).
  const username =
    contact?.username ||
    contact?.ig_username ||
    raw.contact_username ||
    raw.instagram_username ||
    null;

  const profileName =
    contact?.name ||
    contact?.profile_name ||
    raw.profile_name ||
    null;

  const profilePictureUrl =
    contact?.profile_pic ||
    contact?.profile_picture_url ||
    raw.profile_pic ||
    raw.profile_picture_url ||
    null;

  let platform = raw.platform || null;
  if (!platform && channel === 'INSTAGRAM') platform = 'INSTAGRAM';
  if (!platform && (raw.facebook_profile || raw.page_scoped_id)) {
    platform = 'FACEBOOK';
  }

  return {
    platform,
    username: username ? String(username) : null,
    profileName: profileName ? String(profileName) : null,
    profilePictureUrl: profilePictureUrl ? String(profilePictureUrl) : null,
  };
}
