/**
 * Password SSH deploy (one-off). Usage:
 *   set DO_ROOT_PASSWORD=...
 *   node scripts/deploy-remote-node.cjs
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '64.227.188.248';
const USER = 'root';
const PASS = process.env.DO_ROOT_PASSWORD;
const ROOT = path.join(__dirname, '..');
const REMOTE = '/opt/auron-realtime';

if (!PASS) {
  console.error('Missing DO_ROOT_PASSWORD');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('close', (code) => {
        if (code !== 0) {
          const e = new Error(`Exit ${code}: ${cmd}\n${errOut || out}`);
          e.code = code;
          return reject(e);
        }
        resolve(out);
      });
      stream.on('data', (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => {
        errOut += d.toString();
        process.stderr.write(d);
      });
    });
  });
}

function upload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const rs = fs.createReadStream(localPath);
      const ws = sftp.createWriteStream(remotePath);
      ws.on('close', () => resolve());
      ws.on('error', reject);
      rs.on('error', reject);
      rs.pipe(ws);
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
  });
  console.log('SSH connected');

  const pubPath = path.join(ROOT, '.deploy-keys', 'do_ed25519.pub');
  if (fs.existsSync(pubPath)) {
    const pub = fs.readFileSync(pubPath, 'utf8').trim().replace(/'/g, "'\\''");
    await exec(
      conn,
      `mkdir -p ~/.ssh && chmod 700 ~/.ssh && (grep -qxF '${pub}' ~/.ssh/authorized_keys 2>/dev/null || echo '${pub}' >> ~/.ssh/authorized_keys) && chmod 600 ~/.ssh/authorized_keys && echo DEPLOY_KEY_OK`
    );
  }

  await exec(conn, `mkdir -p ${REMOTE}/scripts`);

  const uploads = [
    [path.join(ROOT, 'serviceAccount.json'), `${REMOTE}/serviceAccount.json`],
    [path.join(ROOT, 'server/scripts/bootstrap-env-and-db.sh'), `${REMOTE}/scripts/bootstrap-env-and-db.sh`],
    [path.join(ROOT, 'server/scripts/server-one-paste-bootstrap.sh'), `${REMOTE}/scripts/server-one-paste-bootstrap.sh`]
  ];
  for (const [l, r] of uploads) {
    if (!fs.existsSync(l)) throw new Error(`Missing local file: ${l}`);
    console.log('Upload', path.basename(l));
    await upload(conn, l, r);
  }

  await exec(
    conn,
    `cd ${REMOTE} && sed -i 's/\\r$//' scripts/*.sh 2>/dev/null; chmod +x scripts/server-one-paste-bootstrap.sh scripts/bootstrap-env-and-db.sh && bash scripts/server-one-paste-bootstrap.sh`
  );

  await exec(
    conn,
    `cd ${REMOTE} && (command -v pm2 >/dev/null || npm install -g pm2) && pm2 delete auron-realtime 2>/dev/null || true && pm2 start ecosystem.config.cjs && pm2 save`
  );

  const health = await exec(conn, 'curl -s http://127.0.0.1:3000/health || true');
  console.log('\nHEALTH:', health.trim());

  conn.end();
  console.log('DEPLOY_SUCCESS');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
