/* eslint-disable no-use-before-define */
import type {
  SchemaObject,
  ReferenceObject,
  ComponentsObject,
  OpenAPIObject,
  PathsObject,
  PathItemObject,
  ParameterObject,
  ResponseObject,
  DiscriminatorObject,
  RequestBodyObject,
} from 'openapi3-ts';
import { ApiDocumentWithObject } from './config-file-model';
import { identifier, property } from 'safe-identifier';
import { parseUrlTemplate } from './utils';
import { isNotUndefined, isNotNil, identity } from 'utils-ts';
import * as assert from 'assert';
import { repeat, difference, mapValues, omit } from 'lodash-es';

function isReferenceObject(obj: object): obj is ReferenceObject {
  return obj.hasOwnProperty('$ref');
}

function isNotReferenceObject<T extends object>(
  x: T
): x is Exclude<T, ReferenceObject> {
  return !isReferenceObject(x);
}

type DiscriminatorSchema = SchemaObject &
  (
    | {
        discriminator: DiscriminatorObject;
        oneOf: Array<SchemaObject | ReferenceObject>;
      }
    | {
        discriminator: DiscriminatorObject;
        anyOf: Array<SchemaObject | ReferenceObject>;
      }
  );

function isDiscriminatorSchema(
  x: SchemaObject,
  name: string
): x is DiscriminatorSchema {
  if (x.discriminator === undefined) {
    return false;
  }
  const child = x.oneOf ?? x.anyOf;
  if (x.discriminator.mapping === undefined || child === undefined) {
    console.warn(
      `schema '#/components/schemas/${name} is discriminator, but lack discriminator.mapping or oneOf`
    );
    return false;
  }
  assert.strictEqual(
    Object.keys(x.discriminator.mapping!).length,
    child!.length
  );
  return true;
}

const fromEntries = Object.fromEntries as <T = any>(
  entries: Iterable<readonly [PropertyKey, T]>
) => { [k in string]: T };

export const isIdentifierString = (str: string) =>
  /[a-zA-Z][a-zA-Z0-9]*/.test(str);

const useConstEnum = false;

const unionNull = (type: string) => type + ' | null';

const indentSize = 2;
const indentString = repeat(' ', indentSize);

/**
 *
 * @param str 字符串
 * @returns 带引号的字符串
 */
const formatString = (str: string) => JSON.stringify(str);
/**
 *
 * @param key key
 * @returns 如果是合法的 identifier，直接返回，否则带引号返回
 */
const formatKey = (key: string) => property(null, key);

export const formatComments = (comments: readonly string[]) =>
  comments.length === 0
    ? undefined
    : `/**${comments.map(x => `\n * ${x}`).join('')}
 */`;

export function formatSchemasJSDoc({
  description,
  format,
  example,
}: SchemaObject) {
  let a: string[] = [];
  if (description) {
    a = description.split('\n');
  }

  if (format) {
    a.push(`@format ${format}`);
  }
  /**
   * Note that schemas and properties support single example but not multiple examples.
   */
  if (example) {
    a.push('@example', example);
  }

  return formatComments(a);
}

const formatEntries = (
  xs: ReadonlyArray<{
    readonly key: string;
    readonly value: string | number;
    readonly middleSep?: string;
    readonly doc?: string;
    readonly modifiers?: ReadonlyArray<string>;
  }>,
  {
    middleSeparator = ': ',
    endSeparator = ',',
    trailingEndSeparator = false,
  } = {}
) =>
  addIndentLevel(
    xs
      .map(
        ({ key, value, middleSep = middleSeparator, doc, modifiers = [] }) =>
          `${doc === undefined ? '' : doc + '\n'}${modifiers
            .map(x => x + ' ')
            .join('')}${key}${middleSep}${value}`
      )
      .join(endSeparator + '\n') +
      (trailingEndSeparator && xs.length > 0 ? endSeparator : '')
  );

const addIndentLevel = (str: string) =>
  str
    .split('\n')
    .map(x => indentString + x)
    .join('\n');

export function getRef({ $ref }: ReferenceObject) {
  if ($ref.startsWith('#/components/schemas/')) {
    return 'schemas.' + identifier($ref.slice('#/components/schemas/'.length));
  } else {
    throw new Error(
      'This library only resolve $ref that are include into `#/components/schemas` for now'
    );
  }
}

export const resolveValue = (schema: SchemaObject): string =>
  isReferenceObject(schema) ? getRef(schema) : getScalar(schema);

export const generateEnumSchema = (name: string, schema: SchemaObject) =>
  `${formatSchemasJSDoc(schema) ?? ''}export ${
    useConstEnum ? 'const ' : ''
  }enum ${identifier(name)} {
${formatEntries(
  schema.enum!.map(v =>
    schema.type === 'string'
      ? {
          key: formatKey(v),
          value: formatString(v),
        }
      : {
          key: 'num_' + v,
          value: v,
        }
  ),
  { middleSeparator: ' = ', trailingEndSeparator: true }
)}
}`;

