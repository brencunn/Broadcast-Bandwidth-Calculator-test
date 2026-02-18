# Broadcast Bandwidth Calculator

Web app for planning broadcast circuits, services, and bandwidth utilisation.

## What It Does

- Create and manage events.
- Build circuits with multi-node paths.
- Configure per-segment max bandwidth and soft limits with sanity checks.
- Add and edit Video, Audio, and Data services.
- Duplicate services to speed up repetitive setup.
- Edit service names inline from the service list.
- Manage nodes and equipment from dedicated views.
- Import and export event JSON files.
- Persist all events on disk (server-side JSON files).
- Live update all connected clients in real time (SSE-based sync).

## Prerequisites

- Ubuntu server (or similar Linux host)
- Docker Engine
- Docker Compose plugin (`docker compose`)
- Access to the GitHub repository

## 1) Clone From GitHub

```bash
git clone --branch main https://github.com/brencunn/Broadcast-Bandwidth-Calculator.git
cd Broadcast-Bandwidth-Calculator
```

## 2) Install Docker + Compose (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
```

## 3) Run The App (Docker Compose)

From repo root:

```bash
docker compose up -d --build
```

Open in browser:

- `http://<server-ip>/`
- Example: `http://172.29.10.18/`

This project is configured to publish container port `3000` on host port `80`.

## 4) Update To Latest Version

```bash
git pull origin main
docker compose up -d --build
```

## 5) Data Persistence

Event data is saved as JSON files on the host at:

- `/srv/broadcast-bandwidth-data`

Each event is stored as its own JSON file. This is mounted into the container at `/data/events`.

Back up with:

```bash
sudo tar -czf bbc-bandwidth-backup-$(date +%F).tar.gz /srv/broadcast-bandwidth-data
```

## 6) Import/Export Format

- Best input format: JSON exported from this app.
- Event import validates the structure and shows user-facing error toasts for invalid files.
- For spreadsheet conversion workflows, map sheet data into this exported JSON shape.

## 7) Troubleshooting

### App does not load on `http://<server-ip>/`

Check containers:

```bash
docker compose ps
docker compose logs -f
```

Check port binding:

```bash
sudo ss -tulpn | grep ':80'
```

If UFW is enabled:

```bash
sudo ufw allow 80/tcp
sudo ufw status
```

## 8) Useful Commands

```bash
# Start or rebuild
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f

# Check running services
docker compose ps
```

## Support

Have a feature request or found a bug? Email here:

- [brendan.cunningham@bbc.co.uk](mailto:brendan.cunningham@bbc.co.uk?subject=Broadcast%20Bandwidth%20Calculator%20Feedback)
