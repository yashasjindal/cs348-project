#!/usr/bin/env python3
"""Build the SmartCart production dataset.

Inputs (see db/production/download.sh):
  - Project Hammer grocery prices (hammer-4-product.csv, hammer-4-raw.csv)
  - Statistics Canada table 18-10-0245-01, monthly average retail prices (18100245.csv)

Output: one CSV per table in --out-dir, ready for db/production/load.sh, plus
build-report.txt with the counts behind every filtering decision.

Only the Python standard library is used.

Matching rules (statcan_rules.csv) map each StatCan item to Hammer listings:
  - the listing name must match the item's `include` regex and not its `exclude` regex;
  - packaged items ("Butter, 454 grams") also need a package size within --size-tolerance
    of the StatCan size;
  - per-kilogram items ("Bananas, per kilogram") are priced per kg from the listing's
    per-weight price;
  - per-unit items ("Avocado, unit") must be sold singly.
A listing that matches no item, or more than one, is dropped (Product.sid is NOT NULL).
Listings sharing a UPC become one Product sold by several vendors.
"""
import argparse
import array
import collections
import csv
import datetime as dt
import os
import re
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))

VENDOR_NAMES = {
    "Walmart": "Walmart", "Loblaws": "Loblaws", "Voila": "Voila", "Metro": "Metro",
    "NoFrills": "No Frills", "SaveOnFoods": "Save-On-Foods", "TandT": "T&T Supermarket",
    "Galleria": "Galleria", "Sobeys": "Sobeys",
}
# When several listings describe one product, take its name/brand/size from the
# first vendor in this order (these vendors have the cleanest names and brands).
VENDOR_PRIORITY = ["Loblaws", "NoFrills", "Metro", "SaveOnFoods", "Sobeys",
                   "Walmart", "Voila", "Galleria", "TandT"]

LB_G = 453.592
OZ_G = 28.3495
FLOZ_ML = 29.5735


# ---------------------------------------------------------------- StatCan

STATCAN_UNITS = {"grams": "g", "gram": "g", "kilograms": "kg", "kilogram": "kg",
                 "litres": "L", "litre": "L", "millilitres": "mL", "millilitre": "mL"}
# StatCan unit -> (base unit used for comparisons, factor)
TO_BASE = {"g": ("g", 1.0), "kg": ("g", 1000.0), "mL": ("mL", 1.0), "L": ("mL", 1000.0),
           "ea": ("ea", 1.0)}


def parse_statcan_label(label):
    """'Milk, 2 litres' -> ('Milk', 2.0, 'L', 'size'). Modes: size, per_kg, unit."""
    m = re.match(r"^(.*?)\s*\((\d+) bags\)$", label)          # 'Tea (20 bags)'
    if m:
        return m.group(1), float(m.group(2)), "ea", "size"
    base, size = (s.strip() for s in label.rsplit(",", 1))
    if size == "per kilogram":
        return base, 1.0, "kg", "per_kg"
    if size == "unit":
        return base, 1.0, "ea", "unit"
    if size == "1 dozen":
        return base, 12.0, "ea", "size"
    qty, unit = size.split(" ", 1)
    return base, float(qty), STATCAN_UNITS[unit], "size"


def load_statcan(path):
    """Return items {label: dict} and history {label: [(date, price)]} for GEO=Canada."""
    items, history = {}, collections.defaultdict(list)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["GEO"] != "Canada" or not r["VALUE"].strip():
                continue
            label = " ".join(r["Products"].split())             # some labels end in spaces
            history[label].append((dt.date.fromisoformat(r["REF_DATE"] + "-01"), float(r["VALUE"])))
    for sid, label in enumerate(sorted(history), start=1):
        base, qty, unit, mode = parse_statcan_label(label)
        hist = sorted(history[label])
        items[label] = {"sid": sid, "label": label, "base": base, "qty": qty, "unit": unit,
                        "mode": mode, "price": hist[-1][1], "month": hist[-1][0]}
    return items, history


# ---------------------------------------------------------------- Hammer listings

MASS_VOL = re.compile(
    r"(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*"
    r"(kg|kilograms?|g|grams?|gr|ml|millilitres?|milliliters?|l|litres?|liters?|lbs?|pounds?|fl\.? ?oz|oz)\b",
    re.I)
