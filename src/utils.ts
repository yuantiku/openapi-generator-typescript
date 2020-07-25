export function parseUrlTemplate(urlTemplate: string) {
  const pathParams = Array.from(urlTemplate.matchAll(/\{(\w+)\}/g)).map(
    ([full, param]) => param
  );
  return {
    urlTemplate,
    urlJsTemplate: urlTemplate.replace(/\{/g, '${'),
    pathParams,
  } as const;
}
