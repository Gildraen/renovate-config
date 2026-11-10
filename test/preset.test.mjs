import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const preset = JSON.parse(readFileSync(new URL('../default.json', import.meta.url)));

function managerFor(file) {
  return preset.customManagers.find((manager) =>
    manager.managerFilePatterns.some((pattern) => new RegExp(pattern.slice(1, -1)).test(file)));
}

const taskManager = managerFor('Taskfile.yml');
const mcpManager = managerFor('bin/dx-mcp');

test('Managers select supported files and preserve Task lookup settings', () => {
  for (const file of ['Taskfile.yml', 'Taskfile.yaml', 'nested/Taskfile.yml']) {
    assert.equal(managerFor(file), taskManager);
  }
  for (const file of ['OtherTaskfile.yml', 'Taskfile.yml.bak', 'bin/dx-mcp.bak']) {
    assert.equal(managerFor(file), undefined);
  }
  const featureManager = managerFor('.devcontainer/devcontainer.json');
  assert.ok(featureManager, 'DX Feature options manager is missing');
  for (const file of ['.devcontainer.json', '.devcontainer/devcontainer.json',
    '.devcontainer/python/devcontainer.json']) {
    assert.equal(managerFor(file), featureManager);
  }
  for (const file of ['devcontainer.json', '.devcontainer/other.json']) {
    assert.equal(managerFor(file), undefined);
  }
  assert.equal(taskManager.datasourceTemplate, 'github-tags');
  assert.equal(taskManager.versioningTemplate, 'semver');
  assert.equal(taskManager.depNameTemplate, undefined);
  assert.equal(featureManager.datasourceTemplate, 'github-tags');
  assert.equal(featureManager.versioningTemplate, 'semver');
});

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

function featureRefs(content, file) {
  const manager = managerFor(file);
  if (!manager) return [];
  const [featurePattern, refPattern] = manager.matchStrings.map((pattern) => new RegExp(pattern, 'g'));
  return [...content.matchAll(featurePattern)].flatMap((feature) =>
    [...feature[0].matchAll(refPattern)].map((match) => ({
      depName: manager.depNameTemplate.replace('{{{component}}}', match.groups.component),
      currentValue: match.groups.currentValue,
    })));
}

test('Remote Taskfiles preserve the repository named by each include', () => {
  for (const depName of ['Gildraen/dx', 'Gildraen/dx-tools']) {
    for (const currentValue of ['v1.2.3', '1.2.3', 'v2.3.4-rc.1+build.2']) {
      for (const url of taskUrls(depName, currentValue)) {
        for (const content of [
          url,
          `taskfile: "${url}"\n`,
          `taskfile: '${url}'\n`,
          `includes: {shared: ${url}}`,
          `includes: {shared: {taskfile: ${url}, optional: true}}`,
        ]) {
          assert.deepEqual(taskRefs(content), [{ depName, currentValue }], content);
        }
      }
    }
  }
});