COUNT = re.compile(r"(\d+)\s*(?:ea|each|count|ct|pk|pack|per pack|eggs|un|units?|tea bags|bags|pieces|pcs)\b", re.I)
DOZEN = re.compile(r"(\d+(?:\.\d+)?)?\s*dozen\b", re.I)
SINGLE = re.compile(r"sold individually|sold in singles|\b1\s*un\b|^each$", re.I)
UNIT_BASE = {"kg": ("g", 1000), "kilogram": ("g", 1000), "kilograms": ("g", 1000),
             "g": ("g", 1), "gram": ("g", 1), "grams": ("g", 1), "gr": ("g", 1),
             "ml": ("mL", 1), "millilitre": ("mL", 1), "millilitres": ("mL", 1),
             "milliliter": ("mL", 1), "milliliters": ("mL", 1),
             "l": ("mL", 1000), "litre": ("mL", 1000), "litres": ("mL", 1000),
             "liter": ("mL", 1000), "liters": ("mL", 1000),
             "lb": ("g", LB_G), "lbs": ("g", LB_G), "pound": ("g", LB_G), "pounds": ("g", LB_G),
             "oz": ("g", OZ_G)}


def parse_size(text, prefer_last):
    """Package size in base units: (qty, 'g'|'mL'|'ea') or None."""
    if not text:
        return None
    hits = list(MASS_VOL.finditer(text))
    if hits:
        m = hits[-1] if prefer_last else hits[0]
        n, q, u = m.group(1), float(m.group(2)), m.group(3).lower().replace(".", "")
        if u.startswith("fl"):
            base, k = "mL", FLOZ_ML
        else:
            base, k = UNIT_BASE[u]
        return q * k * (int(n) if n else 1), base
    m = DOZEN.search(text)
    if m:
        return 12 * float(m.group(1) or 1), "ea"
    hits = list(COUNT.finditer(text))
    if hits:
        m = hits[-1] if prefer_last else hits[0]
        return float(m.group(1)), "ea"
    if SINGLE.search(text):
        return 1.0, "ea"
    return None


def listing_size(r):
    units = r["units"].strip()
    if units and units.lower() != "error":
        s = parse_size(units, prefer_last=False)
        if s:
            return s
    return parse_size(r["product_name"], prefer_last=True)


class Rule:
    def __init__(self, row):
        self.base = row["statcan_name"]
        self.category = row["category"]
        self.include = re.compile(row["include"], re.I)
        self.exclude = re.compile(row["exclude"], re.I) if row["exclude"] else None

    def name_matches(self, name):
        return bool(self.include.search(name)) and not (self.exclude and self.exclude.search(name))


# Per-kg and per-unit items are fresh produce and meat. Names like 'Grape Sparkling Water',
# 'Sour Cream & Onion' or 'Apple Slices' pass a produce keyword but are processed goods.
FRESH_EXCLUDE = re.compile(
    r"\b(?:flavou?r(?:ed)?|juice|drinks?|beverages?|soda|sparkling|water|chips?|crisps?|snacks?|candy|"
    r"jelly|jam|sauce|paste|powder|seasoning|spice|dried|dehydrated|frozen|canned|cooked|fried|soup|"
    r"cakes?|bread|pie|cookies?|crackers?|yogh?o?urt|cheese|cheddar|tea|cocktail|punch|syrup|oil|"
    r"vinegar|dressing|dip|hummus|tuna|pouch|puree|baby food|bars?|gummies|pops|popsicles?|ice cream|"
    r"cream|lure|toy|soap|dish|liquid|detergent|cleaner|scent(?:ed)?|shampoo|lotion|vitamins?|"
    r"supplements?|pediatric|drops|electrolyte|hydration|mix|stix|rings|patties|vermicelli|noodles?|"
    r"pasta|kabobs?|kebabs?|skewers?|tartare|pinwheel|crusted|marinated|seasoned|stuffed|breaded|"
    r"slices|sliced|spread|filling|smoothie|lays|cheetos|pringles|ruffles|doritos|kettle|"
    r"broad bean|bean|beans|pancakes?|patty|burgers?|sausages?|meatballs?|jerky|nuggets|strips|"
    r"rice|cereal|oats|granola|muffins?|loaf|scones?|danish|tarts?|crumble|pudding|custard|gelatin|"
    r"wine|beer|cider|liqueur|vodka|spirits?|sorbet|gelato|freezies|cups?|"
    # Walmart marketplace and non-food listings
    r"t-?shirts?|shirts?|gifts?|giftbox|basket|slicers?|cutters?|divider|plastic|stainless|steel|"
    r"arrangements?|decor|artificial|ornaments?|keychain|stickers?|costume|plush|seltzer|bottle|"
    # prepared foods named after their main ingredient
    r"gum|gumm(?:y|ies)|daifuku|panettone|mousse|musse|squares|biscuits?|tortillas?|hot pot|passata|"
    r"stickleback|perogies|bourekas|agnolotti|ravioli|medallion|griller|balls?|leaves|toppers|"
    r"snakpak|teriyaki|entr[ée]e|tournedos|skin|wedges|chunks|tok|bites|rolls|catfish)\b", re.I)


