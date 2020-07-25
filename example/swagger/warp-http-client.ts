import { mapValues } from 'lodash';
import type { Union, Object } from 'ts-toolbelt';

export interface OpenApiRequestRegistry<Params, Response, Body, requestBody> {}

type OpenApiRequestRegistryURIS = keyof OpenApiRequestRegistry<
  unknown,
  unknown,
  unknown,
  undefined
>;

type OpenApiRequest<
  URI extends OpenApiRequestRegistryURIS,
  Params,
  Response,
  Body,
  requestBody
> = Object.At<OpenApiRequestRegistry<Params, Response, Body, requestBody>, URI>;

export const warpHttpClient = <OpenApiOperationsDictionary>(
  openApiDocs: any
) => <uri extends OpenApiRequestRegistryURIS>(
  httpClient: (
    requestParams: {
      readonly docNamespace: keyof OpenApiOperationsDictionary;
      readonly operationId: Union.Keys<
        OpenApiOperationsDictionary[keyof OpenApiOperationsDictionary]
      >;
      readonly getUrl: (params: any) => string;
      readonly method: string;
      readonly params: any;
      readonly parameterNames: {
        readonly path: ReadonlyArray<string>;
        readonly query: ReadonlyArray<string>;
        readonly header: ReadonlyArray<string>;
        readonly cookie: ReadonlyArray<string>;
      };
    },
    body: any,
    options: any
  ) => any
) =>
  (mapValues(openApiDocs, ({ paths }, docNamespace: any) =>
    mapValues(
      paths,
      ({ getUrl, method, parameterNames }: any, operationId: any) => (
        params: any,
        body: any,
        options: any
      ) =>
        httpClient(
          {
            docNamespace,
            operationId,
            getUrl,
            method,
            parameterNames,
            params,
          },
          body,
          options
        )
    )
  ) as any) as {
    [namespace in keyof OpenApiOperationsDictionary]: {
      [operationId in keyof OpenApiOperationsDictionary[namespace]]: OpenApiRequest<
        uri,
        Object.At<
          {} & OpenApiOperationsDictionary[namespace][operationId],
          'Parameter'
        >,
        Object.UnionOf<
          {} & Object.UnionOf<
            {} & Object.At<
              {} & OpenApiOperationsDictionary[namespace][operationId],
              'Response'
            >
          >
        >,
        Object.UnionOf<
          {} & Object.At<
            {} & OpenApiOperationsDictionary[namespace][operationId],
            'RequestBody'
          >
        >,
        Object.At<
          {} & OpenApiOperationsDictionary[namespace][operationId],
          'requestBody'
        >
      >;
    };
  };
