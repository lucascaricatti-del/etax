export interface Workspace {
  id: string;
  nome: string;
  cnpj: string | null;
  slug: string;
  ativo: boolean;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  token: string;
  accepted: boolean;
  expires_at: string;
  created_at: string;
}

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
  workspace_id: string | null;
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