def size_ok(item, size, tol):
    mode = item["mode"]
    if mode in ("per_kg", "unit") and size is not None and size[1] == "mL":
        return False                                  # produce isn't sold by volume
    if mode == "per_kg":
        return True                                   # normalised to $/kg from the price
    if mode == "unit":
        return size is None or size == (1.0, "ea")    # singles only
    if size is None:
        return False
    base, k = TO_BASE[item["unit"]]
    target = item["qty"] * k
    return size[1] == base and abs(size[0] - target) <= tol * target


def match_listings(products, items, rules, tol, stats):
    """Return {hammer_id: (listing row, StatCan label, size)} for listings matching exactly one item."""
    by_base = collections.defaultdict(list)
    for it in items.values():
        by_base[it["base"]].append(it)
    for base in rules:
        if base not in by_base:
            sys.exit(f"statcan_rules.csv: no StatCan item named {base!r}")
    stats["statcan items without a rule"] = sorted(b for b in by_base if b not in rules)

    matched = {}
    for r in products:
        name = r["product_name"]
        cands = [b for b, rule in rules.items() if rule.name_matches(name)]
        if not cands:
            continue
        stats["listings matching a name rule"] += 1
        size = listing_size(r)
        fresh_ok = not FRESH_EXCLUDE.search(name)
        fits = [it for b in cands for it in by_base[b]
                if size_ok(it, size, tol) and (it["mode"] == "size" or fresh_ok)]
        # 'Onions, 1.36 kilograms' and 'Onions, per kilogram' both accept a 1.36 kg bag;
        # an exact package-size match is the more specific one.
        if len(fits) > 1 and any(it["mode"] == "size" for it in fits):
            fits = [it for it in fits if it["mode"] == "size"]
        if not fits:
            stats["dropped: name matched but size did not"] += 1
            continue
        if len(fits) > 1:
            stats["dropped: matched more than one StatCan item"] += 1
            continue
        matched[r["id"]] = (r, fits[0]["label"], size)
    return matched


# ---------------------------------------------------------------- prices

NUM = re.compile(r"^\$?(\d+(?:\.\d+)?)$")
CENTS = re.compile(r"^(?:current price\s*)?(\d+)¢$")
CURRENT = re.compile(r"^current price\s*\$?(\d+(?:\.\d+)?)$")
AVG_EA = re.compile(r"^\$?(\d+(?:\.\d+)?)\s*avg/ea$")
CUR_PER_WT = re.compile(r"^\$?(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)?\s*(kg|g|lb)$", re.I)
PPU = re.compile(r"^\$?(\d+(?:\.\d+)?)\s*(¢)?\s*(?:/|per)\s*(\d+(?:\.\d+)?)?\s*(kg|g|lb)\b", re.I)


def shelf_price(cur):
    """Price of one package: '5.29', '$5.29', 'current price 39¢'. None for multi-buy etc."""
    cur = cur.strip()
    for rx, scale in ((NUM, 1), (CURRENT, 1), (CENTS, 0.01)):
        m = rx.match(cur)
        if m:
            return float(m.group(1)) * scale
    return None


def to_per_kg(value, qty, unit):
    grams = (float(qty) if qty else 1.0) * {"kg": 1000, "g": 1, "lb": LB_G}[unit.lower()]
    return value / grams * 1000


