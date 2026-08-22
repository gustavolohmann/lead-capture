/**
 * Seed local: cria conta de anúncio, página e canais de mensagem fake (sem Meta real).
 *
 * Uso:
 *   node scripts/seed-local-ad-account.js
 *   node scripts/seed-local-ad-account.js --email=dev@localhost.com
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
    const user = await db('users').where({ email: String(email).toLowerCase() }).first();
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = createKnex();

  try {
    const companyId = await resolveCompanyId(db, args.email || null);

    const accountId = String(args.accountId || 'act_local_dev_001');
    const name = String(args.name || 'Conta Local Dev (fake)');
    const status = String(args.status || '1');

    await db.raw(
      `INSERT INTO meta_ad_accounts (company_id, account_id, name, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         status = VALUES(status),
         updated_at = CURRENT_TIMESTAMP`,
      [companyId, accountId, name, status]
    );

    // Página fake opcional (ajuda wizards que pedem page)
    const pageId = String(args.pageId || 'page_local_dev_001');
    const pageName = String(args.pageName || 'Página Local Dev (fake)');
    await db.raw(
      `INSERT INTO meta_pages (company_id, page_id, name, access_token_encrypted)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         updated_at = CURRENT_TIMESTAMP`,
      [companyId, pageId, pageName, null]
    );

    const adAccount = await db('meta_ad_accounts')
      .where({ company_id: companyId, account_id: accountId })
      .first();
    const page = await db('meta_pages')
      .where({ company_id: companyId, page_id: pageId })
      .first();

    // Canal WhatsApp fake (necessário para wizard "Receber mensagens")
    const waBusinessAccountId = String(
      args.waBusinessAccountId || 'waba_local_dev_001'
    );
    const waPhoneNumber = String(args.waPhoneNumber || '+5500000000000');
    const waPhoneNumberId = String(args.waPhoneNumberId || 'wa_phone_local_dev_001');
    await db.raw(
      `INSERT INTO meta_whatsapp_accounts (
         company_id, business_account_id, phone_number, phone_number_id
       )
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone_number = VALUES(phone_number),
         phone_number_id = VALUES(phone_number_id)`,
      [companyId, waBusinessAccountId, waPhoneNumber, waPhoneNumberId]
    );

    // Instagram fake (opcional, segundo canal)
    const igId = String(args.instagramId || 'ig_local_dev_001');
    const igUsername = String(args.instagramUsername || 'local_dev_fake');
    await db.raw(
      `INSERT INTO meta_instagram_accounts (company_id, instagram_id, username)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username)`,
      [companyId, igId, igUsername]
    );

    const whatsapp = await db('meta_whatsapp_accounts')
      .where({
        company_id: companyId,
        business_account_id: waBusinessAccountId,
      })
      .first();
    const instagram = await db('meta_instagram_accounts')
      .where({ company_id: companyId, instagram_id: igId })
      .first();

    console.log('OK — seed local criado');
    console.log(`  companyId: ${companyId}`);
    console.log(`  adAccount: ${adAccount.account_id} (${adAccount.name})`);
    console.log(`  page: ${page.page_id} (${page.name})`);
    console.log(
      `  whatsapp: ${whatsapp.phone_number} (waba ${whatsapp.business_account_id})`
    );
    console.log(
      `  instagram: @${instagram.username} (${instagram.instagram_id})`
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
