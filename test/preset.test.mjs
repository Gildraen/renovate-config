import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const preset = JSON.parse(readFileSync(new URL('../default.json', import.meta.url)));
const releaseConfig = JSON.parse(readFileSync(new URL('../release-please-config.json', import.meta.url)));
const releaseManifest = JSON.parse(readFileSync(new URL('../.release-please-manifest.json', import.meta.url)));
const releaseWorkflow = readFileSync(new URL('../.github/workflows/validate.yaml', import.meta.url), 'utf8');

function managerFor(file) {
    return preset.customManagers.find((manager) =>
        manager.managerFilePatterns.some((pattern) => new RegExp(pattern.slice(1, -1)).test(file)));
}

const taskManager = managerFor('Taskfile.yaml');
const mcpManager = managerFor('bin/dx-mcp');
const componentManager = managerFor('.devcontainer/src/dx/install.sh');

test('managers select supported files', () => {
    for (const file of ['Taskfile.yml', 'Taskfile.yaml', 'nested/Taskfile.yml']) {
        assert.equal(managerFor(file), taskManager);
    }
    for (const file of ['OtherTaskfile.yml', 'Taskfile.yml.bak']) {
        assert.equal(managerFor(file), undefined);
    }
    for (const file of ['install.sh', 'nested/install.sh', '.devcontainer/src/dx/install.sh']) {
        assert.equal(managerFor(file), componentManager);
    }
    for (const file of ['installer.sh', 'install.sh.bak']) assert.equal(managerFor(file), undefined);
    assert.equal(taskManager.datasourceTemplate, 'github-tags');
    assert.equal(taskManager.versioningTemplate, 'semver');
    assert.equal(taskManager.depTypeTemplate, 'github-taskfile');
    assert.equal(componentManager.datasourceTemplate, '{{{datasource}}}');
    assert.equal(componentManager.packageNameTemplate, '{{{packageName}}}');
    assert.equal(componentManager.depTypeTemplate, 'dx-component');
    assert.doesNotMatch(JSON.stringify(componentManager), /Gildraen/);
});

test('stable component rules cover both gitlinks and installer pairs', () => {
    assert.equal(preset['git-submodules'].enabled, true);
    const rule = preset.packageRules.find((candidate) =>
        candidate.matchDepNames?.includes('.devcontainer/components/agents'));
    assert.ok(rule);
    assert.deepEqual(rule.matchDepNames,
        ['.devcontainer/components/agents', '.devcontainer/components/tools']);
    assert.equal(rule.versioning, 'semver');
    assert.equal(rule.allowedVersions,
        '/^v?(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)$/');
    assert.equal(rule.groupName, 'Fixed component pins');
    const allowed = new RegExp(rule.allowedVersions.slice(1, -1));
    assert.ok(allowed.test('v1.2.3'));
    assert.ok(allowed.test('1.2.3'));
    for (const version of ['v1.2.3-rc.1', '1.2.3-rc.1', 'v1.2.3+build.1', '1.2.3+build.1', 'v01.2.3', '01.2.3']) {
        assert.ok(!allowed.test(version), `unexpectedly allowed ${version}`);
    }
    assert.equal(preset.packageRules.find((candidate) =>
        candidate.matchDepTypes?.includes('dx-component'))?.pinDigests, true);
    assert.equal(preset.packageRules.find((candidate) =>
        candidate.matchDepTypes?.includes('github-taskfile'))?.pinDigests, true);
});

test('release config uses the current baseline and unprefixed stable tags', () => {
    assert.equal(releaseConfig['include-v-in-tag'], false);
    assert.equal(releaseConfig['include-component-in-tag'], false);
    assert.equal(releaseConfig['bootstrap-sha'], '4a562942e4e7fc1bfe16e9f328893b66a6e5e160');
    assert.equal(releaseConfig.packages['.']['release-type'], 'simple');
    assert.equal(releaseConfig.packages['.']['version-file'], 'version.txt');
    assert.equal(releaseManifest['.'], '0.1.0');
    assert.equal(readFileSync(new URL('../version.txt', import.meta.url), 'utf8').trim(), releaseManifest['.']);
});

