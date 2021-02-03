import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import yargs from 'yargs';
// @ts-expect-error
import { hideBin } from 'yargs/helpers';
import * as JSONC from 'jsonc-parser';
import {
  ConfigFile,
  ApiDocument,
  ApiDocumentWithObject,
} from './config-file-model';
import { generateAllAPI } from './code-generator';

function isYaml(path: string) {
  return path.endsWith('.yaml') || path.endsWith('.yml');
}

function updateApi(documents: ReadonlyArray<ApiDocument>, configDir: string) {
  return Promise.all(
    documents.map(async doc => {
      const response = await fetch(doc.url);
      const text = await response.text();

      const file = isYaml(doc.path)
        ? text
        : JSON.stringify(JSON.parse(text), null, 2);
      const targetPath = path.join(configDir, doc.path);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, file, { encoding: 'utf-8' });
    })
  );
}

async function generateTarget(config: ConfigFile, configDir: string) {
  const targetPath = path.join(configDir, config.targetFile);
  const openAPIObjectList = await Promise.all(
    config.documents.map(doc =>
      fs.promises
        .readFile(path.join(configDir, doc.path), {
          encoding: 'utf-8',
        })
        .then(
          (x): ApiDocumentWithObject => ({
            ...doc,
            openApiObject: (isYaml(doc.path) ? yaml.load : JSON.parse)(x),
          })
        )
    )
  );
  const result = generateAllAPI(openAPIObjectList);

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, result, { encoding: 'utf-8' });
}

async function getConfig(configArg: string) {
  const configPath = path.join(process.cwd(), configArg);
  const configDir = path.dirname(configPath);
  const config = JSONC.parse(
    await fs.promises.readFile(configPath, { encoding: 'utf-8' })
  ) as ConfigFile;

  return { configPath, configDir, config };
}

/**
 * @internal
 */
export async function _runCli() {
  const argv = yargs(hideBin(process.argv))
    .strict()
    .usage('$0 [options]')
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'config file',
      default: './openapi-generator-typescript.jsonc',
    })
    .option('update', {
      type: 'array',
      description: 'update api document files',
    })
    .option('generate', {
      type: 'boolean',
      description: 'generate typescript file',
    })
    .version()
    .alias('v', 'version')
    .showHelpOnFail(true, `Specify --help for available options`)
    .help(`h`)
    .alias(`h`, `help`).argv;

  if (argv.update !== undefined) {
    const { configDir, config } = await getConfig(argv.config);

    const argUpdate = argv.update.map(String);
    const docs =
      argUpdate.length === 0
        ? config.documents
        : config.documents.filter(x => argUpdate.includes(x.namespace));

    await updateApi(docs, configDir);
  }

  if (argv.generate === true) {
    const { configDir, config } = await getConfig(argv.config);
    await generateTarget(config, configDir);
  }
}
