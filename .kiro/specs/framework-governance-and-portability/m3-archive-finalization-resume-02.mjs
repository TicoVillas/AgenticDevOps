import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const workspace = '/home/villas/Projects/AgenticDevOps';
const operationId = 'archive-finalization-r01-20260802-01-resume-02';
const repository = 'TicoVillas/AgenticDevOps-History';
const repositoryUrl = `https://github.com/${repository}.git`;
const archiveRelative = 'archives/framework-governance-and-portability/archive-local-r01-20260802-01';
const executionPath = path.join(workspace, '.kiro/specs/framework-governance-and-portability/EXECUTION.md');
const runnerPath = path.join(workspace, '.kiro/specs/framework-governance-and-portability/m3-archive-finalization-resume-02.mjs');
const publishRoot = '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-finalization-r01-20260802-01-resume-02-publish';
const redownloadRoot = '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-finalization-r01-20260802-01-resume-02-redownload';
const publishCheckout = path.join(publishRoot, 'checkout');
const redownloadCheckout = path.join(redownloadRoot, 'checkout');
const publishPayload = path.join(publishCheckout, archiveRelative);
const redownloadPayload = path.join(redownloadCheckout, archiveRelative);
const priorCheckout = '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-remote-r01-20260802-01-redownload/checkout';
const priorPayload = path.join(priorCheckout, archiveRelative);
const blockedRestore = '/home/villas/Projects/AgenticDevOps-Archive-Restore/framework-governance-and-portability/archive-remote-r01-20260802-01';
const approvedRestore = '/home/villas/Projects/AgenticDevOps-Archive-Restore/framework-governance-and-portability/archive-remote-r01-20260802-01-resume-02';

const expected = {
  execution: '95bbede57932efcd26bc90a4274f0d2699e9632c6ff2733c654daab307973376',
  parentCommit: '88072578599af11d4ff53cbae8b1afab7e2adb9a',
  parentTree: '63b6413951143fc11b180cd4498184f1cf023964',
  priorInventory: '87d257b76e0694f8df84466eeac6d7c6591aa7a4c4c0fa250ca406812ba5ae22',
};

const artifactHashes = {
  'agentic-devops-framework-v3-3.0.0.historical.tgz': 'd01e4c89ec081018eec5671b0ad725a1561e8c842b4e51042583c88ae068dca8',
  'analysis-v3.tar.gz': '6e8bfc6dc006e059e99ed027231e7748cea3a3a7c2b753e5e696619198445fd5',
  'kiro-v2-3.bundle': '92b709279cc84f5bcaa132cb183fde2a348a589a4cdba404402fc2e7f181b151',
  'kiro-v2-3.tar.gz': 'fd19f58437d27f76a2eac5a736a182b9efdf32ceb771e9b4da760146e0d4e01a',
  'kiro-v2-4.tar.gz': '0cdd53ef8edaccfd96138ae5d091e546c32d8a1e6f10277166cbe05345f268ad',
};

const restoreHashes = {
  restore_inventory: '4c4f8182e0c9968634735cdf5d3293f85256114c6d103ffdaac69107f60cc6c7',
  bundle_restore_report: 'ee5b20b3778a0ea31aca64675fa10cd003bb8f4c03b47e0f6bd6a1c4b220255c',
  snapshot_comparison: '4d8e3a216497c2ee893f9ac5c6b061547a590b49c124a70992821aa925d72c98',
  opaque_restore_report: '674194af8a9bb4acb7e51c3db738d3a1d7e006e2a904c3f9e44300c7407d675c',
  restore_summary: 'a704836c904e8b70cd0cdc083df073c184851d2ba171c4f38880e4c729aa4d2c',
  restore_evidence_index: '80c3b27ec528b9738b094e01b710f0a624c6fcc16d00b832e60d05a5ed53007f',
};

const state = {
  phase: 'START',
  remoteCalls: 0,
  publicationStagingCreated: false,
  redownloadStagingCreated: false,
  commitCreated: false,
  pushAttempted: false,
  pushSucceeded: false,
  finalCommit: null,
  finalTree: null,
  finalInventory: null,
  retention: null,
  evidenceIndex: null,
};

process.chdir(workspace);
process.umask(0o077);

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function run(command, args, { cwd = workspace, env = process.env, inherit = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const detail = inherit ? '' : String(result.stderr ?? '').trim().slice(0, 2000);
    throw new Error(`COMMAND_FAILED:${command}:${result.status}:${detail}`);
  }
  return inherit ? '' : String(result.stdout ?? '').trim();
}

function gh(args) {
  state.remoteCalls += 1;
  return run('gh', args, { env: { ...process.env, GH_HOST: 'github.com' } });
}

function git(args, cwd) {
  return run('git', args, { cwd });
}

function remoteGit(args, cwd) {
  state.remoteCalls += 1;
  return run('git', [
    '-c', 'credential.helper=',
    '-c', 'credential.helper=!gh auth git-credential',
    ...args,
  ], { cwd, env: { ...process.env, GH_HOST: 'github.com' } });
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function assertHash(file, wanted) {
  const actual = sha256File(file);
  assert(actual === wanted, `HASH_MISMATCH:${file}:${actual}`);
}

function assertMode700(directory) {
  const stat = fs.lstatSync(directory);
  assert(stat.isDirectory() && (stat.mode & 0o777) === 0o700, `ROOT_INVALID:${directory}`);
}

function writeJson(file, value, { replace = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    flag: replace ? 'w' : 'wx',
  });
}