def per_kg_price(cur, ppu, size):
    """$/kg for produce and meat sold by weight."""
    m = PPU.match(ppu.strip())
    if m:
        value = float(m.group(1)) * (0.01 if m.group(2) else 1)
        return to_per_kg(value, m.group(3), m.group(4))
    cur = cur.strip()
    m = CUR_PER_WT.match(cur)
    if m:
        return to_per_kg(float(m.group(1)), m.group(2), m.group(3))
    p = shelf_price(cur)
    if p is None:
        m = AVG_EA.match(cur)
        p = float(m.group(1)) if m else None
    if p is not None and size and size[1] == "g" and size[0] > 0:
        return p / size[0] * 1000
    return None


def unit_price(cur):
    p = shelf_price(cur)
    if p is None:
        m = AVG_EA.match(cur.strip())
        p = float(m.group(1)) if m else None
    return p


# ---------------------------------------------------------------- main build

def pick(listings):
    """Representative listing: highest-priority vendor, preferring one with a brand."""
    return min(listings, key=lambda r: (VENDOR_PRIORITY.index(r["vendor"]), not clean_brand(r["brand"])))


def clean_name(name):
    name = " ".join(name.split())
    return (name.title() if name.isupper() else name)[:255]          # Product.name VARCHAR(255)


BRAND_JUNK = re.compile(r"[¢$]|current price|out of stock|^\d", re.I)


