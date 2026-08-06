export function toPublicLeadForm(row) {
  if (!row) return null;

  let questions = row.questions;
  if (typeof questions === 'string') {
    try {
      questions = JSON.parse(questions);
    } catch {
      questions = null;
    }
  }

  return {
    id: row.id,
    pageId: row.page_id,
    formId: row.form_id,
    name: row.name,
    status: row.status,
    questions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
