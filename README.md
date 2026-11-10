# kindle-wand

Wandanzeige für ein altes **Kindle 4 (ohne Touch, 600×800)**: gemeinsamer Google Kalender und die neueste Lokalnachricht aus ein paar Heimatorten (MeinBezirk).

```
GitHub Actions (stündlich)  ──►  GitHub Pages: /<geheimer Pfad>/dash-<akku>.png
                                         ▲
Kindle 4 (kindle-dash, 4× täglich wach) ─┘  lädt Bild passend zum Akkustand, zeigt es, schläft
```

## Lokal ausprobieren

```bash
npm install
npx playwright install chromium
npm run render
```

Ergebnis in `out/`: `dashboard.png` (Vorschau) und `dash-0.png` … `dash-100.png` (mit Akkuanzeige).

Konfiguration über Umgebungsvariablen oder `config.local.json` (nicht im Repo):

| Variable | Bedeutung |
|---|---|
| `ICS_URL` | Google Kalender → Einstellungen → „Privatadresse im iCal-Format“. Mehrere mit Komma. Ohne: Beispieltermine. |
| `NEWS_ORTE` | `Anzeigename=meinbezirk-tag;…`, z. B. `Linz=linz;Wels=wels` (Tag aus `meinbezirk.at/tag/<tag>`) |
| `OUT_DIR` | Zielordner (Standard `out/`) |

## Cloud (GitHub Actions + Pages)

Repository-Secrets: `ICS_URL`, `NEWS_ORTE`, `DASH_PATH` (zufällige Zeichenkette, Teil der Bild-URL).
Settings → Pages → Source: **GitHub Actions**.

## Kindle

Jailbreak + USBNetwork (SSH über WLAN), dann [kindle-dash](https://github.com/pascalw/kindle-dash) nach `/mnt/us/dashboard`.
Eigene Dateien aus `kindle/device/` darüberkopieren, dazu:

- `ca-bundle.crt`: aktuelles CA-Zertifikatspaket (das Kindle-eigene OpenSSL ist zu alt für modernes HTTPS)
- `local/url.txt`: `https://<user>.github.io/<repo>/<DASH_PATH>`

Start: `/mnt/us/dashboard/start.sh` (stoppt die Kindle-Oberfläche). Logs: `/mnt/us/dashboard/logs/dash.log`.
Zurück zum normalen Kindle: `stop.sh` und neu starten.