function walkFiles(root) {
  const files = [];
  let directories = 0;
  const visit = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => Buffer.from(a.name).compare(Buffer.from(b.name)));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolute);
      assert(!stat.isSymbolicLink(), `SYMLINK_UNEXPECTED:${absolute}`);
      if (stat.isDirectory()) {
        directories += 1;
        visit(absolute);
      } else {
        assert(stat.isFile(), `SPECIAL_TYPE_UNEXPECTED:${absolute}`);
        files.push(path.relative(root, absolute).split(path.sep).join('/'));
      }
    }
  };
  visit(root);
  return { files, directories };
}

function verifyBindings({ includeExecution }) {
  const bindings = {
    '.kiro/specs/framework-governance-and-portability/discovery.md': 'd9b40cdcab92dd01bea55918beff7ceb8e164a49b455471fa6a54f5d8ef0be77',
    '.kiro/specs/framework-governance-and-portability/requirements.md': 'fe83db42aa19de992ceb90291d5db4caa69fcbf35e315e9d1fc1692ff4598aa2',
    '.kiro/specs/framework-governance-and-portability/design.md': '46532b9e7e43ff7626bbedc1e040dbf6af1e343502b99b5242d52e31146cd056',
    '.kiro/specs/framework-governance-and-portability/tasks.md': '3e18e3d22902bf96befa9440f354fd21690bb0828de4a9b69c9514db6b45797c',
    '.kiro/specs/framework-governance-and-portability/execution-brief.md': 'a3a0381107a3b529e35948609ed2b47034f7c82330c826ba5e82d5acc1a21d95',
    '.kiro/specs/framework-governance-and-portability/contract-review.md': '8521e2d409bae8a0d8b10e2fce4c90d15fba0a9c413dba8dad7919ec6a894b57',
    'framework/framework.lock': '25d3087f756ac5d709403b49d89d49c2f3f42c39f3a3348b09334f3d8a22f252',
    'framework/adapters/kiro/distribution-manifest.yaml': '53bd26cbdd49cad76df11a8806c89ec5682db5f4a89ff1b41258d008d5aa5354',
    'framework/package-lock.json': '3a5a335b5c5250443608441eeb45353793e1a58393515e14e975d70de6e58846',
    'framework/package.json': 'b784e50d7ccdd8086d7dc45851de11f5b72d5ff8ab4c14d7d89c321b556bae1f',
    'framework/tools/lib/archive.mjs': '62ced5934d8bd00bb730a7f1026cec9fe10252e0638a0d56ff69de80be6c6bb5',
    'framework/tools/lib/archive-restore.mjs': '24e65d43d334f825390a17bcacc21e5d146132ca71fa28e8aa2a7047e1dc9b4f',
    'framework/tools/archive-restore.mjs': '2616a3a3b5c91076c2e7029107d89d19866eb82f744bf77e8b5c8ca8b573026d',
    'framework/tests/archive/archive-restore.test.mjs': '923195642a94642b65d8174600c2d24cca724285d177957e4cd39e020c7c75c0',
  };
  if (includeExecution) bindings[executionPath] = expected.execution;
  for (const [file, wanted] of Object.entries(bindings)) assertHash(file, wanted);
}

function verifyNoWriter() {
  const excluded = new Set();
  let pid = process.pid;
  while (pid > 1) {
    excluded.add(pid);
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    } catch { break; }
  }
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name) || excluded.has(Number(name))) continue;
    try {
      const command = fs.readFileSync(`/proc/${name}/cmdline`).toString().replaceAll('\0', ' ');
      assert(!/(?:archive:restore|archive:build|git push.*AgenticDevOps-History)/i.test(command), `CONCURRENT_WRITER:${name}`);
    } catch (error) {
      if (error.message?.startsWith('CONCURRENT_WRITER:')) throw error;
    }
  }
}

function verifyRoots({ requireNewAbsent }) {
  const roots = [
    '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-local-r01-20260802-01',
    '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-remote-r01-20260802-01-publish',
    '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-remote-r01-20260802-01-redownload',
    blockedRestore,
    approvedRestore,
  ];
  roots.forEach(assertMode700);
  if (requireNewAbsent) {
    const absent = [
      '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-finalization-r01-20260802-01-publish',
      '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-finalization-r01-20260802-01-redownload',
      '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-finalization-r01-20260802-01-resume-01-publish',
      '/home/villas/Projects/AgenticDevOps-Archive-Staging/framework-governance-and-portability/archive-finalization-r01-20260802-01-resume-01-redownload',
      publishRoot,
      redownloadRoot,
    ];
    for (const item of absent) assert(!fs.existsSync(item), `PARTIAL_STAGING_PRESENT:${item}`);
  }
  const blockedNames = fs.readdirSync(blockedRestore).sort();
  assert(JSON.stringify(blockedNames) === JSON.stringify(['bundle', 'evidence', 'manifests', 'opaque', 'reports', 'snapshots']), 'BLOCKED_RESTORE_ROOT_CHANGED');
  for (const name of blockedNames) {
    const directory = path.join(blockedRestore, name);
    assertMode700(directory);
    assert(fs.readdirSync(directory).length === 0, `BLOCKED_RESTORE_NOT_EMPTY:${name}`);
  }
  const shape = walkFiles(approvedRestore);
  assert(shape.files.length === 161 && shape.directories === 82, `APPROVED_RESTORE_SHAPE:${shape.files.length}:${shape.directories}`);
  const evidence = {
    'manifests/restore-inventory.json': restoreHashes.restore_inventory,
    'reports/bundle-restore.json': restoreHashes.bundle_restore_report,
    'reports/snapshot-comparison.json': restoreHashes.snapshot_comparison,
    'reports/opaque-restore.json': restoreHashes.opaque_restore_report,
    'reports/restore-summary.json': restoreHashes.restore_summary,
    'evidence/evidence-index.json': restoreHashes.restore_evidence_index,
  };
  for (const [relative, wanted] of Object.entries(evidence)) assertHash(path.join(approvedRestore, relative), wanted);
}

