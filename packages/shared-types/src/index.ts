export type EntityType =
  | 'PROPRIETORSHIP'
  | 'PARTNERSHIP'
  | 'LLP'
  | 'PRIVATE_LTD'
  | 'PUBLIC_LTD'
  | 'OPC';

export type RuleSetStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
