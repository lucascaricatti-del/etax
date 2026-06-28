export interface Workspace {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  slug: string;
  ativo: boolean;
  criado_em: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  papel: string;
  criado_em: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  papel: string;
  token: string;
  aceito_em: string | null;
  expira_em: string;
  criado_em: string;
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
}

export interface Contraparte {
  id: string;
  nome: string;
  cpf_cnpj: string;
  tipo_pessoa: "PF" | "PJ";
  email: string | null;
  telefone: string | null;
  criado_em: string;
  workspace_id: string | null;
}

export interface Solicitacao {
  id: string;
  tipo_contrato_id: string;
  contraparte_id: string;
  workspace_id: string | null;
  solicitante_id: string | null;
  status: string;
  dados: Record<string, unknown>;
  observacoes: string | null;
  modelo_id: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  motivo_reprovacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SolicitacaoComDetalhes extends Solicitacao {
  contraparte: Contraparte;
  tipo_contrato: TipoContrato;
  modelo?: Modelo | null;
}

export interface Modelo {
  id: string;
  tipo_contrato_id: string;
  clicksign_template_key: string;
  variaveis: string[];
  versao: number;
  ativo: boolean;
  criado_em: string;
  workspace_id: string | null;
  nome: string | null;
  descricao: string | null;
  natureza_financeira: "receita" | "despesa" | "neutro";
  disponibilidade: "todas" | "especificas";
}

export interface ModeloComDetalhes extends Modelo {
  tipo_contrato?: TipoContrato | null;
  modelo_empresas?: { workspace_id: string }[];
}
