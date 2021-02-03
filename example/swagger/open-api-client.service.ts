import { Injectable } from '@angular/core';
import { HttpClient, HttpResponseBase } from '@angular/common/http';
import { pick } from 'lodash';
import type { Observable } from 'rxjs';
import { warpHttpClient } from './warp-http-client';
import * as openApiDocs from './open-api-docs';
import type { OpenApiOperationsDictionary } from './open-api-docs';
import type { Any } from 'ts-toolbelt';

declare const AngularHttpClientURI: 'AngularHttpClientURI';

declare module './warp-http-client' {
  interface OpenApiRequestRegistry<Params, Response, Body, requestBody> {
    readonly [AngularHttpClientURI]: OpenApiRequest<
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
  ? {
      (param: Params, body: Body): Observable<Response>;
      (
        param: Params,
        body: Body,
        config: {
          readonly observe: 'response';
        }
      ): Observable<
        HttpResponseBase & {
          readonly body: Response;
        }
      >;
    }
  : {
      (param: Params, body?: Body): Observable<Response>;
      (
        param: Params,
        body: Body | undefined,
        config: {
          readonly observe: 'response';
        }
      ): Observable<
        HttpResponseBase & {
          readonly body: Response;
        }
      >;
    };

@Injectable({
  providedIn: 'root',
})
export class OpenApiClientService {
  constructor(private readonly http: HttpClient) {}

  public readonly req = warpHttpClient<OpenApiOperationsDictionary>(
    openApiDocs
  )<typeof AngularHttpClientURI>(
    ({ getUrl, method, params, parameterNames }, body, options) => {
      const queryParams = pick(params, parameterNames.query);
      const url = getUrl(params);
      return this.http.request(method, url, {
        params: queryParams,
        body,
        observe: options?.observe,
      });
    }
  );
}
