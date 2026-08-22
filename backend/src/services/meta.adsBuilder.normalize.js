/**
 * Converte o contrato legado (`creative`) e o contrato 1:N (`ads`) para uma
 * representação única usada pelo Ads Builder.
 */
export function normalizeCampaignAds(input = {}) {
  const source = Array.isArray(input.ads) && input.ads.length
    ? input.ads
    : [{ creative: input.creative || {} }];

  return source.map((item, index) => {
    const creativeInput = { ...(item?.creative || {}) };
    const name = String(item?.name || creativeInput.adName || '').trim();
    if (name) creativeInput.adName = name;

    return {
      index,
      clientKey: item?.clientKey ? String(item.clientKey) : null,
      messageChannel: item?.messageChannel
        ? String(item.messageChannel).toUpperCase()
        : null,
      creativeInput,
    };
  });
}