test('release workflow waits for validation on main and scopes write access', () => {
    assert.match(releaseWorkflow, /^  release:$/m);
    assert.match(releaseWorkflow, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
    assert.match(releaseWorkflow, /needs: validate/);
    assert.match(releaseWorkflow, /reusable-release-please\.yml@495bb9b377719414123af8c329b02aeff58ab440 # 0\.2\.0/);
    assert.match(releaseWorkflow, /permissions:\n      contents: read/);
    assert.match(releaseWorkflow, /expected-sha: \$\{\{ github\.sha \}\}/);
    assert.match(releaseWorkflow, /app-client-id: \$\{\{ vars\.RELEASE_PLEASE_APP_CLIENT_ID \}\}/);
    assert.match(releaseWorkflow, /app-private-key: \$\{\{ secrets\.RELEASE_PLEASE_APP_PRIVATE_KEY \}\}/);
    assert.doesNotMatch(releaseWorkflow, /googleapis\/release-please-action|RELEASE_PLEASE_TOKEN|GITHUB_TOKEN/);
});

function componentRefs(content) {
    return [...content.matchAll(new RegExp(componentManager.matchStrings[0], 'g'))]
        .map(({ groups }) => ({
            datasource: groups.datasource,
            depName: groups.depName,
            packageName: groups.packageName,
            currentValue: groups.currentValue,
            currentDigest: groups.currentDigest,
            versionPrefix: groups.versionPrefix,
            versionJoin: groups.versionJoin,
            pairSuffix: groups.pairSuffix,
        }));
}

test('generic annotations extract and replace tag/SHA pairs for arbitrary GitHub repositories', () => {
    const agentsCommit = 'a'.repeat(40);
    const toolsCommit = 'b'.repeat(40);
    const installer = [
        '# renovate: datasource=github-tags depName=.devcontainer/components/agents packageName=ExampleOrg/agents',
        'agents_version="v1.2.3"',
        `agents_commit="${agentsCommit}"`,
        '# renovate: datasource=github-tags depName=.devcontainer/components/tools packageName=AnotherOrg/tools',
        'tools_version="2.3.4"',
        `tools_commit="${toolsCommit}"`,
    ].join('\n');
    const refs = componentRefs(installer);
    assert.deepEqual(refs.map(({ datasource, depName, packageName, currentValue, currentDigest }) => ({
        datasource, depName, packageName, currentValue, currentDigest,
    })), [
        { datasource: 'github-tags', depName: '.devcontainer/components/agents', packageName: 'ExampleOrg/agents', currentValue: 'v1.2.3', currentDigest: agentsCommit },
        { datasource: 'github-tags', depName: '.devcontainer/components/tools', packageName: 'AnotherOrg/tools', currentValue: '2.3.4', currentDigest: toolsCommit },
    ]);
    const template = componentManager.autoReplaceStringTemplate;
    const updatedFromPrefixed = template
        .replace('{{{versionPrefix}}}', refs[0].versionPrefix)
        .replace('{{{newValue}}}', '1.2.4')
        .replace('{{{versionJoin}}}', refs[0].versionJoin)
        .replace('{{{newDigest}}}', 'c'.repeat(40))
        .replace('{{{pairSuffix}}}', refs[0].pairSuffix);
    assert.equal(updatedFromPrefixed, `agents_version="1.2.4"\nagents_commit="${'c'.repeat(40)}"`);
    const updatedWithoutPrefix = template
        .replace('{{{versionPrefix}}}', refs[1].versionPrefix)
        .replace('{{{newValue}}}', '2.3.5')
        .replace('{{{versionJoin}}}', refs[1].versionJoin)
        .replace('{{{newDigest}}}', 'd'.repeat(40))
        .replace('{{{pairSuffix}}}', refs[1].pairSuffix);
    assert.equal(updatedWithoutPrefix, `tools_version="2.3.5"\ntools_commit="${'d'.repeat(40)}"`);
});

test('component annotations reject prereleases, branches and invalid SHAs', () => {
    for (const [version, commit] of [
        ['v1.2.3-rc.1', 'a'.repeat(40)],
        ['1.2.3-rc.1', 'a'.repeat(40)],
        ['main', 'a'.repeat(40)],
        ['v1.2.3', 'invalid'],
        ['v01.2.3', 'a'.repeat(40)],
        ['01.2.3', 'a'.repeat(40)],
    ]) {
        const content = `# renovate: datasource=github-tags depName=components/agents packageName=ExampleOrg/agents\nagents_version="${version}"\nagents_commit="${commit}"`;
        assert.deepEqual(componentRefs(content), []);
    }
    assert.equal(managerFor('.devcontainer/devcontainer.json'), undefined);
    assert.equal(managerFor('.devcontainer/src/dx/devcontainer-feature.json'), undefined);
});

test('SHA-pinned Taskfile URLs retain a SemVer tag for Renovate', () => {
    assert.ok(taskManager.autoReplaceStringTemplate.includes('{{{newDigest}}}'));
    const digest = 'b'.repeat(40);
    const url = `https://github.com/ExampleOrg/shared-config/raw/${digest}/taskfiles/base.yml # v1.2.3`;
    const matches = taskManager.matchStrings.flatMap((pattern) => [...url.matchAll(new RegExp(pattern, 'g'))]);
    assert.deepEqual(matches.map(({ groups }) => ({
        depName: groups.depName,
        currentValue: groups.currentValue,
        currentDigest: groups.currentDigest,
    })), [{ depName: 'ExampleOrg/shared-config', currentValue: 'v1.2.3', currentDigest: digest }]);
    const groups = matches[0].groups;
    const updated = taskManager.autoReplaceStringTemplate
        .replace('{{{urlPrefix}}}', groups.urlPrefix)
        .replace('{{{newDigest}}}', 'c'.repeat(40))
        .replace('{{{fileSuffix}}}', groups.fileSuffix)
        .replace('{{{tagPrefix}}}', groups.tagPrefix)
        .replace('{{{newValue}}}', 'v1.2.4')
        .replace('{{{trailer}}}', groups.trailer);
    assert.equal(updated,
        `https://github.com/ExampleOrg/shared-config/raw/${'c'.repeat(40)}/taskfiles/base.yml # v1.2.4`);
    const unprefixedUrl = `https://github.com/ExampleOrg/shared-config/raw/${digest}/taskfiles/base.yml # 1.2.3`;
    const unprefixedMatches = taskManager.matchStrings.flatMap((pattern) => [...unprefixedUrl.matchAll(new RegExp(pattern, 'g'))]);
    assert.deepEqual(unprefixedMatches.map(({ groups }) => ({
        currentValue: groups.currentValue,
        currentDigest: groups.currentDigest,
    })), [{ currentValue: '1.2.3', currentDigest: digest }]);
    const unprefixedGroups = unprefixedMatches[0].groups;
    const unprefixedUpdated = taskManager.autoReplaceStringTemplate
        .replace('{{{urlPrefix}}}', unprefixedGroups.urlPrefix)
        .replace('{{{newDigest}}}', 'c'.repeat(40))
        .replace('{{{fileSuffix}}}', unprefixedGroups.fileSuffix)
        .replace('{{{tagPrefix}}}', unprefixedGroups.tagPrefix)
        .replace('{{{newValue}}}', '1.2.4')
        .replace('{{{trailer}}}', unprefixedGroups.trailer);
    assert.equal(unprefixedUpdated,
        `https://github.com/ExampleOrg/shared-config/raw/${'c'.repeat(40)}/taskfiles/base.yml # 1.2.4`);
    for (const invalidUrl of [
        `https://github.com/ExampleOrg/shared-config/raw/${'a'.repeat(40)}/taskfiles/base.yml`,
        'https://github.com/ExampleOrg/shared-config/raw/main/taskfiles/base.yml # v1.2.3',
        `https://github.com/ExampleOrg/shared-config/raw/${'a'.repeat(40)}/taskfiles/base.yml # main`,
        `https://github.com/ExampleOrg/shared-config/raw/${'a'.repeat(39)}/taskfiles/base.yml # v1.2.3`,
        `https://github.com/ExampleOrg/shared-config/raw/${'a'.repeat(40)}/other/base.yml # v1.2.3`,
    ]) {
        assert.deepEqual(taskManager.matchStrings.flatMap((pattern) =>
            [...invalidUrl.matchAll(new RegExp(pattern, 'g'))]), [], invalidUrl);
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
    assert.ok(preset.extends.includes('helpers:pinGitHubActionDigests'));
    assert.equal(preset['git-submodules'].enabled, true);
});