const unionType = (xs: ReadonlyArray<string>) => xs.join(' | ');
const intersectionType = (xs: ReadonlyArray<string>) => xs.join(' & ');

export const getScalar = (item: SchemaObject): string => {
  const handlingNull = item.nullable ? unionNull : identity;

  // TODO: 处理 unionOf 和 allOf 的逻辑，貌似不属于 getScalar。是否需要换函数名？
  const unionOf = item.anyOf ?? item.oneOf;
  if (unionOf !== undefined) {
    return unionType(unionOf.map(x => resolveValue(x)));
  }

  if (item.allOf !== undefined) {
    return intersectionType(item.allOf.map(x => resolveValue(x)));
  }

  switch (item.type) {
    case 'number':
    case 'integer':
      return handlingNull(item.enum ? unionType(item.enum) : 'number');

    case 'boolean':
      return handlingNull('boolean');

    case 'array':
      return handlingNull(getArray(item));

    case 'string':
      return handlingNull(
        item.enum ? unionType(item.enum.map(formatString)) : 'string'
      );

    case 'object':
      return handlingNull(getObject(item));
    default:
      throw new Error('unknown item type ' + item.type + JSON.stringify(item));
    // return getObject(item) + nullable;
  }
};

export function getObjectBody(item: SchemaObject): string {
  if (item.properties ?? item.additionalProperties) {
    const entries = Object.entries(item.properties ?? {}).map(([key, prop]) => {
      const required = (item.required ?? []).includes(key);
      return {
        key: formatKey(key),
        value: (required ? identity : unionNull)(resolveValue(prop)),
        modifiers: ['readonly'],
        middleSep: required ? ': ' : '?: ',
        doc: isReferenceObject(prop) ? undefined : formatSchemasJSDoc(prop),
      };
    });
    if (item.additionalProperties) {
      entries.push({
        key: '[key: string]',
        value:
          item.additionalProperties === true
            ? 'any'
            : resolveValue(item.additionalProperties),
        modifiers: ['readonly'],
        middleSep: ': ',
        doc: undefined,
      });
    }
    return formatEntries(entries, { trailingEndSeparator: true });
  } else {
    throw new Error('no properties');
  }
}

export function getObject(item: SchemaObject): string {
  if (item.properties ?? item.additionalProperties) {
    return `{
${getObjectBody(item)}
}`;
  } else {
    return item.type === 'object' ? '{ readonly [key: string]: any}' : 'any';
  }
}

