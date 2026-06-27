export interface CampoSchema {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "email" | "tel" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface TipoContrato {
  id: string;
  nome: string;
  slug: string;
  schema_campos: CampoSchema[];
  ativo: boolean;
  created_at: string;
}

export interface Contraparte {
  id: string;
  nome: string;
  cpf_cnpj: string;
  tipo_pessoa: "PF" | "PJ";
  email: string | null;
  telefone: string | null;
  created_at: string;
}

export interface Solicitacao {
  id: string;
  tipo_contrato_id: string;
  contraparte_id: string;
  status: string;
  dados: Record<string, unknown>;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitacaoComDetalhes extends Solicitacao {
  contraparte: Contraparte;
  tipo_contrato: TipoContrato;
}
