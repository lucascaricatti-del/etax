const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  nova: {
    label: "Nova",
    className: "bg-blue-100 text-blue-800",
  },
  em_confeccao: {
    label: "Em confecção",
    className: "bg-yellow-100 text-yellow-800",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    className: "bg-orange-100 text-orange-800",
  },
  aprovada: {
    label: "Aprovada",
    className: "bg-green-100 text-green-800",
  },
  enviada_assinatura: {
    label: "Enviada p/ assinatura",
    className: "bg-purple-100 text-purple-800",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-red-100 text-red-800",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
