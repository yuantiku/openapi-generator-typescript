/**
 * use open-api-docs with fetch/node-fetch
 */

import fetch from 'node-fetch';
import * as querystring from 'querystring';
import { pick } from 'lodash';
import { warpHttpClient } from './warp-http-client';
import * as openApiDocs from './open-api-docs';
import type { OpenApiOperationsDictionary } from './open-api-docs';
import type { Any } from 'ts-toolbelt';

declare const FetchHttpClientURI: 'FetchHttpClientURI';

declare module './warp-http-client' {
  interface OpenApiRequestRegistry<Params, Response, Body, requestBody> {
    readonly [FetchHttpClientURI]: OpenApiRequest<
      Params,
      Response,
      Body,
      requestBody
    >;
  }
}

type OpenApiRequest<Params, Response, Body, requestBody> = true extends Any.At<
  {} & requestBody,
  'required'
>
  ? (param: Params, body: Body) => Promise<Response>
  : (param: Params, body?: Body) => Promise<Response>;

export const openApiClient = warpHttpClient<OpenApiOperationsDictionary>(
  openApiDocs
)<typeof FetchHttpClientURI>(
  ({ getUrl, method, params, parameterNames }, body, config) => {
    const queryParams = pick(params, parameterNames.query);
    const url = getUrl({ params });

    return fetch(url + '?' + querystring.stringify(queryParams), {
      method,
      body: JSON.stringify(body),
    }).then(x => x.json());
  }
);