export function getArray(item: SchemaObject): string {
  if (item.items) {
    return `ReadonlyArray<${resolveValue(item.items)}>`;
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
}

export const generateInterfaceSchema = (name: string, schema: SchemaObject) =>
  `export interface ${identifier(name)} ${resolveValue(schema)}`;

export function generate_parent_schema_definition(
  schemasEntriesDiscriminator: ReadonlyArray<
    readonly [string, DiscriminatorSchema]
  >
) {
  const result = schemasEntriesDiscriminator.map(
    ([name, schema]) =>
      `export interface ${identifier(name)} ${getObject({
        ...schema,
        properties: {
          // 这里不是很有必要
          [schema.discriminator.propertyName]: {
            type: 'string',
            enum: Object.keys(schema.discriminator.mapping ?? {}),
          },
          ...omit(schema.properties, [schema.discriminator.propertyName]),
        },
      })}`
  );
  return `namespace _parent_schema_definition {
${addIndentLevel(result.join('\n'))}
}

`;
}
const get_parent_schema_definition_ref = (name: string) =>
  '_parent_schema_definition.' + identifier(name);

export function generateSchemasDefinition(
  schemas: ComponentsObject['schemas'] = {}
) {
  const schemasEntries = Object.entries(schemas);

  const schemasEntriesDiscriminator = schemasEntries.filter(
    ([name, schema]) =>
      isNotReferenceObject(schema) && isDiscriminatorSchema(schema, name)
  ) as [string, DiscriminatorSchema][];

  const discriminatorChildDict = Object.fromEntries(
    schemasEntriesDiscriminator.flatMap(([parentName, schema]) => {
      const { propertyName, mapping } = schema.discriminator;
      return Object.entries(mapping!).map(([discriminant, references]) => [
        references,
        {
          references,
          discriminant,
          propertyName,
          parentName,
        },
      ]);
    })
  );

  const getDiscriminatorChild = (name: string) =>
    discriminatorChildDict['#/components/schemas/' + name];
  return (
    generate_parent_schema_definition(schemasEntriesDiscriminator) +
    schemasEntries
      .map(([name, schema]) =>
        isNotReferenceObject(schema) && schema.enum
          ? generateEnumSchema(name, schema)
          : isNotReferenceObject(schema) &&
            schema.type === 'object' &&
            schema.nullable !== true &&
            (schema.allOf ?? schema.anyOf ?? schema.oneOf) === undefined
          ? generateInterfaceSchema(name, schema)
          : `export type ${identifier(name)} = ${
              getDiscriminatorChild(name) !== undefined &&
              isNotReferenceObject(schema)
                ? intersectionType([
                    `\n{ readonly ${formatKey(
                      getDiscriminatorChild(name).propertyName
                    )}: ${JSON.stringify(
                      getDiscriminatorChild(name).discriminant
                    )} }`,
                    ...(schema.allOf === undefined
                      ? [resolveValue(schema)]
                      : schema.allOf.map(x =>
                          x.$ref ===
                          '#/components/schemas/' +
                            discriminatorChildDict[
                              '#/components/schemas/' + name
                            ].parentName
                            ? get_parent_schema_definition_ref(
                                discriminatorChildDict[
                                  '#/components/schemas/' + name
                                ].parentName
                              )
                            : resolveValue(
                                isReferenceObject(x)
                                  ? x
                                  : {
                                      ...x,
                                      required: [
                                        ...(x.required ?? []),
                                        ...(schema.required ?? []),
                                      ],
                                    }
                              )
                        )),
                  ])
                : resolveValue(schema)
            };`
      )
      .join('\n\n') +
    '\n'
  );
}

const httpMethods = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

export const generatePathsDefinition = (
  pathsObject: PathsObject,
  operations?: ReadonlyArray<string>
) =>
  Object.entries(pathsObject)
    .flatMap(([url, pathItemObject]) =>
      httpMethods
        .map(method => {
          const operationObject = (pathItemObject as PathItemObject)[method];
          return operationObject === undefined
            ? undefined
            : ({
                method,
                url,
                operationObject,
              } as const);
        })
        .filter(isNotUndefined)
    )
    .filter(
      ({ operationObject }) =>
        operations?.includes(operationObject.operationId!) ?? true
    )
    .map(({ method, url, operationObject }) => {
      // TODO: 忽略了所有的 ReferenceObject
      const parameters = (operationObject.parameters ?? []).filter(
        isNotReferenceObject
      );
      const pathParameters = parameters.filter(x => x.in === 'path');
      const queryParameters = parameters.filter(x => x.in === 'query');
      const cookieParameters = parameters.filter(x => x.in === 'cookie');
      const headerParameters = parameters.filter(x => x.in === 'header');
      const parsedUrl = parseUrlTemplate(url);

      const conflictParameters = difference(
        parameters,
        pathParameters
      ).filter(x => parsedUrl.pathParams.includes(x.name));

      if (conflictParameters.length > 0) {
        console.warn(
          `operation ${operationObject.operationId} has conflictParameters, url: ${url}, conflictParameters:`,
          conflictParameters
        );
      }

      const freePathVariables = difference(
        parsedUrl.pathParams,
        pathParameters.map(x => x.name)
      );

      if (freePathVariables.length > 0) {
        console.warn(
          `operation ${operationObject.operationId} has freePathVariables, url: ${url}, freePathVariables:`,
          freePathVariables
        );
      }

      const interfacePathParameter =
        pathParameters.length === 0 && parsedUrl.pathParams.length === 0
          ? ''
          : `export interface PathParameter {
${
  pathParameters.length === 0
    ? ''
    : getObjectBody({
        type: 'object',
        required: pathParameters.filter(x => x.required).map(x => x.name),
        properties: fromEntries([
          ...pathParameters.map(x => [x.name, { ...x.schema! }] as const),
        ]),
      }) + '\n'
}${formatEntries(
              freePathVariables.map(key => ({
                key,
                value: 'string | number, // FIXME: free variable here',
                modifiers: ['readonly'],
              })),
              {
                endSeparator: '',
              }
            )}
}
`;
      const formatContent = (
        interfaceName: string,
        parameterObjectList: ReadonlyArray<ParameterObject>
      ) =>
        parameterObjectList.length === 0
          ? ''
          : `export interface ${interfaceName} ${getObject({
              type: 'object',
              required: parameterObjectList
                .filter(x => x.required)
                .map(x => x.name),
              properties: fromEntries([
                ...parameterObjectList.map(x => [x.name, x.schema!] as const),
              ]),
            })}`;

      const responsesEntries = Object.entries(operationObject.responses).map(
        ([statusCode, object]) =>
          ({
            statusCode,
            responseObject: object as ResponseObject, // FIXME: 这里没有考虑 referenceObject 的情况
          } as const)
      );
      const responseInterfaceBody = getObject({
        type: 'object',
        required: responsesEntries.map(({ statusCode }) => statusCode),
        properties: fromEntries(
          responsesEntries.map(
            ({
              responseObject: { content },
              statusCode,
            }): readonly [string, SchemaObject] =>
              content === undefined
                ? [
                    statusCode,
                    {
                      type: 'object',
                    },
                  ]
                : [
                    statusCode,
                    {
                      type: 'object',
                      required: Object.keys(content),
                      properties: mapValues(content, ({ schema }) => schema!),
                    },
                  ]
          )
        ),
      });
      const getUrlFunction =
        parsedUrl.pathParams.length > 0
          ? `({ ${parsedUrl.pathParams.join(', ')} }: PathParameter) => \`${
              parsedUrl.urlJsTemplate
            }\``
          : `({} : {}) => '${parsedUrl.urlJsTemplate}'`;
      const interfaceQueryParameter = formatContent(
        'QueryParameter',
        queryParameters
      );
      const interfaceHeaderParameter = formatContent(
        'HeaderParameter',
        headerParameters
      );
      const interfaceCookieParameter = formatContent(
        'CookieParameter',
        cookieParameters
      );
      const interfaceAllParameters =
        interfacePathParameter +
        interfaceQueryParameter +
        interfaceHeaderParameter +
        interfaceCookieParameter;

      const requestBody = (operationObject.requestBody as RequestBodyObject)
        ?.content
        ? (operationObject.requestBody as RequestBodyObject)
        : undefined;
      const requestBodyContent = requestBody?.content ?? {};
      const requestBodyInterfaceBody = getObject({
        type: 'object',
        required: Object.keys(requestBodyContent),
        properties: mapValues(requestBodyContent, ({ schema }) => schema!),
      });

      const content = `
export const method = '${method}';
export const url = '${url}';
export const getUrl = ${getUrlFunction};
export const parameterNames = ${JSON.stringify({
        path: pathParameters.map(x => x.name),
        query: queryParameters.map(x => x.name),
        header: headerParameters.map(x => x.name),
        cookie: cookieParameters.map(x => x.name),
      })} as const
${interfaceAllParameters}
export type Parameter = ${
        interfaceAllParameters === ''
          ? '{}'
          : '' +
            ([
              ['PathParameter', interfacePathParameter],
              ['QueryParameter', interfaceQueryParameter],
              ['HeaderParameter', interfaceHeaderParameter],
              ['CookieParameter', interfaceCookieParameter],
            ] as const)
              .filter(x => x[1] !== '')
              .map(x => x[0])
              .join(' & ')
      };${
        conflictParameters.length === 0 ? '' : ' // FIXME: Conflict Parameters'
      }
export interface Response ${responseInterfaceBody}
export const requestBody = ${
        JSON.stringify(requestBody) +
        (requestBody === undefined ? '' : ' as const')
      };
export interface RequestBody ${requestBodyInterfaceBody}
`;
      return `
export namespace ${identifier(operationObject.operationId!)} {
${addIndentLevel(content)}
}`;
    })
    .join('');

/**
 *
 * @alpha
 */
export const generateOpenApiDefinition = (
  openAPIObject: OpenAPIObject,
  operations?: ReadonlyArray<string>
) => `
export namespace paths {
${addIndentLevel(generatePathsDefinition(openAPIObject.paths, operations))}
}
export namespace schemas {
${addIndentLevel(generateSchemasDefinition(openAPIObject.components?.schemas))}
}
`;
export const generateAllAPI = (
  apiDocList: ReadonlyArray<ApiDocumentWithObject>
) => `
export interface OpenApiOperationsDictionary {
${formatEntries(
  apiDocList.map(doc => ({
    key: doc.namespace,
    modifiers: ['readonly'],
    value:
      `{\n` +
      formatEntries(
        Object.values(doc.openApiObject.paths)
          .map(x => x as PathItemObject)
          .flatMap(x =>
            httpMethods
              .map(httpMethod => x[httpMethod]?.operationId)
              .filter(isNotNil)
          )
          .filter(operationId => doc.operations?.includes(operationId) ?? true)
          .map(x => identifier(x))
          .map(operationId => ({
            key: operationId,
            modifiers: ['readonly'],
            value: `{ readonly Parameter: ${doc.namespace}.paths.${operationId}.Parameter, readonly Response: ${doc.namespace}.paths.${operationId}.Response, readonly RequestBody: ${doc.namespace}.paths.${operationId}.RequestBody, readonly requestBody: typeof ${doc.namespace}.paths.${operationId}.requestBody }`,
          }))
      ) +
      '\n}',
  }))
)}
}
${apiDocList
  .map(
    doc => `
/**
* {@link ${doc.url}}
*/
export namespace ${doc.namespace} {
${addIndentLevel(generateOpenApiDefinition(doc.openApiObject, doc.operations))}
}
`
  )
  .join('\n')}  `;
