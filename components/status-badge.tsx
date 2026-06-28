const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  // Solicitação statuses
  nova: {
    label: "Nova",
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
    bg: "bg-[var(--color-status-info-bg)]",
  },
  em_confeccao: {
    label: "Em confecção",
    dot: "bg-[var(--color-status-warn)]",
    text: "text-[var(--color-status-warn)]",
    bg: "bg-[var(--color-status-warn-bg)]",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    dot: "bg-[var(--color-status-warn)]",
    text: "text-[var(--color-status-warn)]",
    bg: "bg-[var(--color-status-warn-bg)]",
  },
  aprovada: {
    label: "Aprovada",
    dot: "bg-[var(--color-status-ok)]",
    text: "text-[var(--color-status-ok)]",
    bg: "bg-[var(--color-status-ok-bg)]",
  },
  enviada_assinatura: {
    label: "Enviada p/ assinatura",
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
    bg: "bg-[var(--color-status-info-bg)]",
  },
  cancelada: {
    label: "Cancelada",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  // Assinatura statuses
  aguardando_assinatura: {
    label: "Aguardando assinatura",
    dot: "bg-[var(--color-status-warn)]",
    text: "text-[var(--color-status-warn)]",
    bg: "bg-[var(--color-status-warn-bg)]",
  },
  assinado: {
    label: "Assinado",
    dot: "bg-[var(--color-status-ok)]",
    text: "text-[var(--color-status-ok)]",
    bg: "bg-[var(--color-status-ok-bg)]",
  },
  assinada: {
    label: "Assinada",
    dot: "bg-[var(--color-status-ok)]",
    text: "text-[var(--color-status-ok)]",
    bg: "bg-[var(--color-status-ok-bg)]",
  },
  recusado: {
    label: "Recusado",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  recusada: {
    label: "Recusada",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  expirado: {
    label: "Expirado",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  expirada: {
    label: "Expirada",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  distratado: {
    label: "Distratado",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  // Vigência
  vigente: {
    label: "Vigente",
    dot: "bg-[var(--color-status-ok)]",
    text: "text-[var(--color-status-ok)]",
    bg: "bg-[var(--color-status-ok-bg)]",
  },
  a_vencer: {
    label: "A vencer",
    dot: "bg-[var(--color-status-warn)]",
    text: "text-[var(--color-status-warn)]",
    bg: "bg-[var(--color-status-warn-bg)]",
  },
  vencido: {
    label: "Vencido",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
    bg: "bg-[var(--color-status-danger-bg)]",
  },
  encerrado: {
    label: "Encerrado",
    dot: "bg-[var(--color-text-mute)]",
    text: "text-[var(--color-text-mute)]",
    bg: "bg-[var(--color-status-info-bg)]",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    dot: "bg-[var(--color-text-mute)]",
    text: "text-[var(--color-text-soft)]",
    bg: "bg-[var(--color-status-info-bg)]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${config.text} ${config.bg}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