function verifyPriorPayload() {
  const inventoryPath = path.join(priorPayload, 'manifests/remote-content-inventory.json');
  assertHash(inventoryPath, expected.priorInventory);
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  assert(inventory.file_count_excluding_self === 18 && inventory.files.length === 18, 'PRIOR_INVENTORY_COUNT');
  for (const entry of inventory.files) {
    const absolute = path.join(priorCheckout, entry.path);
    const stat = fs.lstatSync(absolute);
    assert(stat.isFile() && stat.size === entry.size && sha256File(absolute) === entry.sha256, `PRIOR_FILE_DIVERGED:${entry.path}`);
  }
  assert(walkFiles(priorPayload).files.length === 19, 'PRIOR_PAYLOAD_COUNT');
  for (const [name, wanted] of Object.entries(artifactHashes)) assertHash(path.join(priorPayload, 'artifacts', name), wanted);
  assert(git(['rev-parse', 'HEAD'], priorCheckout) === expected.parentCommit, 'PRIOR_CHECKOUT_COMMIT');
  assert(git(['rev-parse', 'HEAD^{tree}'], priorCheckout) === expected.parentTree, 'PRIOR_CHECKOUT_TREE');
  assert(git(['status', '--porcelain'], priorCheckout) === '', 'PRIOR_CHECKOUT_DIRTY');
  const detached = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: priorCheckout, encoding: 'utf8' });
  assert(detached.status === 1 && detached.stdout === '', 'PRIOR_CHECKOUT_NOT_DETACHED');
  return inventory;
}

async function verifySources() {
  const module = await import(pathToFileURL(path.join(workspace, 'framework/tools/lib/archive.mjs')).href);
  const definitions = [
    ['kiro-v2-3', 'Kiro_v2_3_source', 'DIRECTORY', undefined, module.TRUST_VERIFIED, 59, 'fc3f9c4fe3f7bc2a95699cff1bdc2c8622620b5d30d5bfe20916a9ff979415c8'],
    ['kiro-v2-4', 'Kiro_v2_4_source', 'DIRECTORY', undefined, module.TRUST_VERIFIED, 30, '95afca7e685652b64145301d56e79b902955f948b1fea3601a03bc09180b4346'],
    ['analysis-v3', 'Analise_Workflow_v3.0.md', 'FILE', 'Analise_Workflow_v3.0.md', module.TRUST_VERIFIED, 1, '8f40b617c8727936755541754b15922f4c83f0b919c1f1073a23aa7d23c09829'],
    ['historical-tgz', 'framework/agentic-devops-framework-v3-3.0.0.tgz', 'FILE', 'agentic-devops-framework-v3-3.0.0.tgz', module.TRUST_HISTORICAL, 1, '284d745a9fe5202352eadc1f2a40f5a11a2bf2ecc537740893015dcbb3c4f385'],
  ];
  for (const [id, relative, sourceKind, logicalName, trustLabel, count, wanted] of definitions) {
    const inventory = await module.inventorySource({ id, root: path.join(workspace, relative), sourceKind, logicalName, trustLabel, capturedAt: '2026-08-04T00:00:00Z' });
    assert(inventory.file_count === count && inventory.snapshot_sha256 === wanted, `SOURCE_DIVERGED:${id}`);
  }
  const v23 = path.join(workspace, 'Kiro_v2_3_source');
  assert(git(['rev-parse', 'HEAD'], v23) === 'd0a1ad58eaed78ffcb5f7b085831d99dfa845f4b', 'V23_HEAD');
  assert(git(['status', '--porcelain'], v23) === '', 'V23_DIRTY');
  git(['fsck', '--full', '--strict'], v23);
}

function remotePreflight() {
  assert(process.env.GH_TOKEN, 'GH_TOKEN_ABSENT');
  assert(process.env.GH_TOKEN.startsWith('github_pat_'), 'GH_TOKEN_NOT_FINE_GRAINED');
  console.log(`PROCESS_BOUNDARY_OK runner_pid=${process.pid} token_present=true`);
  assert(gh(['api', 'user', '--jq', '.login']) === 'TicoVillas', 'IDENTITY_MISMATCH');
  const headers = gh(['api', '-i', 'user']);
  const scopes = headers.match(/^x-oauth-scopes:\s*(.*)$/im);
  assert(!scopes || scopes[1].trim() === '', 'CLASSIC_OR_EXCESSIVE_OAUTH_SCOPES');
  const repo = JSON.parse(gh(['api', `repos/${repository}`]));
  assert(repo.owner?.login === 'TicoVillas' && repo.name === 'AgenticDevOps-History' && repo.visibility === 'private' && repo.default_branch === 'main' && !repo.archived && !repo.disabled, 'REPOSITORY_BINDING');
  assert(repo.permissions?.push && repo.permissions?.pull, 'REPOSITORY_ACCESS_BOUNDARY');
  const branches = JSON.parse(gh(['api', `repos/${repository}/branches`, '--paginate']));
  assert(branches.length === 1 && branches[0].name === 'main', 'BRANCH_SET');
  assert(JSON.parse(gh(['api', `repos/${repository}/tags`, '--paginate'])).length === 0, 'TAGS_PRESENT');
  assert(JSON.parse(gh(['api', `repos/${repository}/releases`, '--paginate'])).length === 0, 'RELEASES_PRESENT');
  const commit = JSON.parse(gh(['api', `repos/${repository}/git/commits/${expected.parentCommit}`]));
  assert(commit.sha === expected.parentCommit && commit.tree?.sha === expected.parentTree && commit.parents?.length === 0, 'PARENT_BINDING');
  assert(JSON.parse(gh(['api', `repos/${repository}/commits/main`])).sha === expected.parentCommit, 'MAIN_HEAD');
  const tree = JSON.parse(gh(['api', `repos/${repository}/git/trees/${expected.parentTree}?recursive=1`]));
  assert(!tree.truncated && tree.tree.filter((entry) => entry.type === 'blob').length === 19, 'PARENT_TREE');
  assert(remoteGit(['ls-remote', repositoryUrl, 'refs/heads/main'], workspace) === `${expected.parentCommit}\trefs/heads/main`, 'REMOTE_GIT_HEAD');
}

