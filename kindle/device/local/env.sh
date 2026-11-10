#!/usr/bin/env sh
# Konfiguration für kindle-dash auf dem Kindle 4 (liegt dort in /mnt/us/dashboard/local/env.sh)

export WIFI_TEST_IP=${WIFI_TEST_IP:-1.1.1.1}
export TIMEZONE="Europe/Vienna"

# Viermal am Tag aufwachen (das Bild wird in der Cloud stündlich um ca. :05 neu erzeugt)
export REFRESH_SCHEDULE="45 5,12,17,21 * * *"

# 0 = bei jedem Update vollständig neu zeichnen (kurzes Flackern, dafür keine Geisterbilder)
export FULL_DISPLAY_REFRESH_RATE=0

# Nie den "schlafe gerade"-Bildschirm zeigen – das Dashboard soll auch nachts sichtbar bleiben
export SLEEP_SCREEN_INTERVAL=1000000

export LOW_BATTERY_REPORTING=false
export LOW_BATTERY_THRESHOLD_PERCENT=10
