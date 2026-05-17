# EC2 deployment

The site runs on a single AWS EC2 instance behind a reverse proxy. This doc
covers the layout for a small/medium production setup.

## Topology

```
                ┌─────────┐
 user ───TLS───▶│ Cloud-  │── http (private) ─▶ Caddy / nginx ─▶ Next.js (Node)
                │ Front?  │
                └─────────┘                                        │
                                                                   ▼
                                                          Supabase (Postgres)
                                                                   │
                                                                   ▼
                                                            AWS S3 (presigned)
```

- TLS termination either at Caddy on the instance (Let's Encrypt) or at
  CloudFront / an ALB in front of it.
- Outbound traffic from the instance hits Supabase, S3, OpenAI, Resend,
  PostHog, Google Analytics.

## Instance shape

- AMI: Amazon Linux 2023 or Ubuntu 24.04 LTS
- Class: `t3.small` is enough to start; bump to `t3.medium` once traffic grows
- Disk: 20 GB gp3
- Security group: 80, 443 from `0.0.0.0/0`, 22 from your IP only
- IAM role: attach a policy with `s3:PutObject` / `s3:GetObject` on the bucket
  so the app can fall back to the EC2 instance role (no AWS keys in env)

## Bootstrap

```bash
sudo dnf install -y git nodejs npm caddy        # or apt on Ubuntu
git clone https://github.com/yogadwipayana/yogadwipayana.git /opt/yogadwipayana
cd /opt/yogadwipayana
cp .env.example .env                            # fill in production values
npm ci --omit=dev
npm run build
```

## Run as a systemd service

`/etc/systemd/system/yogadwipayana.service`

```ini
[Unit]
Description=yogadwipayana (Next.js)
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/yogadwipayana
EnvironmentFile=/opt/yogadwipayana/.env
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now yogadwipayana.service
```

## Reverse proxy (Caddy)

`/etc/caddy/Caddyfile`

```
yogathedev.com {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
```

Caddy handles TLS automatically.

## CI/CD

`.github/workflows/deploy.yml` SSHes into the instance on push to `main` and
runs `git pull && npm ci --omit=dev && npm run build && systemctl restart`.
Required secrets:

- `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_APP_DIR`

## Tradeoffs

- **One instance = single point of failure.** Fine for a portfolio; put it
  behind an ALB and run two instances once you care about uptime.
- **Bandwidth costs.** Egress to S3 and OpenAI is the dominant variable cost
  at small scale. Watch it.
- **Cold deploys.** `systemctl restart` drops in-flight connections. Use
  `pm2` reload or a blue/green Docker swap if that becomes a problem.