function buildPayload(priorInventory) {
  const retentionPath = 'retention/indefinite-retention.json';
  const checkpointPath = 'manifests/m3-checkpoint-bindings.json';
  const restorePath = 'evidence/approved-restore-summary.json';
  const guardPath = 'evidence/m3-final-operations-not-authorized.json';
  const sumsPath = 'checksums/finalization-SHA256SUMS';
  const indexPath = 'evidence/m3-final-evidence-index.json';
  const inventoryPath = 'manifests/remote-content-inventory.json';
  const retention = {
    schema_version: 1,
    record_type: 'INDEFINITE_HISTORICAL_RETENTION',
    operation_id: operationId,
    status: 'ACTIVE',
    repository,
    archive_root: archiveRelative,
    policy: {
      preservation_duration: 'INDEFINITE',
      automatic_deletion: false,
      expiration_by_age: false,
      removal_requires_future_specific_authorization: true,
      prior_commits_are_permanent_provenance: true,
      local_cleanup_authorized: false,
      historical_tgz: {
        path: 'artifacts/agentic-devops-framework-v3-3.0.0.historical.tgz',
        trust_label: 'HISTORICAL_UNTRUSTED_EVIDENCE',
        preserve_opaque: true,
        extraction_authorized: false,
      },
    },
    effective_at: 'COMMIT_CONTAINING_THIS_RECORD',
  };
  const checkpoints = {
    schema_version: 1,
    operation_id: operationId,
    checkpoints: {
      ARCHIVE_LOCAL: { status: 'APPROVED', archive_provenance_sha256: '3774391e93536fb382c6d734b28a11faba8beb3dd3f70c7fae713bcf79d4757c', evidence_index_sha256: '535f72b18320fd9157633fbacb10f773742ae96d58a4792b7b6b7aa8ba8df0a3' },
      ARCHIVE_REMOTE: { status: 'APPROVED', commit: expected.parentCommit, tree: expected.parentTree, inventory_sha256: expected.priorInventory },
      ARCHIVE_RESTORE: { status: 'APPROVED', operation_id: 'archive-restore-r01-20260802-01-resume-02', ...restoreHashes },
    },
    milestone_state: { 'M3.1-M3.4': 'COMPLETED', 'M3.6-M3.7': 'COMPLETED', 'M3.8': 'COMPLETED', 'M3.9': 'FINALIZATION_COMMIT' },
    implementation_bindings: {
      framework_lock: '25d3087f756ac5d709403b49d89d49c2f3f42c39f3a3348b09334f3d8a22f252',
      distribution_manifest: '53bd26cbdd49cad76df11a8806c89ec5682db5f4a89ff1b41258d008d5aa5354',
      tasks: '3e18e3d22902bf96befa9440f354fd21690bb0828de4a9b69c9514db6b45797c',
    },
  };
  const restore = {
    schema_version: 1,
    record_type: 'APPROVED_RESTORE_SUMMARY',
    operation_id: 'archive-restore-r01-20260802-01-resume-02',
    approval_status: 'APPROVED',
    result: 'CHECKPOINT_ARCHIVE_RESTORE',
    source_remote_commit: expected.parentCommit,
    source_remote_tree: expected.parentTree,
    historical_head: 'd0a1ad58eaed78ffcb5f7b085831d99dfa845f4b',
    bundle: { complete_history: true, expected_refs: 4, fsck_strict: 'PASS', objects: 151 },
    restored_sets: { bundle_worktree_files: 32, snapshot_v2_3_files: 59, snapshot_v2_4_files: 30, snapshot_analysis_v3_files: 1, opaque_artifacts: 1 },
    trust: { historical_tgz: 'HISTORICAL_UNTRUSTED_EVIDENCE', extracted: false, executed: false, recompressed: false },
    evidence_sha256: restoreHashes,
    absolute_paths_published: false,
    restored_content_published: false,
    restored_git_published: false,
  };
  const operations = [
    'REPEAT_M3.1_THROUGH_M3.8', 'PERSIST_CREDENTIAL', 'USE_KEYRING_CREDENTIAL',
    'SECOND_COMMIT_OR_PUSH', 'REBASE_AMEND_OR_FORCE_PUSH', 'ADDITIONAL_BRANCH_TAG_OR_RELEASE',
    'VISIBILITY_PERMISSION_RULESET_ENVIRONMENT_VARIABLE_OR_SECRET_CHANGE', 'ANY_OTHER_REPOSITORY',
    'HISTORICAL_ARTIFACT_CHANGE', 'SOURCE_OR_IMPLEMENTATION_CHANGE',
    'EXISTING_ROOT_OR_STAGING_CHANGE_OR_REMOVAL', 'CLEANUP', 'M4_THROUGH_M15', 'DELIVERY_VALIDATION',
  ];
  const guard = { schema_version: 1, operation_id: operationId, operations_not_authorized: operations };
  writeJson(path.join(publishPayload, retentionPath), retention);
  writeJson(path.join(publishPayload, checkpointPath), checkpoints);
  writeJson(path.join(publishPayload, restorePath), restore);
  writeJson(path.join(publishPayload, guardPath), guard);
  const checksumInputs = [retentionPath, checkpointPath, restorePath, guardPath].sort();
  const sums = `${checksumInputs.map((relative) => `${sha256File(path.join(publishPayload, relative))}  ${relative}`).join('\n')}\n`;
  fs.mkdirSync(path.dirname(path.join(publishPayload, sumsPath)), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(publishPayload, sumsPath), sums, { mode: 0o600, flag: 'wx' });
  const evidenceIndex = {
    schema_version: 1,
    record_type: 'M3_FINAL_EVIDENCE_INDEX',
    operation_id: operationId,
    generated_at: new Date().toISOString(),
    result: 'M3_COMPLETED_AFTER_REQUIRED_POST_PUBLICATION_VERIFICATION',
    repository,
    parent_commit: expected.parentCommit,
    milestone_state: { 'M3.1-M3.4': 'COMPLETED', ARCHIVE_LOCAL: 'APPROVED', 'M3.6-M3.7': 'COMPLETED', ARCHIVE_REMOTE: 'APPROVED', 'M3.8': 'COMPLETED', ARCHIVE_RESTORE: 'APPROVED', 'M3.9': 'COMPLETED_BY_FINALIZATION_COMMIT' },
    records: [retentionPath, checkpointPath, restorePath, guardPath, sumsPath].map((relative) => ({ path: relative, size: fs.statSync(path.join(publishPayload, relative)).size, sha256: sha256File(path.join(publishPayload, relative)) })),
    prior_archive_evidence: { archive_provenance_manifest: '3774391e93536fb382c6d734b28a11faba8beb3dd3f70c7fae713bcf79d4757c', local_evidence_index: '535f72b18320fd9157633fbacb10f773742ae96d58a4792b7b6b7aa8ba8df0a3', prior_remote_inventory: expected.priorInventory },
    approved_restore_evidence: { operation_id: 'archive-restore-r01-20260802-01-resume-02', ...restoreHashes },
    historical_artifacts: Object.entries(artifactHashes).sort(([a], [b]) => Buffer.from(a).compare(Buffer.from(b))).map(([name, sha256]) => ({ path: `artifacts/${name}`, sha256 })),
    verification_contract: { exact_commit_redownload_required: true, byte_identical_comparison_required: true, artifact_immutability_required: true, implementation_immutability_required: true, source_immutability_required: true },
  };
  writeJson(path.join(publishPayload, indexPath), evidenceIndex);
  const priorInventoryFile = path.join(publishPayload, inventoryPath);
  assertHash(priorInventoryFile, expected.priorInventory);
  for (const entry of priorInventory.files) {
    const absolute = path.join(publishCheckout, entry.path);
    assert(fs.statSync(absolute).size === entry.size && sha256File(absolute) === entry.sha256, `PREEXISTING_FILE_CHANGED:${entry.path}`);
  }
  const files = walkFiles(publishPayload).files.filter((relative) => relative !== inventoryPath);
  assert(files.length === 24, `FINAL_COUNT_WITHOUT_INVENTORY:${files.length}`);
  const inventory = {
    schema_version: 1,
    operation_id: operationId,
    algorithm: 'sha256',
    manifest_excluded_from_own_hash: true,
    file_count_excluding_self: 24,
    files: files.map((relative) => ({ path: `${archiveRelative}/${relative}`, sha256: sha256File(path.join(publishPayload, relative)), size: fs.statSync(path.join(publishPayload, relative)).size })),
  };
  writeJson(priorInventoryFile, inventory, { replace: true });
  assert(walkFiles(publishPayload).files.length === 25, 'FINAL_PAYLOAD_COUNT');
  const newText = [retentionPath, checkpointPath, restorePath, guardPath, sumsPath, indexPath, inventoryPath];
  const forbidden = /(?:\/home\/|github_pat_|gh[pousr]_|BEGIN [A-Z ]*PRIVATE KEY)/;
  for (const relative of newText) assert(!forbidden.test(fs.readFileSync(path.join(publishPayload, relative), 'utf8')), `UNSANITIZED:${relative}`);
  for (const [name, wanted] of Object.entries(artifactHashes)) assertHash(path.join(publishPayload, 'artifacts', name), wanted);
  state.retention = sha256File(path.join(publishPayload, retentionPath));
  state.evidenceIndex = sha256File(path.join(publishPayload, indexPath));
  state.finalInventory = sha256File(priorInventoryFile);
  return { inventory, operations, paths: { retentionPath, checkpointPath, restorePath, guardPath, sumsPath, indexPath, inventoryPath } };
}

