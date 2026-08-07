import { metaGraphClient } from './meta.graph.client.js';
import { companyService } from './company.service.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaPageRepository } from '../repositories/meta.page.repository.js';
import { metaAdAccountRepository } from '../repositories/meta.adAccount.repository.js';
import { metaInstagramRepository } from '../repositories/meta.instagram.repository.js';
import { metaWhatsappRepository } from '../repositories/meta.whatsapp.repository.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toPublicMetaPage } from '../models/meta.page.model.js';
import { toPublicMetaAdAccount } from '../models/meta.adAccount.model.js';
import { toPublicMetaInstagramAccount } from '../models/meta.instagram.model.js';
import { toPublicMetaWhatsappAccount } from '../models/meta.whatsapp.model.js';

async function assertCompanyAndConnection(companyId) {
  const company = await companyService.getById(companyId);
  if (!company) {
    throw new AppError('Empresa não encontrada', {
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  }

  const connection = await metaConnectionRepository.findByCompanyId(companyId);
  if (!connection?.access_token_encrypted) {
    throw new AppError('Empresa não possui conexão Meta ativa', {
      statusCode: 400,
      code: 'META_NOT_CONNECTED',
    });
  }

  let accessToken;
  try {
    accessToken = decrypt(connection.access_token_encrypted);
  } catch {
    throw new AppError('Token Meta inválido ou corrompido', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }

  if (!accessToken) {
    throw new AppError('Token Meta inválido ou expirado', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }

  return { company, connection, accessToken };
}

function mapAdAccountStatus(accountStatus) {
  if (accountStatus == null) return null;
  return String(accountStatus);
}

function extractWhatsappPhoneInfo(waba) {
  const phones = waba?.phone_numbers?.data || waba?.phone_numbers || [];
  if (!Array.isArray(phones) || phones.length === 0) {
    return { phoneNumber: null, phoneNumberId: null };
  }

  const scored = [...phones].sort((a, b) => {
    const rank = (phone) => {
      const display = String(
        phone?.display_phone_number || phone?.phone_number || ''
      );
      const digits = display.replace(/\D/g, '');
      if (digits.startsWith('1555') || digits.startsWith('555')) return 90;
      if (digits.startsWith('55')) return 1;
      if (digits.length >= 10) return 10;
      return 50;
    };
    return rank(a) - rank(b);
  });

  const chosen = scored[0];
  return {
    phoneNumber:
      chosen.display_phone_number || chosen.phone_number || null,
    phoneNumberId: chosen.id ? String(chosen.id) : null,
  };
}

export const metaAssetsService = {
  async syncPages(companyId, accessToken) {
    const token =
      accessToken || (await assertCompanyAndConnection(companyId)).accessToken;

    const response = await metaGraphClient.getPages(token);
    const pages = response?.data || [];
    let count = 0;

    for (const page of pages) {
      if (!page?.id || !page?.name) continue;

      const pageTokenEncrypted = page.access_token
        ? encrypt(page.access_token)
        : null;

      await metaPageRepository.upsert({
        companyId,
        pageId: String(page.id),
        name: page.name,
        accessTokenEncrypted: pageTokenEncrypted,
      });
      count += 1;
    }

    return count;
  },

  async syncAdAccounts(companyId, accessToken) {
    const token =
      accessToken || (await assertCompanyAndConnection(companyId)).accessToken;

    const response = await metaGraphClient.getAdAccounts(token);
    const accounts = response?.data || [];
    let count = 0;

    for (const account of accounts) {
      if (!account?.id) continue;

      await metaAdAccountRepository.upsert({
        companyId,
        accountId: String(account.id),
        name: account.name || null,
        status: mapAdAccountStatus(account.account_status),
      });
      count += 1;
    }

    return count;
  },

  async syncInstagram(companyId) {
    const pages = await metaPageRepository.findByCompanyId(companyId);
    let count = 0;
    const seen = new Set();

    for (const page of pages) {
      if (!page.access_token_encrypted) continue;

      try {
        const pageToken = decrypt(page.access_token_encrypted);
        const response = await metaGraphClient.getPageInstagram(
          page.page_id,
          pageToken
        );
        const ig = response?.instagram_business_account;
        if (!ig?.id || seen.has(String(ig.id))) continue;

        await metaInstagramRepository.upsert({
          companyId,
          instagramId: String(ig.id),
          username: ig.username || null,
        });
        seen.add(String(ig.id));
        count += 1;
      } catch (error) {
        logger.error('Falha ao sincronizar Instagram da página', {
          companyId,
          pageId: page.page_id,
          code: error.code || null,
        });
      }
    }

    return count;
  },

  async syncWhatsapp(companyId, accessToken, connection) {
    const resolved =
      accessToken && connection
        ? { accessToken, connection }
        : await assertCompanyAndConnection(companyId);

    if (!resolved.connection.business_id) {
      logger.info('Sync WhatsApp ignorado: business_id ausente', { companyId });
      return 0;
    }

    const businessId = resolved.connection.business_id;
    const seen = new Set();
    let count = 0;

    const collectors = [
      () =>
        metaGraphClient.getOwnedWhatsappAccounts(
          businessId,
          resolved.accessToken
        ),
      () =>
        metaGraphClient.getClientWhatsappAccounts(
          businessId,
          resolved.accessToken
        ),
    ];

    for (const collect of collectors) {
      try {
        const response = await collect();
        const accounts = response?.data || [];

        for (const waba of accounts) {
          if (!waba?.id || seen.has(String(waba.id))) continue;

          let phoneInfo = extractWhatsappPhoneInfo(waba);

          // Lista do Business às vezes vem sem phone_numbers aninhados
          if (!phoneInfo.phoneNumberId) {
            try {
              const detailed = await metaGraphClient.getWhatsappAccountPhones(
                String(waba.id),
                resolved.accessToken
              );
              phoneInfo = extractWhatsappPhoneInfo(detailed || waba);
            } catch {
              // mantém phoneInfo parcial
            }
          }

          await metaWhatsappRepository.upsert({
            companyId,
            businessAccountId: String(waba.id),
            phoneNumber: phoneInfo.phoneNumber,
            phoneNumberId: phoneInfo.phoneNumberId,
          });

          // Garante webhook inbound na Cloud API para esta WABA
          try {
            await metaGraphClient.subscribeWhatsappWaba(
              String(waba.id),
              resolved.accessToken
            );
            logger.info('WABA assinada no app para webhooks', {
              companyId,
              wabaId: String(waba.id),
              phoneNumber: phoneInfo.phoneNumber,
              phoneNumberId: phoneInfo.phoneNumberId,
            });
          } catch (error) {
            logger.error('Falha ao assinar WABA no app', {
              companyId,
              wabaId: String(waba.id),
              phoneNumber: phoneInfo.phoneNumber,
              code: error.code || null,
              detail: error.message,
            });
          }

          seen.add(String(waba.id));
          count += 1;
        }
      } catch (error) {
        logger.error('Falha parcial ao sincronizar WhatsApp', {
          companyId,
          businessId,
          code: error.code || null,
        });
      }
    }

    return count;
  },

  async syncAll(companyId) {
    logger.info('Sync assets executado', { companyId });

    // 1-2. Company + connection + decrypt token
    const { connection, accessToken } =
      await assertCompanyAndConnection(companyId);

    // 3-6. Ordem obrigatória
    const pages = await this.syncPages(companyId, accessToken);
    const adAccounts = await this.syncAdAccounts(companyId, accessToken);
    const instagramAccounts = await this.syncInstagram(companyId);
    const whatsappAccounts = await this.syncWhatsapp(
      companyId,
      accessToken,
      connection
    );

    const synced = {
      pages,
      adAccounts,
      instagramAccounts,
      whatsappAccounts,
    };

    logger.info('Sync assets concluído', { companyId, ...synced });

    // 7. Resumo
    return synced;
  },

  async listAssets(companyId) {
    const company = await companyService.getById(companyId);
    if (!company) {
      throw new AppError('Empresa não encontrada', {
        statusCode: 404,
        code: 'COMPANY_NOT_FOUND',
      });
    }

    const [pages, adAccounts, instagramAccounts, whatsappAccounts] =
      await Promise.all([
        metaPageRepository.findByCompanyId(companyId),
        metaAdAccountRepository.findByCompanyId(companyId),
        metaInstagramRepository.findByCompanyId(companyId),
        metaWhatsappRepository.findByCompanyId(companyId),
      ]);

    return {
      pages: pages.map(toPublicMetaPage),
      adAccounts: adAccounts.map(toPublicMetaAdAccount),
      instagramAccounts: instagramAccounts.map(toPublicMetaInstagramAccount),
      whatsappAccounts: whatsappAccounts.map(toPublicMetaWhatsappAccount),
    };
  },
};
