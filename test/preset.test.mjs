import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const preset = JSON.parse(readFileSync(new URL('../default.json', import.meta.url)));
const taskManager = preset.customManagers[0];

function taskRefs(content) {
  return taskManager.matchStrings.flatMap((pattern) =>
    [...content.matchAll(new RegExp(pattern, 'g'))].map((match) => ({
      depName: match.groups.depName,
      currentValue: match.groups.currentValue,
    })));
}

function taskUrls(depName, ref) {
  return [
    `https://github.com/${depName}.git//tasks/Taskfile.yml?ref=${ref}`,
    `https://github.com/${depName}/raw/${ref}/taskfiles/base.yml`,
    `https://raw.githubusercontent.com/${depName}/${ref}/taskfiles/base.yaml`,
  ];
}

test('Remote Taskfiles preserve the repository named by each include', () => {
  for (const depName of ['Gildraen/dx', 'Gildraen/dx-tools']) {
    for (const currentValue of ['v1.2.3', '1.2.3', 'v2.3.4-rc.1+build.2']) {
      for (const url of taskUrls(depName, currentValue)) {
        for (const content of [url, `taskfile: "${url}"\n`, `taskfile: '${url}'\n`]) {
          assert.deepEqual(taskRefs(content), [{ depName, currentValue }], content);
        }
      }
    }
  }
  assert.equal(taskManager.depNameTemplate, undefined);
});

test('Remote Taskfiles ignore branches, SHA refs and unrelated repositories', () => {
  for (const ref of ['main', 'feat/component-extraction', 'abcdef123456', 'a'.repeat(40),
    'v01.2.3', 'v1.2.3-', 'v1.2.3.4']) {
    for (const url of taskUrls('Gildraen/dx-tools', ref)) {
      assert.deepEqual(taskRefs(url), [], url);
    }
  }
  for (const depName of ['Gildraen/dx-other', 'Gildraen/dx-tools-other', 'Other/dx-tools']) {
    for (const url of taskUrls(depName, 'v1.2.3')) {
      assert.deepEqual(taskRefs(url), [], url);
    }
  }
  for (const url of taskUrls('Gildraen/dx-tools', 'v1.2.3')) {
    for (const invalid of [url.replace('https://', 'http://'),
      url.replace('.com/', '.com.evil/'), `https://example.com/${url}`,
      `${url}?extra=true`, `${url}#fragment`]) {
      assert.deepEqual(taskRefs(invalid), [], invalid);
    }
  }
  for (const url of taskUrls('Gildraen/dx-tools', 'v1.2.3').slice(1)) {
    for (const invalid of [url.replace('/taskfiles/', '/other/'), `${url}.bak`,
      url.replace('/raw/', '/blob/')]) {
      if (invalid !== url) assert.deepEqual(taskRefs(invalid), [], invalid);
    }
  }
});

const featureManager = preset.customManagers[2];

function featureRefs(content) {
  return [...content.matchAll(new RegExp(featureManager.matchStrings[0], 'g'))]
    .flatMap((scope) => [...scope[0].matchAll(new RegExp(featureManager.matchStrings[1], 'g'))])
    .map((match) => ({
      depName: featureManager.depNameTemplate.replace('{{{component}}}', match.groups.component),
      currentValue: match.groups.currentValue,
    }));
}

test('Feature refs compose within DX options regardless of order', () => {
  assert.equal(featureManager.matchStringsStrategy, 'recursive');
  assert.deepEqual(featureRefs(JSON.stringify({
    features: {
      'ghcr.io/gildraen/dx/dx:1.2.0': {
        toolsRef: '1.2.3',
        agentsRef: 'v2.3.4-rc.1+build.2',
      },
      'ghcr.io/other/feature:1': { agentsRef: 'v9.9.9' },
    },
    agentsRef: 'v8.8.8',
  })), [
    { depName: 'Gildraen/dx-tools', currentValue: '1.2.3' },
    { depName: 'Gildraen/dx-agents', currentValue: 'v2.3.4-rc.1+build.2' },
  ]);
});

test('Feature refs ignore missing options, branches and SHA refs', () => {
  for (const options of [{}, { agentsRef: 'main', toolsRef: 'feat/component-extraction' },
    { agentsRef: 'a'.repeat(40), toolsRef: 'v01.2.3' }]) {
    assert.deepEqual(featureRefs(JSON.stringify({
      features: { 'ghcr.io/gildraen/dx/dx:1': options },
    })), []);
  }
});

test('MCP image extraction retains its annotation and version contract', () => {
  const match = new RegExp(preset.customManagers[1].matchStrings[0]).exec(
    '# renovate: datasource=docker depName=ghcr.io/github/github-mcp-server\n'
    + 'GITHUB_MCP_IMAGE="ghcr.io/github/github-mcp-server:v0.24.0"',
  );
  assert.equal(match?.groups.datasource, 'docker');
  assert.equal(match?.groups.depName, 'ghcr.io/github/github-mcp-server');
  assert.equal(match?.groups.currentValue, 'v0.24.0');
  assert.ok(preset.extends.includes('helpers:pinGitHubActionDigests'));
});