function verifyFinalRemote() {
  const repo = JSON.parse(gh(['api', `repos/${repository}`]));
  assert(repo.visibility === 'private' && repo.default_branch === 'main', 'FINAL_REPOSITORY_STATE');
  assert(JSON.parse(gh(['api', `repos/${repository}/commits/main`])).sha === state.finalCommit, 'FINAL_REMOTE_HEAD');
  const commit = JSON.parse(gh(['api', `repos/${repository}/git/commits/${state.finalCommit}`]));
  assert(commit.sha === state.finalCommit && commit.tree?.sha === state.finalTree && commit.parents?.length === 1 && commit.parents[0].sha === expected.parentCommit, 'FINAL_COMMIT_BINDING');
  const branches = JSON.parse(gh(['api', `repos/${repository}/branches`, '--paginate']));
  assert(branches.length === 1 && branches[0].name === 'main', 'FINAL_BRANCH_SET');
  assert(JSON.parse(gh(['api', `repos/${repository}/tags`, '--paginate'])).length === 0, 'FINAL_TAG_SET');
  assert(JSON.parse(gh(['api', `repos/${repository}/releases`, '--paginate'])).length === 0, 'FINAL_RELEASE_SET');
  const tree = JSON.parse(gh(['api', `repos/${repository}/git/trees/${state.finalTree}?recursive=1`]));
  assert(!tree.truncated && tree.tree.filter((entry) => entry.type === 'blob').length === 25, 'FINAL_TREE_COUNT');
}

