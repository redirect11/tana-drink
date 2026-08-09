# =====================================================================
#  Estrae i COSTI AL DETTAGLIO dei prodotti dal GENERATORE ORDINI (o da
#  INV.xlsx). Colonne usate su ogni foglio: "art" (nome), "cl" (contenuto
#  della confezione), "TIPO" (categoria), "€/pz" (costo NETTO per
#  confezione). Da questi si ricava il costo al cl come nell'Excel:
#      €/cl = (€/pz + IVA) / cl
#
#    python scripts/estrai-costi-inventario.py [--file "GEN ORD REC.xlsx"] [--sheet NOME]
#
#  Il generatore ordini ha un foglio per ordine, in ordine cronologico:
#  senza --sheet si scorrono TUTTI e per ogni prodotto si tiene il PREZZO
#  PIÙ RECENTE (l'ultima occorrenza vince). Con --sheet si legge solo quello.
#
#  Scrive costi-inventario.json (dati aziendali: gitignorato). Poi:
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
ap.add_argument('--file', default='GEN ORD REC.xlsx')
ap.add_argument('--sheet', default=None, help='un solo foglio (default: tutti, più recente vince)')
ap.add_argument('--out', default='costi-inventario.json')
ap.add_argument('--vat', type=float, default=22.0, help='aliquota IVA usata nel foglio')
ap.add_argument('--max-rows', type=int, default=1300, help='righe max per foglio (evita i fogli vuoti enormi)')
args = ap.parse_args()

wb = openpyxl.load_workbook(args.file, read_only=True, data_only=True)


def num(v):
    return float(v) if isinstance(v, (int, float)) else None


def find_header(ws):
    """Riga di intestazione (contiene 'art') e indici colonna."""
    for i, row in enumerate(ws.iter_rows(max_row=20, max_col=24, values_only=True), start=1):
        valori = [(j, str(c).strip().lower()) for j, c in enumerate(row) if c]
        if any(v == 'art' for _, v in valori):
            cols = {}
            for j, v in valori:
                if v == 'art':
                    cols['name'] = j
                elif v == 'cl':
                    cols['cl'] = j
                elif v == 'tipo':
                    cols['tipo'] = j
                elif v.startswith('€/pz') or v.endswith('/pz'):
                    cols['cost'] = j
                # DEP = deposito, cioè la GIACENZA in confezioni (0.8 = 8/10
                # di bottiglia). Serve a riallineare il magazzino, non solo
                # il costo.
                elif v == 'dep':
                    cols['dep'] = j
            if 'name' in cols and 'cost' in cols:
                return i, cols
    return None, None


def read_sheet(ws, into):
    """Legge un foglio e aggiorna `into` (nome normalizzato → prodotto):
    l'ultima occorrenza (foglio più recente) sovrascrive."""
    header_row, cols = find_header(ws)
    if header_row is None:
        return 0
    added = 0
    for k, row in enumerate(ws.iter_rows(min_row=header_row + 1, max_col=24, values_only=True)):
        if k > args.max_rows:
            break
        nome = row[cols['name']]
        if not isinstance(nome, str) or not nome.strip():
            continue
        costo = num(row[cols['cost']])
        if costo is None or costo <= 0:
            continue
        cl = num(row[cols['cl']]) if 'cl' in cols else None
        dep = num(row[cols['dep']]) if 'dep' in cols else None
        nome = nome.strip()
        into[nome.lower()] = {
            'name': nome,
            'cl': cl,
            'tipo': (row[cols['tipo']] or '').strip() if 'tipo' in cols and row[cols['tipo']] else None,
            'cost': round(costo, 4),  # NETTO per confezione
            'vat': args.vat,
            'package_size_ml': int(round(cl * 10)) if cl else None,
            'cost_per_cl': round(costo * (1 + args.vat / 100) / cl, 6) if cl else None,
            # Giacenza in CONFEZIONI dall'ultimo foglio che nomina il prodotto.
            'dep': round(dep, 4) if dep is not None and dep >= 0 else None,
        }
        added += 1
    return added


latest = {}
if args.sheet:
    if args.sheet not in wb.sheetnames:
        sys.exit(f'Foglio "{args.sheet}" assente.')
    read_sheet(wb[args.sheet], latest)
    origine = args.sheet
else:
    # Tutti i fogli in ordine: l'ultimo che nomina un prodotto ne fissa il
    # prezzo corrente (i fogli sono cronologici).
    fogli = 0
    for name in wb.sheetnames:
        if read_sheet(wb[name], latest):
            fogli += 1
    origine = f'{fogli} fogli del generatore'

prodotti = sorted(latest.values(), key=lambda p: p['name'].lower())
with open(args.out, 'w', encoding='utf-8') as f:
    json.dump({'sheet': origine, 'vat': args.vat, 'products': prodotti}, f, ensure_ascii=False, indent=2)

con_dep = sum(1 for p in prodotti if p.get('dep') is not None)
print(f'[costi] {origine}: {len(prodotti)} prodotti con prezzo più recente.')
print(f'[costi] {con_dep} con la giacenza (colonna DEP).')
print(f'[costi] scritto {args.out}')
