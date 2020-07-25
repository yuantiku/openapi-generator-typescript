# openapi-generator-typescript

## Getting Started

Install openapi-generator-typescript using yarn:

```sh
yarn add --dev @yuanfudao/openapi-generator-typescript
```

Then, create config file [`openapi-generator-typescript.jsonc`](./example/openapi-generator-typescript.jsonc).

- [JSONC](https://github.com/microsoft/node-jsonc-parser) is JSON with JavaScript style comments. Microsoft use it in all VSCode config files and tsconfig.json.
- We only support OpenAPI Specification Version 3 (also called swagger v3)
- The current implementation is not perfect, we only made adaptations for [springdoc](https://github.com/springdoc/springdoc-openapi)

Run `yarn openapi-generator-typescript --update`, 'api-docs/\*.json|yaml' will be created.

- You can also use `node_modules/.bin/openapi-generator-typescript` or just `openapi-generator-typescript` in npm-scripts.
- If the swagger file on the server is updated, you can run it again to synchronize the update.
- You can add doc names as params in --update. For example, `openapi-generator-typescript --update LinkExample` will only update `api-docs/link-example.yaml` from `https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v3.0/link-example.yaml`.

Run `yarn openapi-generator-typescript --generate`, 'swagger/open-api-docs.ts' will be created.

- We should track swagger json file in git and ignore generated ts file (swagger/open-api-docs.ts), add generated ts file path in git.
- If you have any questions about the generated ts file, please send us an issue.

Next, copy the [`./example/swagger/warp-http-client.ts`](./example/swagger/warp-http-client.ts) file of this repo to your `./swagger/` directory. (`warp-http-client.ts` has not stabilized and may change implementation in the future. Therefore, this file is not automatically generated temporarily.)

Then use generated result. This file needs user maintenance. Here are a few examples:

- [http-fetch](./example/swagger/http-fetch.ts) node-fetch
- [open-api-client.service](./example/swagger/open-api-client.service.ts) Angular HttpClient

Finally, you can add `openapi-generator-typescript --generate` before all needed npm-scripts such as `test`, `build`, `serve` and so on.

## TODO

- Support Multiple Response Http Status Code in `warp-http-client.ts`
- Add docs for springdoc (demos for discriminated union and enum)
- Add unit tests