function verifyChecksumFile(file, root) {
  for (const line of fs.readFileSync(file, 'utf8').trim().split('\n')) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert(match, `INVALID_CHECKSUM_LINE:${line}`);
    const absolute = path.resolve(root, match[2]);
    assert(absolute.startsWith(`${root}${path.sep}`), `CHECKSUM_ESCAPE:${match[2]}`);
    assertHash(absolute, match[1]);
  }
}

function verifyRedownload(payload) {
  const publication = walkFiles(publishPayload).files;
  const redownload = walkFiles(redownloadPayload).files;
  assert(publication.length === 25 && JSON.stringify(publication) === JSON.stringify(redownload), 'REDOWNLOAD_FILE_SET');
  for (const relative of publication) {
    const left = path.join(publishPayload, relative);
    const right = path.join(redownloadPayload, relative);
    assert(fs.statSync(left).size === fs.statSync(right).size && sha256File(left) === sha256File(right), `REDOWNLOAD_DIVERGED:${relative}`);
  }
  const inventoryFile = path.join(redownloadPayload, payload.paths.inventoryPath);
  assertHash(inventoryFile, state.finalInventory);
  const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  assert(JSON.stringify(inventory) === JSON.stringify(payload.inventory), 'REDOWNLOAD_INVENTORY');
  for (const entry of inventory.files) {
    const absolute = path.join(redownloadCheckout, entry.path);
    assert(fs.statSync(absolute).size === entry.size && sha256File(absolute) === entry.sha256, `REDOWNLOAD_INVENTORY_ENTRY:${entry.path}`);
  }
  for (const [name, wanted] of Object.entries(artifactHashes)) assertHash(path.join(redownloadPayload, 'artifacts', name), wanted);
  verifyChecksumFile(path.join(redownloadPayload, 'checksums/SHA256SUMS'), redownloadPayload);
  verifyChecksumFile(path.join(redownloadPayload, payload.paths.sumsPath), redownloadPayload);
  const retention = JSON.parse(fs.readFileSync(path.join(redownloadPayload, payload.paths.retentionPath), 'utf8'));
  assert(retention.policy?.preservation_duration === 'INDEFINITE' && retention.policy?.automatic_deletion === false && retention.policy?.expiration_by_age === false && retention.policy?.removal_requires_future_specific_authorization === true && retention.policy?.prior_commits_are_permanent_provenance === true && retention.policy?.local_cleanup_authorized === false && retention.policy?.historical_tgz?.trust_label === 'HISTORICAL_UNTRUSTED_EVIDENCE', 'RETENTION_SEMANTICS');
  const evidence = JSON.parse(fs.readFileSync(path.join(redownloadPayload, payload.paths.indexPath), 'utf8'));
  assert(evidence.approved_restore_evidence?.operation_id === 'archive-restore-r01-20260802-01-resume-02', 'RESTORE_OPERATION_BINDING');
  for (const [name, wanted] of Object.entries(restoreHashes)) assert(evidence.approved_restore_evidence?.[name] === wanted, `RESTORE_HASH_BINDING:${name}`);
  assertHash(path.join(redownloadPayload, payload.paths.retentionPath), state.retention);
  assertHash(path.join(redownloadPayload, payload.paths.indexPath), state.evidenceIndex);
}

function appendFailure(error) {
  const status = state.pushSucceeded ? 'PARTIAL' : 'BLOCKED';
  const reason = String(error.message).replaceAll('\n', ' ').slice(0, 300);
  const record = `\n\n### M3.9 resume-02 runner result — ${status}\n\n\`\`\`yaml\nstatus: ${status}\nphase: execute-contract/m3-archive-finalization/round-01/resume-02\noperation_id: ${operationId}\nfailed_phase: ${state.phase}\nreason_code: ${reason}\nremote_calls: ${state.remoteCalls}\npublication_staging_created: ${state.publicationStagingCreated}\nredownload_staging_created: ${state.redownloadStagingCreated}\ncommit_created: ${state.commitCreated}\npush_attempted: ${state.pushAttempted}\npush_succeeded: ${state.pushSucceeded}\nfinal_commit: ${state.finalCommit ?? 'NOT_CREATED'}\nfinal_tree: ${state.finalTree ?? 'NOT_CREATED'}\nM3.9: NOT_COMPLETED\nM3: NOT_COMPLETED\nM4-M15: NOT_STARTED\ndelivery_validation: NOT_STARTED\n\`\`\`\n\nThe process-local credential was removed by the runner finalizer. No retry, second push, cleanup, M4+, or Delivery Validation is inferred.\n`;
  try { fs.appendFileSync(executionPath, record, 'utf8'); } catch { /* preserve original failure */ }
}

