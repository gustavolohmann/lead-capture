const STATUS_MAP = {
  ACTIVE: { label: 'Ativa', tone: 'success' },
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  IN_PROCESS: { label: 'Processando', tone: 'info' },
  WITH_ISSUES: { label: 'Com pendências', tone: 'warning' },
  DISAPPROVED: { label: 'Reprovada', tone: 'danger' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  ARCHIVED: { label: 'Arquivada', tone: 'neutral' },
  DELETED: { label: 'Excluída', tone: 'danger' },
  PENDING: { label: 'Em análise', tone: 'info' },
  PROCESSING: { label: 'Processando', tone: 'info' },
  ERROR: { label: 'Com erro', tone: 'danger' },
  REJECTED: { label: 'Rejeitada', tone: 'danger' },
};

export function campaignStatusMeta(status) {
  const key = String(status || '').toUpperCase();
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  if (!status) return { label: '—', tone: 'neutral' };
  return { label: String(status), tone: 'neutral' };
}
