#!/usr/bin/env bash
# Download the raw production data into db/production/raw/ (git-ignored).
#   - Project Hammer grocery prices: https://www.projecthammer.org/get-the-data.html
#     (about 540 MB zipped, 4 GB unzipped)
#   - Statistics Canada table 18-10-0245-01, monthly average retail prices:
#     https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810024501
# Re-running resumes a partial download.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p raw/hammer raw/statcan

# fetch <url> <output file>: resume partial files, and retry when the transfer stalls
# (the Hammer server sometimes stops sending without closing the connection).
fetch() {
    local url="$1" out="$2"
    for attempt in 1 2 3 4 5 6 7 8; do
        if curl -fSL -C - --speed-limit 10000 --speed-time 30 -o "$out" "$url"; then
            return 0
        fi
        echo "Download stalled (attempt $attempt), resuming..." >&2
    done
    echo "Giving up on $url" >&2
    return 1
}

echo "Downloading StatCan 18-10-0245-01..."
fetch https://www150.statcan.gc.ca/n1/tbl/csv/18100245-eng.zip raw/statcan/18100245-eng.zip
unzip -o -q raw/statcan/18100245-eng.zip -d raw/statcan

echo "Downloading Project Hammer (about 540 MB)..."
fetch https://jacobfilipp.com/hammerdata/hammer-5-csv.zip raw/hammer/hammer-5-csv.zip
unzip -o -q raw/hammer/hammer-5-csv.zip -d raw/hammer

ls -lh raw/statcan/18100245.csv raw/hammer/hammer-4-product.csv raw/hammer/hammer-4-raw.csv