function appendSuccess(payload, runnerHash) {
  const inventoryRows = payload.inventory.files.map((entry) => `| \`${entry.path}\` | ${entry.size} | \`${entry.sha256}\` |`).join('\n');
  const inventorySelf = fs.statSync(path.join(redownloadPayload, payload.paths.inventoryPath)).size;
  const evidence = `\n\n---\n\n# Execution Evidence — M3.9 Archive Finalization Round 01 Resume 02\n\n\`\`\`yaml\nversion: 1\ntype: EVIDENCE\nstatus: COMPLETED\nmetadata:\n  project: AgenticDevOps\n  slug: framework-governance-and-portability\n  phase: execute-contract/m3-archive-finalization/round-01/resume-02\n  role: ENGINEERING\n  overlay: HighRiskOverlay\n  session: sess_04e851e5-483e-4521-a586-ea3e096e5723\n  operation_id: ${operationId}\nselection:\n  family: Codex\n  model: GPT-5.6 Sol\n  effort: High\n  agent_workflow: Kiro Default\n  mode: Supervised\n  alternative_used: false\n  comparison_result: MATCH\nresult: COMPLETED\nM3: COMPLETED\nM4-M15: NOT_STARTED\ndelivery_validation: NOT_STARTED\n\`\`\`\n\n## Final remote binding\n\n| Binding | Value |\n|---|---|\n| Repository | \`${repository}\` |\n| Visibility | \`PRIVATE\` |\n| Branch | \`main\` |\n| Commit | \`${state.finalCommit}\` |\n| Tree | \`${state.finalTree}\` |\n| Parent | \`${expected.parentCommit}\` |\n| Files | 25 |\n| Branches | one: \`main\` |\n| Tags/releases | none |\n\nExactly one child commit and one normal push were performed. The exact-commit redownload fetch was the final remote operation.\n\n## Final records\n\n| Record | SHA-256 |\n|---|---|\n| retention record | \`${state.retention}\` |\n| M3 final evidence index | \`${state.evidenceIndex}\` |\n| remote inventory | \`${state.finalInventory}\` |\n| local no-secret runner | \`${runnerHash}\` |\n\nThe retention record establishes indefinite preservation, no automatic deletion, no age expiration, future specific authorization for removal, permanent prior-commit provenance, opaque TGZ trust \`HISTORICAL_UNTRUSTED_EVIDENCE\`, and no local-cleanup authority. The approved restore evidence remains bound to operation \`archive-restore-r01-20260802-01-resume-02\` and all required restore hashes.\n\n## Final remote inventory\n\nThe inventory excludes itself internally to avoid recursive self-hashing.\n\n| Path | Bytes | SHA-256 |\n|---|---:|---|\n${inventoryRows}\n| \`${archiveRelative}/${payload.paths.inventoryPath}\` | ${inventorySelf} | \`${state.finalInventory}\` |\n\n## Verification\n\n- publication versus exact-commit redownload: byte-identical, 25/25 files;\n- five historical artifacts: byte-identical;\n- retention and final evidence index: present and semantically verified;\n- restore evidence: all required hashes exact;\n- redownload \`git fsck --full --strict\`: PASS;\n- \`npm run validate\`: exit 0;\n- historical sources and implementation bindings: unchanged;\n- blocked and approved restore roots plus earlier stagings: preserved;\n- no absolute path, restored content, restored \`.git\`, token, operational state, runner, or temporary file was published.\n\n## Operations not authorized or performed\n\n\`\`\`yaml\noperations_not_authorized:\n${payload.operations.map((item) => `  - ${item}`).join('\n')}\n\`\`\`\n\nM3 is complete. Execution stops without chaining to M4.\n`;
  fs.appendFileSync(executionPath, evidence, 'utf8');
}

