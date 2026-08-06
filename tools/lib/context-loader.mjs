import { dirname, resolve } from 'node:path';
import YAML from 'yaml';
import { containedPath, readText, readYaml } from './io.mjs';

export function parseSkillFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) throw new Error('Skill frontmatter is required');
  const metadata = YAML.parse(match[1]);
  if (!metadata || typeof metadata !== 'object') throw new Error('Skill frontmatter is invalid');
  return metadata;
}

export async function loadProgressiveContext({ metadataPath, skillPath, requestedReferenceKeys = [], reader = readText, eventSink = () => {} }) {
  const events = [];
  const emit = (event) => { events.push(event); eventSink(event); };

  const metadata = await readYaml(resolve(metadataPath));
  emit({ stage: 'metadata', path: resolve(metadataPath) });

  const skillText = await reader(resolve(skillPath));
  const skill = parseSkillFrontmatter(skillText);
  emit({ stage: 'skill', path: resolve(skillPath) });

  const declared = skill.references ?? {};
  const references = {};
  for (const key of requestedReferenceKeys) {
    if (!(key in declared)) throw new Error(`Reference not declared by Skill: ${key}`);
    const path = containedPath(dirname(resolve(skillPath)), declared[key]);
    references[key] = await reader(path);
    emit({ stage: 'reference', key, path });
  }

  return { metadata, skill, skillText, references, events };
}
