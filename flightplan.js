// flightplan.js
var plan = require('flightplan');

/**
 * Remote configuration for "production"
 */
plan.target('production', {
  host: '192.168.33.10',
  username: 'vagrant',
  password: 'vagrant',
  agent: process.env.SSH_AUTH_SOCK,

  webRoot: '/var/www/mywebsite',
  ownerUser: 'www-data',
  repository: 'https://github.com/lmammino/sample-web-project.git',
  branchName: 'master',
  maxDeploys: 6
});

/**
 * Creates all the necessary folders in the remote and clones the source git repository
 * 
 * Usage:
 * > fly setup[:remote]
 */
plan.remote('setup', function(remote) {
	remote.hostname();

	remote.with('cd ' + remote.runtime.webRoot, function() {
		remote.sudo('mkdir versions');
		remote.sudo('git clone -b ' + remote.runtime.branchName + ' ' + remote.runtime.repository + ' repo');
	});
});

/**
 * Deploys a new version of the code pulling it from the git repository
 *
 * Usage:
 * > fly deploy[:remote]
 */
plan.remote('deploy', function(remote) {
	remote.hostname();

	remote.with('cd ' + remote.runtime.webRoot, function() {
		remote.sudo('cd repo && git pull');
		var command = remote.exec('date +%s.%N');
		var versionId = command.stdout.trim();
		var versionFolder = 'versions/' + versionId
		
		remote.sudo('cp -R repo ' + versionFolder);
		remote.sudo('chown -R ' + remote.runtime.ownerUser + ':' + remote.runtime.ownerUser + ' ' + versionFolder);
		remote.sudo('ln -fsn ' + versionFolder + ' current');
		remote.sudo('chown -R ' + remote.runtime.ownerUser + ':' + remote.runtime.ownerUser + ' current');

		if (remote.runtime.maxDeploys > 0) {
			remote.log('Cleaning up old deploys...');
			remote.sudo('rm -rf `ls -1dt versions/* | tail -n +' + (remote.runtime.maxDeploys+1) + '`');
		}

		remote.log('Successfully deployied in ' + versionFolder);
		remote.log('To rollback to the previous version run "fly rollback:production"');
	});

});

/**
 * Rollbacks to the previous deployied version (if any)
 *
 * Usage
 * > fly rollback[:remote]
 */
plan.remote('rollback', function(remote) {
	remote.hostname();

	remote.with('cd ' + remote.runtime.webRoot, function() {
		var command = remote.exec('ls -1dt versions/* | head -n 2');
		var versions = command.stdout.trim().split('\n');

		if (versions.length < 2) {
			return remote.log('No version to rollback to');
		}

		var lastVersion = versions[0];
		var previousVersion = versions[1];

		remote.log('Rolling back from ' + lastVersion + ' to ' + previousVersion);

		remote.sudo('ln -fsn ' + previousVersion + ' current');
		remote.sudo('chown -R ' + remote.runtime.ownerUser + ':' + remote.runtime.ownerUser + ' current');

		remote.sudo('rm -rf ' + lastVersion);
	});
});