async function execute() {
  state.phase = 'LOCAL_PREFLIGHT';
  assert(process.env.GH_TOKEN, 'GH_TOKEN_ABSENT');
  assert(process.env.GH_TOKEN.startsWith('github_pat_'), 'GH_TOKEN_NOT_FINE_GRAINED');
  verifyBindings({ includeExecution: true });
  verifyNoWriter();
  verifyRoots({ requireNewAbsent: true });
  const priorInventory = verifyPriorPayload();
  await verifySources();
  console.log('LOCAL_PREFLIGHT_OK');

  state.phase = 'REMOTE_PREFLIGHT';
  remotePreflight();
  console.log('REMOTE_PREFLIGHT_OK');

  state.phase = 'PUBLICATION_STAGING';
  fs.mkdirSync(publishRoot, { mode: 0o700 });
  state.publicationStagingCreated = true;
  assertMode700(publishRoot);
  git(['init', '--quiet', '--initial-branch=main', publishCheckout], workspace);
  git(['remote', 'add', 'origin', repositoryUrl], publishCheckout);
  remoteGit(['fetch', '--no-tags', 'origin', 'refs/heads/main'], publishCheckout);
  assert(git(['rev-parse', 'FETCH_HEAD'], publishCheckout) === expected.parentCommit, 'PUBLICATION_FETCH');
  git(['checkout', '--quiet', '-B', 'main', 'FETCH_HEAD'], publishCheckout);
  assert(git(['rev-parse', 'HEAD'], publishCheckout) === expected.parentCommit && git(['rev-parse', 'HEAD^{tree}'], publishCheckout) === expected.parentTree, 'PUBLICATION_PARENT');

  state.phase = 'PAYLOAD_BUILD';
  const payload = buildPayload(priorInventory);
  const staged = [payload.paths.sumsPath, payload.paths.restorePath, payload.paths.indexPath, payload.paths.guardPath, payload.paths.checkpointPath, payload.paths.inventoryPath, payload.paths.retentionPath].map((relative) => `${archiveRelative}/${relative}`).sort();
  git(['add', '--', ...staged], publishCheckout);
  const actual = git(['diff', '--cached', '--name-only'], publishCheckout).split('\n').filter(Boolean).sort();
  assert(JSON.stringify(actual) === JSON.stringify(staged), `STAGED_ALLOWLIST:${actual.join(',')}`);
  git(['-c', 'user.name=AgenticDevOps Archive', '-c', 'user.email=archive@local.invalid', 'commit', '--quiet', '-m', 'Finalize M3 archive retention and evidence'], publishCheckout);
  state.commitCreated = true;
  state.finalCommit = git(['rev-parse', 'HEAD'], publishCheckout);
  state.finalTree = git(['rev-parse', 'HEAD^{tree}'], publishCheckout);
  assert(git(['rev-parse', 'HEAD^'], publishCheckout) === expected.parentCommit && git(['rev-list', '--count', 'HEAD'], publishCheckout) === '2' && git(['status', '--porcelain'], publishCheckout) === '', 'LOCAL_COMMIT_STRUCTURE');
  assert(remoteGit(['ls-remote', 'origin', 'refs/heads/main'], publishCheckout) === `${expected.parentCommit}\trefs/heads/main`, 'REMOTE_CHANGED_BEFORE_PUSH');

  state.phase = 'SINGLE_PUSH';
  state.pushAttempted = true;
  remoteGit(['push', 'origin', `${state.finalCommit}:refs/heads/main`], publishCheckout);
  state.pushSucceeded = true;
  verifyFinalRemote();
  console.log(`PUSH_OK commit=${state.finalCommit} tree=${state.finalTree}`);

  state.phase = 'EXACT_REDOWNLOAD';
  fs.mkdirSync(redownloadRoot, { mode: 0o700 });
  state.redownloadStagingCreated = true;
  assertMode700(redownloadRoot);
  git(['init', '--quiet', '--initial-branch=main', redownloadCheckout], workspace);
  git(['remote', 'add', 'origin', repositoryUrl], redownloadCheckout);
  remoteGit(['fetch', '--no-tags', 'origin', 'refs/heads/main'], redownloadCheckout);
  assert(git(['rev-parse', 'FETCH_HEAD'], redownloadCheckout) === state.finalCommit, 'REDOWNLOAD_FETCH');
  git(['checkout', '--quiet', '--detach', state.finalCommit], redownloadCheckout);
  assert(git(['rev-parse', 'HEAD'], redownloadCheckout) === state.finalCommit && git(['rev-parse', 'HEAD^{tree}'], redownloadCheckout) === state.finalTree && git(['rev-parse', 'HEAD^'], redownloadCheckout) === expected.parentCommit && git(['status', '--porcelain'], redownloadCheckout) === '', 'REDOWNLOAD_GIT_STATE');

  state.phase = 'LOCAL_FINAL_VALIDATION';
  verifyRedownload(payload);
  git(['fsck', '--full', '--strict'], redownloadCheckout);
  run('npm', ['run', 'validate'], { cwd: path.join(workspace, 'framework'), inherit: true });
  verifyBindings({ includeExecution: false });
  verifyRoots({ requireNewAbsent: false });
  await verifySources();
  const runnerHash = sha256File(runnerPath);
  fs.mkdirSync(path.join(publishRoot, 'operation-evidence'), { mode: 0o700 });
  fs.mkdirSync(path.join(redownloadRoot, 'operation-evidence'), { mode: 0o700 });
  const result = {
    schema_version: 1,
    status: 'COMPLETED',
    operation_id: operationId,
    runner_pid: process.pid,
    parent: expected.parentCommit,
    commit: state.finalCommit,
    tree: state.finalTree,
    files: 25,
    inventory_sha256: state.finalInventory,
    retention_sha256: state.retention,
    evidence_index_sha256: state.evidenceIndex,
    redownload: 'BYTE_IDENTICAL',
    historical_artifacts_unchanged: 5,
    npm_validate_exit: 0,
    last_remote_operation: 'EXACT_COMMIT_REDOWNLOAD_FETCH',
  };
  writeJson(path.join(publishRoot, 'operation-evidence/finalization-result.json'), result);
  writeJson(path.join(redownloadRoot, 'operation-evidence/redownload-verification.json'), { ...result, git_fsck_full_strict: 'PASS' });
  appendSuccess(payload, runnerHash);
  result.execution_sha256 = sha256File(executionPath);
  result.runner_sha256 = runnerHash;
  console.log('M3_RESULT_BEGIN');
  console.log(JSON.stringify(result, null, 2));
  console.log('M3_RESULT_END');
}

let exitCode = 0;
try {
  await execute();
} catch (error) {
  exitCode = 1;
  appendFailure(error);
  console.error(`M3_RESULT status=${state.pushSucceeded ? 'PARTIAL' : 'BLOCKED'} phase=${state.phase} reason=${error.message}`);
} finally {
  delete process.env.GH_TOKEN;
  console.log(`GH_TOKEN_UNSET_IN_RUNNER_PROCESS=${process.env.GH_TOKEN === undefined}`);
}
process.exitCode = exitCode;
