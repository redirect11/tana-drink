# =====================================================================
#  Estrae i COSTI AL DETTAGLIO dei prodotti dal foglio INV.xlsx.
#
#    python scripts/estrai-costi-inventario.py [--file INV.xlsx] [--sheet ULTIMO]
#
#  Il foglio di inventario ha una scheda per periodo; l'ultima è la più
#  aggiornata. Colonne usate: "art" (nome), "cl" (contenuto della
#  confezione), "TIPO" (categoria), "€/pz" (costo NETTO della confezione).
#  Da questi si ricava il costo al cl/ml esattamente come fa l'Excel:
#      €/cl = (€/pz + IVA) / cl
#
#  Scrive costi-inventario.json (dati aziendali: NON va committato, è già
#  coperto da .gitignore). Poi:
#      node scripts/import-costi-inventario.js            # anteprima
#      node scripts/import-costi-inventario.js --apply    # scrive
# =====================================================================
import argparse
import json
import sys

try:
    import openpyxl
except ImportError:
    sys.exit('Serve openpyxl: pip install openpyxl')

ap = argparse.ArgumentParser()
ap.add_argument('--file', default='INV.xlsx')
ap.add_argument('--sheet', default=None, help='nome foglio (default: l\'ultimo)')
ap.add_argument('--out', default='costi-inventario.json')
ap.add_argument('--vat', type=float, default=22.0, help='aliquota IVA usata nel foglio')
args = ap.parse_args()

wb = openpyxl.load_workbook(args.file, read_only=True, data_only=True)
sheet = args.sheet or wb.sheetnames[-1]
if sheet not in wb.sheetnames:
    sys.exit(f'Foglio "{sheet}" assente. Disponibili: {wb.sheetnames}')
ws = wb[sheet]

# Trova la riga di intestazione (quella che contiene "art").
header_row, cols = None, {}
for i, row in enumerate(ws.iter_rows(max_row=20, max_col=20, values_only=True), start=1):
    valori = [(j, str(c).strip().lower()) for j, c in enumerate(row) if c]
    if any(v == 'art' for _, v in valori):
        header_row = i
        for j, v in valori:
            if v == 'art':
                cols['name'] = j
            elif v == 'cl':
                cols['cl'] = j
            elif v == 'tipo':
                cols['tipo'] = j
            elif v.startswith('€/pz') or v.endswith('/pz'):
                cols['cost'] = j
        break
if header_row is None or 'name' not in cols or 'cost' not in cols:
    sys.exit(f'Intestazione non riconosciuta nel foglio "{sheet}" (servono "art" e "€/pz").')

num = lambda v: float(v) if isinstance(v, (int, float)) else None

prodotti, senza_costo = [], 0
for row in ws.iter_rows(min_row=header_row + 1, max_col=20, values_only=True):
    nome = row[cols['name']]
    if not isinstance(nome, str) or not nome.strip():
        continue
    costo = num(row[cols['cost']])
    cl = num(row[cols['cl']]) if 'cl' in cols else None
    if costo is None or costo <= 0:
        senza_costo += 1
        continue
    prodotti.append({
        'name': nome.strip(),
        'cl': cl,
        'tipo': (row[cols['tipo']] or '').strip() if 'tipo' in cols and row[cols['tipo']] else None,
        'cost': round(costo, 4),          # NETTO per confezione
        'vat': args.vat,
        'package_size_ml': int(round(cl * 10)) if cl else None,
        'cost_per_cl': round(costo * (1 + args.vat / 100) / cl, 6) if cl else None,
    })

with open(args.out, 'w', encoding='utf-8') as f:
    json.dump({'sheet': sheet, 'vat': args.vat, 'products': prodotti}, f, ensure_ascii=False, indent=2)

print(f'[costi] foglio "{sheet}": {len(prodotti)} prodotti con costo, {senza_costo} senza.')
print(f'[costi] scritto {args.out}')