test('Remote Taskfiles recognize multiple HTTPS includes in one mapping', () => {
  const [first] = taskUrls('Gildraen/dx', 'v1.2.3');
  const [second] = taskUrls('Gildraen/dx-tools', 'v2.3.4');
  assert.deepEqual(taskRefs(`includes: {one: ${first}, two: ${second}}`), [
    { depName: 'Gildraen/dx', currentValue: 'v1.2.3' },
    { depName: 'Gildraen/dx-tools', currentValue: 'v2.3.4' },
  ]);
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
      url.replace('https://', 'git@'),
      url.replace('.com/', '.com.evil/'), `https://example.com/${url}`,
      `https://example.com/list,${url}`,
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

test('Feature component versions are selected from standard Dev Container files', () => {
  const configuration = JSON.stringify({
    features: {
      'ghcr.io/gildraen/dx/dx:1.2.0': {
        toolsVersion: '1.2.3',
        agentsVersion: 'v2.3.4-rc.1+build.2',
      },
      'ghcr.io/other/feature:1': { agentsVersion: 'v9.9.9' },
    },
    agentsVersion: 'v8.8.8',
  });
  const expected = [
    { depName: 'Gildraen/dx-tools', currentValue: '1.2.3' },
    { depName: 'Gildraen/dx-agents', currentValue: 'v2.3.4-rc.1+build.2' },
  ];
  for (const file of ['.devcontainer.json', '.devcontainer/devcontainer.json',
    '.devcontainer/python/devcontainer.json']) {
    assert.deepEqual(featureRefs(configuration, file), expected, file);
  }
  for (const file of ['devcontainer.json', '.devcontainer/other.json']) {
    assert.deepEqual(featureRefs(configuration, file), [], file);
  }
});

test('Feature component versions ignore non-DX Features and non-SemVer values', () => {
  for (const feature of [
    { 'ghcr.io/other/feature:1': { agentsVersion: 'v1.2.3', toolsVersion: 'v1.2.3' } },
    { 'ghcr.io/gildraen/dx/dx:1': { agentsVersion: 'main', toolsVersion: 'a'.repeat(40) } },
    { 'ghcr.io/gildraen/dx/dx:1': { agentsVersion: 'v01.2.3', toolsVersion: '1.2.3-' } },
  ]) {
    assert.deepEqual(featureRefs(JSON.stringify({ features: feature }),
      '.devcontainer/devcontainer.json'), []);
  }
});

const featureDefaultsManager = preset.customManagers[3];

function featureDefaults(content) {
  let scopes = [{ content, groups: {} }];
  for (const pattern of featureDefaultsManager.matchStrings) {
    scopes = scopes.flatMap((scope) =>
      [...scope.content.matchAll(new RegExp(pattern, 'g'))].map((match) => ({
        content: match[0],
        groups: { ...scope.groups, ...match.groups },
      })));
  }
  return scopes.map(({ groups }) => ({
    depName: featureDefaultsManager.depNameTemplate.replace('{{{component}}}', groups.component),
    currentValue: groups.currentValue,
  }));
}

test('Feature manifest version defaults retain the component repository and option scope', () => {
  assert.equal(featureDefaultsManager.matchStringsStrategy, 'recursive');
  const filePattern = new RegExp(featureDefaultsManager.managerFilePatterns[0].slice(1, -1));
  assert.equal(filePattern.test('.devcontainer/src/dx/devcontainer-feature.json'), true);
  for (const path of ['.devcontainer/devcontainer.json',
    '.devcontainer/src/other/devcontainer-feature.json', 'devcontainer-feature.json']) {
    assert.equal(filePattern.test(path), false, path);
  }
  for (const options of [
    { agentsVersion: { type: 'string', default: 'v1.2.3', description: 'agents' },
      toolsVersion: { description: 'tools', default: '2.3.4-rc.1+build.2', type: 'string' } },
    { toolsVersion: { default: '2.3.4-rc.1+build.2' }, agentsVersion: { default: 'v1.2.3' } },
  ]) {
    assert.deepEqual(featureDefaults(JSON.stringify({
      options: { ...options, otherRef: { default: 'v9.9.9' } },
      agentsVersion: { default: 'v8.8.8' },
    })).sort((left, right) => left.depName.localeCompare(right.depName)), [
      { depName: 'Gildraen/dx-agents', currentValue: 'v1.2.3' },
      { depName: 'Gildraen/dx-tools', currentValue: '2.3.4-rc.1+build.2' },
    ]);
  }
});

test('Feature manifest version defaults ignore SHA pins, branches and non-default values', () => {
  for (const value of ['a'.repeat(40), 'main', 'feat/component-extraction', 'v01.2.3', 'v1.2.3-']) {
    assert.deepEqual(featureDefaults(JSON.stringify({ options: {
      agentsVersion: { default: value, description: 'v9.9.9' },
      toolsVersion: { default: value, description: 'v9.9.9' },
    } })), []);
  }
  for (const manifest of [{}, { agentsVersion: { default: 'v1.2.3' } },
    { options: { agentsVersion: { description: 'v1.2.3' }, toolsVersion: 'v2.3.4' } }]) {
    assert.deepEqual(featureDefaults(JSON.stringify(manifest)), []);
  }
});

test('MCP image extraction retains its annotation and version contract', () => {
  const match = new RegExp(mcpManager.matchStrings[0]).exec(
    '# renovate: datasource=docker depName=ghcr.io/github/github-mcp-server\n'
    + 'GITHUB_MCP_IMAGE="ghcr.io/github/github-mcp-server:v0.24.0"',
  );
  assert.equal(match?.groups.datasource, 'docker');
  assert.equal(match?.groups.depName, 'ghcr.io/github/github-mcp-server');
  assert.equal(match?.groups.currentValue, 'v0.24.0');
  assert.equal(preset['git-submodules'].enabled, true);
  assert.ok(preset.extends.includes('helpers:pinGitHubActionDigests'));
});