def clean_brand(brand):
    """Hammer brands sometimes hold scraped price text ('98¢ current price 98¢'); treat those as no brand."""
    brand = " ".join(brand.split())
    return "" if BRAND_JUNK.search(brand) else brand[:100]          # Product.brand VARCHAR(100)


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hammer-dir", default=os.path.join(HERE, "raw", "hammer"))
    ap.add_argument("--statcan-dir", default=os.path.join(HERE, "raw", "statcan"))
    ap.add_argument("--out-dir", default=os.path.join(HERE, "out"))
    ap.add_argument("--rules", default=os.path.join(HERE, "statcan_rules.csv"))
    ap.add_argument("--size-tolerance", type=float, default=0.10,
                    help="max relative difference from the StatCan package size (default 0.10)")
    ap.add_argument("--stale-days", type=int, default=30,
                    help="drop vendor listings with no price in the last N days of data (default 30)")
    ap.add_argument("--match-only", action="store_true",
                    help="only report how many listings each StatCan item matches (skips the 4 GB price file)")
    ap.add_argument("--show", type=int, default=0, help="with --match-only, print N sample matches per item")
    args = ap.parse_args()

    t0 = time.time()
    stats = collections.Counter()
    say = lambda *a: print(*a, file=sys.stderr, flush=True)

    items, sc_history = load_statcan(os.path.join(args.statcan_dir, "18100245.csv"))
    with open(args.rules, encoding="utf-8", newline="") as f:
        rules = {row["statcan_name"]: Rule(row) for row in csv.DictReader(f)}
    with open(os.path.join(args.hammer_dir, "hammer-4-product.csv"), encoding="utf-8-sig", newline="") as f:
        products = list(csv.DictReader(f))
    say(f"StatCan items: {len(items)}   Hammer listings: {len(products):,}")
    stats["hammer listings"] = len(products)

    matched = match_listings(products, items, rules, args.size_tolerance, stats)
    stats["listings matched to exactly one StatCan item"] = len(matched)

    if args.match_only:
        per_item = collections.defaultdict(list)
        for r, label, _ in matched.values():
            per_item[label].append(r)
        for label in sorted(items):
            rs = per_item.get(label, [])
            upcs = {r["upc"] for r in rs if r["upc"].strip()}
            vendors = collections.Counter(r["vendor"] for r in rs)
            print(f"{len(rs):5d} listings {len(upcs):4d} UPCs {len(vendors)} vendors  {label}")
            for r in rs[:: max(1, len(rs) // args.show)][: args.show] if args.show else []:
                print(f"         {r['vendor']:<11} {r['product_name'][:70]} | {r['units']} | {r['brand']}")
        for k, v in stats.items():
            print(f"{k}: {v}")
        return

    # ---- group listings into products
    # Key: UPC when present, else (vendor, normalised name, size) to fold a vendor's own duplicates.
    groups = collections.defaultdict(list)
    for hid, (r, label, size) in matched.items():
        upc = r["upc"].strip()
        key = ("upc", upc) if upc else ("vendor", r["vendor"], r["product_name"].lower().strip(), size)
        groups[key].append(hid)
    stats["UPCs seen at 2+ vendors"] = sum(
        1 for k, hids in groups.items() if k[0] == "upc" and len({matched[h][0]["vendor"] for h in hids}) > 1)

    product_rows, listing_to_out = [], {}
    for key, hids in groups.items():
        labels = collections.Counter(matched[h][1] for h in hids)
        label, _ = labels.most_common(1)[0]
        if len(labels) > 1:
            stats["dropped: listing's UPC group matched a different StatCan item"] += sum(
                n for l, n in labels.items() if l != label)
        hids = [h for h in hids if matched[h][1] == label]
        rep = pick([matched[h][0] for h in hids])
        product_rows.append({"key": key, "label": label, "rep": rep, "size": matched[rep["id"]][2], "hids": hids})

    # Stable pids: sorted by StatCan item, then product name.
    product_rows.sort(key=lambda p: (items[p["label"]]["sid"], clean_name(p["rep"]["product_name"]).lower(), str(p["key"])))
    vendors = sorted({matched[h][0]["vendor"] for p in product_rows for h in p["hids"]}, key=lambda v: VENDOR_NAMES[v])
    vid_of = {v: i for i, v in enumerate(vendors, start=1)}
    product_qty = {}                   # pid -> package size in its StatCan item's unit
    for pid, p in enumerate(product_rows, start=1):
        p["pid"] = pid
        for h in p["hids"]:
            listing_to_out[h] = (vid_of[matched[h][0]["vendor"]], pid)
        it = items[p["label"]]
        if it["mode"] in ("per_kg", "unit"):
            product_qty[pid] = it["qty"]             # priced per kg / per item
        else:
            product_qty[pid] = p["size"][0] / TO_BASE[it["unit"]][1]

    # ---- stream the price file once, keeping only matched listings
    mode_of = {h: items[label]["mode"] for h, (_, label, _) in matched.items()}
    days = collections.defaultdict(lambda: array.array("I"))     # (vid,pid) -> yyyymmdd
    cents = collections.defaultdict(lambda: array.array("I"))    # (vid,pid) -> price in cents
    raw_path = os.path.join(args.hammer_dir, "hammer-4-raw.csv")
    say(f"Reading {raw_path} ...")
    n = 0
    with open(raw_path, encoding="utf-8-sig", newline="") as f:
        rd = csv.reader(f)
        next(rd)
        for row in rd:
            n += 1
            if n % 10_000_000 == 0:
                say(f"  {n:,} rows")
            if len(row) != 6:
                stats["price rows: malformed"] += 1
                continue
            now, cur, _old, ppu, _other, hid = row
            out = listing_to_out.get(hid)
            if out is None:
                continue
            stats["price rows: for matched listings"] += 1
            day = now[:8]
            if not (len(day) == 8 and day.isdigit() and "20240201" <= day <= "20271231"):
                stats["price rows dropped: bad date"] += 1
                continue
            mode = mode_of[hid]
            if mode == "per_kg":
                price = per_kg_price(cur, ppu, matched[hid][2])
            elif mode == "unit":
                price = unit_price(cur)
            else:
                price = shelf_price(cur)
            if price is None or price <= 0:
                stats["price rows dropped: unparseable or multi-buy price"] += 1
                continue
            days[out].append(int(day))
            cents[out].append(round(price * 100))
    stats["price rows read"] = n
    say(f"  {n:,} rows read in {time.time() - t0:.0f}s")

    # ---- per (vendor, product): one price per day, drop outliers and stale listings
    max_day = max(max(d) for d in days.values())
    max_date = dt.datetime.strptime(str(max_day), "%Y%m%d").date()
    stale_cutoff = int((max_date - dt.timedelta(days=args.stale_days)).strftime("%Y%m%d"))
    label_of_pid = {p["pid"]: p["label"] for p in product_rows}
    sells, history = [], []
    for (vid, pid) in sorted(days):
        per_day = dict(zip(days[(vid, pid)], cents[(vid, pid)]))  # last row of a day wins
        med = statistics.median(per_day.values())
        item = items[label_of_pid[pid]]
        # Benchmark for this product's own package size (sizes differ by up to --size-tolerance).
        bench = item["price"] * 100 * (product_qty[pid] / item["qty"])
        lo, hi = (1 / 3, 3) if item["mode"] in ("per_kg", "unit") else (0.2, 5)
        keep = {}
        for d, c in per_day.items():
            if not (med / 3 <= c <= med * 3):
                stats["daily prices dropped: >3x from the listing's median (e.g. Walmart 100x)"] += 1
            elif not (bench * lo <= c <= bench * hi):
                stats["daily prices dropped: outside the band around the StatCan benchmark "
                      "(1/3x-3x produce and meat, 0.2x-5x packaged)"] += 1
            else:
                keep[d] = c
        if not keep:
            stats["vendor listings dropped: no usable prices"] += 1
            continue
        last = max(keep)
        if last < stale_cutoff:
            stats[f"vendor listings dropped: no price in the last {args.stale_days} days"] += 1
            continue
        sells.append((vid, pid, f"{keep[last] / 100:.2f}"))
        for d in sorted(keep):
            ds = str(d)
            history.append((vid, pid, f"{ds[:4]}-{ds[4:6]}-{ds[6:]} 00:00:00", f"{keep[d] / 100:.2f}"))

    sold = {pid for _, pid, _ in sells}
    out_products = [p for p in product_rows if p["pid"] in sold]
    stats["products dropped: no vendor left after price filtering"] = len(product_rows) - len(out_products)

    # ---- write CSVs
    os.makedirs(args.out_dir, exist_ok=True)
    write_csv(os.path.join(args.out_dir, "statcan.csv"),
              ["sid", "name", "quantity", "unit", "price", "reference_month"],
              [(it["sid"], it["label"], f"{it['qty']:.3f}", it["unit"], f"{it['price']:.2f}", it["month"].isoformat())
               for it in sorted(items.values(), key=lambda x: x["sid"])])
    write_csv(os.path.join(args.out_dir, "statcan_price_history.csv"), ["sid", "recorded_at", "price"],
              [(items[l]["sid"], d.isoformat(), f"{v:.2f}") for l in sorted(sc_history, key=lambda l: items[l]["sid"])
               for d, v in sorted(sc_history[l])])
    write_csv(os.path.join(args.out_dir, "vendor.csv"), ["vid", "name"],
              [(vid_of[v], VENDOR_NAMES[v]) for v in vendors])
    prow = []
    for p in out_products:
        it, rep = items[p["label"]], p["rep"]
        prow.append((p["pid"], it["sid"], clean_name(rep["product_name"]), clean_brand(rep["brand"]),
                     f"{product_qty[p['pid']]:.3f}", it["unit"], rules[it["base"]].category))
    write_csv(os.path.join(args.out_dir, "product.csv"),
              ["pid", "sid", "name", "brand", "quantity", "unit", "category"], prow)
    write_csv(os.path.join(args.out_dir, "sells.csv"), ["vid", "pid", "price"], sells)
    write_csv(os.path.join(args.out_dir, "price_history.csv"), ["vid", "pid", "recorded_at", "price"], history)

    # ---- report
    stats["final: StatCan"] = len(items)
    stats["final: StatCanPriceHistory"] = sum(len(v) for v in sc_history.values())
    stats["final: Vendor"] = len(vendors)
    stats["final: Product"] = len(out_products)
    stats["final: Sells"] = len(sells)
    stats["final: PriceHistory"] = len(history)
    multi = collections.Counter()
    for _, pid, _ in sells:
        multi[pid] += 1
    stats["final: products sold by 2+ vendors"] = sum(1 for c in multi.values() if c > 1)
    per_item = collections.Counter(p["label"] for p in out_products)
    lines = [f"SmartCart production build, {dt.datetime.now():%Y-%m-%d %H:%M}",
             f"Hammer price data through {max_date}; StatCan through {max(it['month'] for it in items.values())}", ""]
    lines += [f"{k}: {v:,}" if isinstance(v, int) else f"{k}: {v}" for k, v in stats.items()]
    lines += ["", "Products per StatCan item:"]
    lines += [f"{per_item.get(l, 0):6d}  {l}" for l in sorted(items, key=lambda l: -per_item.get(l, 0))]
    report = "\n".join(lines) + "\n"
    with open(os.path.join(args.out_dir, "build-report.txt"), "w", encoding="utf-8") as f:
        f.write(report)
    print(report)
    say(f"Done in {time.time() - t0:.0f}s. CSVs in {args.out_dir}")


if __name__ == "__main__":
    main()
