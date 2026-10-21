export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'STORE_OWNER' | 'PUBLIC';

export type ImplementationStatus =
  | 'Implemented and verified'
  | 'Partially implemented'
  | 'Specified but not implemented'
  | 'Requires verification';

export interface ParameterDef {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  format?: string;
  description?: string;
  example?: any;
  enum?: string[];
}

export interface SchemaProperty {
  type: string;
  format?: string;
  description?: string;
  required?: boolean | string[];
  example?: any;
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  enum?: string[];
}

export interface SchemaDef {
  type: string;
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaProperty;
  example?: any;
}

export interface ResponseDef {
  statusCode: number;
  description: string;
  schema?: SchemaDef;
  example?: any;
}

export interface EndpointSpec {
  id: number;
  method: HttpMethod;
  path: string; // e.g. "/auth/register" or "/screenings/{id}"
  moduleNumber: string; // "01" .. "16"
  moduleName: string; // "Authentication", etc.
  summary: string;
  description: string;
  roles: UserRole[];
  authRequired: boolean;
  authType: 'BearerAuth' | 'CookieAuth' | 'None' | 'BearerAuth | CookieAuth';
  implementationStatus: ImplementationStatus;
  statusNotes?: string;
  businessRules: string[];
  parameters?: ParameterDef[];
  requestBody?: {
    description: string;
    required: boolean;
    contentType: string;
    schema: SchemaDef;
    example: any;
  };
  responses: ResponseDef[];
  relatedEndpointIds?: number[];
}

export interface ModuleDef {
  number: string;
  id: string;
  name: string;
  description: string;
  icon: string;
  businessRules: string[];
}

