import { OpenAPIObject } from 'openapi3-ts';

export interface ApiDocument {
  readonly namespace: string;
  readonly url: string;
  readonly path: string;
  readonly operations?: ReadonlyArray<string>;
}

export interface ApiDocumentWithObject extends ApiDocument {
  openApiObject: OpenAPIObject;
}
export interface ConfigFile {
  readonly documents: ReadonlyArray<ApiDocument>;
  readonly targetFile: string;
}
