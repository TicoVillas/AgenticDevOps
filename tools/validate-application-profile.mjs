import { resolve } from 'node:path';
import { readYaml } from './lib/io.mjs';
import { validateApplicationProfile } from './lib/profile.mjs';

const args = process.argv.slice(2);
const profilePath = resolve(args[0] ?? 'contracts/templates/application-profile.yaml');
const overrideIndex = args.indexOf('--override');
const authorizationIndex = args.indexOf('--authorization-ref');
const profile = await readYaml(profilePath);
const override = overrideIndex >= 0 ? await readYaml(resolve(args[overrideIndex + 1])) : null;
const validAuthorizationRefs = authorizationIndex >= 0 ? [args[authorizationIndex + 1]] : [];
const result = await validateApplicationProfile({ profile, override, validAuthorizationRefs });
console.log(JSON.stringify({ validator: 'validate-application-profile', profilePath, ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
