"""
The Census figures the Call List ranks trades by, for public.call_trade_metrics.

For each trade on the list, over the Houston-area counties it covers: how many
businesses run with no staff (Nonemployer Statistics) against how many employ
people (County Business Patterns), and what a one-person business in the trade
takes in a year. The first is the Call List's measure of whether the owner is
the one who answers; the second is its measure of whether they can pay.

Both files are free downloads from the Census and need no key:

  https://www2.census.gov/programs-surveys/cbp/datasets/2022/cbp22co.zip
  https://www2.census.gov/programs-surveys/nonemployer-statistics/datasets/2022/historical-datasets/nonemp22co.zip

Unzip both into one folder and run:

  python3 scripts/db/census-trade-metrics.py <folder> > metrics.sql

The output is one insert, run against the database, that replaces every row.
A new trade on the list gets a line in TRADES; a new Census year changes the two
file names and YEAR.
"""

import csv
import sys

YEAR = 2022

# Harris, Galveston, Chambers, Brazoria, Fort Bend, Montgomery, Liberty.
COUNTIES = {'201', '167', '071', '039', '157', '339', '291'}

# Each trade's industry code. The two files do not carry every code at the
# same detail, so the code used is the most detailed one both carry, and the
# name stored is the name of that code rather than of the one asked for.
TRADES = {
    'auto repair': '8111',
    'real estate agency': '531210',
    'hair salon': '812112',
    'insurance agency': '524210',
    'printing': '3231',
    'fitness': '713940',
    'accountant': '5412',
    'HVAC contractor': '238220',
    'storage': '531130',
    'industrial contractor': '236210',
    'youth sports': '611620',
    'flooring contractor': '238330',
    'roofing contractor': '238160',
    'barber shop': '812111',
    'restaurant': '7225',
    'electrician': '238210',
    'machine shop': '332710',
    'landscaping': '561730',
    'concrete contractor': '238110',
    'welding': '811490',
    'plumber': '238220',
    'painting contractor': '238320',
    'pool service': '561790',
    'marine services': '4883',
    'pest control': '561710',
    'tree service': '561730',
    'title company': '541191',
    'towing service': '488410',
    'fencing contractor': '238990',
    'dentist': '621210',
    'law firm': '541110',
    'chiropractor': '621310',
    'veterinarian': '541940',
    'go kart track': '713990',
    # What a listing filed under a trade can turn out to be: a supplier or a
    # plant rather than a contractor, scored against its own industry.
    'concrete plant': '3273',
    'building supply': '4441',
    'wholesale supplier': '423',
    'manufacturer': '31-33',
}

NAMES = {
    '8111': 'Automotive repair and maintenance',
    '53121': 'Offices of real estate agents and brokers',
    '812112': 'Beauty salons',
    '52421': 'Insurance agencies and brokerages',
    '3231': 'Printing and related support activities',
    '7139': 'Other amusement and recreation industries',
    '5412': 'Accounting, tax preparation, bookkeeping and payroll services',
    '23822': 'Plumbing, heating and air-conditioning contractors',
    '5311': 'Lessors of real estate',
    '2362': 'Nonresidential building construction',
    '611': 'Educational services',
    '2383': 'Building finishing contractors',
    '2381': 'Foundation, structure and building exterior contractors',
    '812111': 'Barber shops',
    '7225': 'Restaurants and other eating places',
    '23821': 'Electrical contractors and other wiring installation contractors',
    '332': 'Fabricated metal product manufacturing',
    '56173': 'Landscaping services',
    '81149': 'Other personal and household goods repair and maintenance',
    '56179': 'Other services to buildings and dwellings',
    '488': 'Support activities for transportation',
    '56171': 'Exterminating and pest control services',
    '5411': 'Legal services',
    '2389': 'Other specialty trade contractors',
    '62121': 'Offices of dentists',
    '62131': 'Offices of chiropractors',
    '54194': 'Veterinary services',
    '3273': 'Cement and concrete product manufacturing',
    '4441': 'Building material and supplies dealers',
    '423': 'Merchant wholesalers, durable goods',
    '31-33': 'Manufacturing',
}

# A sector spans several codes in County Business Patterns and one in
# Nonemployer Statistics, so its employers are the sum of its parts.
SECTORS = {'31-33': ('31', '32', '33')}


def number(value):
    try:
        return float(str(value).strip())
    except ValueError:
        return None


def read(folder):
    employers, solo, sales = {}, {}, {}
    with open(f'{folder}/cbp{YEAR % 100}co.txt', newline='') as f:
        for row in csv.DictReader(f):
            if row['fipstate'] == '48' and row['fipscty'] in COUNTIES:
                code = row['naics'].replace('/', '').replace('-', '')
                est = number(row['est'])
                if est is not None:
                    employers[code] = employers.get(code, 0) + est
    with open(f'{folder}/nonemp{YEAR % 100}co.txt', newline='') as f:
        for row in csv.DictReader(f):
            if row['ST'] == '48' and row['CTY'] in COUNTIES:
                code = row['NAICS'].strip()
                estab, receipts = number(row['ESTAB']), number(row['RCPTOT'])
                if estab is not None:
                    solo[code] = solo.get(code, 0) + estab
                if receipts is not None:
                    sales[code] = sales.get(code, 0) + receipts
    return employers, solo, sales


def level(code, employers, solo):
    """The most detailed code both files carry."""
    if code in SECTORS:
        return code
    while len(code) > 3 and not (solo.get(code) and employers.get(code) is not None):
        code = code[:-1]
    return code


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def main(folder):
    employers, solo, sales = read(folder)
    rows = []
    for trade, wanted in TRADES.items():
        code = level(wanted, employers, solo)
        no_staff = solo.get(code)
        with_staff = (
            sum(employers.get(part, 0) for part in SECTORS[code])
            if code in SECTORS
            else employers.get(code)
        )
        if not no_staff or with_staff is None:
            print(f'-- no figures for {trade} ({wanted})', file=sys.stderr)
            continue
        # Receipts are in thousands of dollars.
        average = round(sales.get(code, 0) * 1000 / no_staff)
        share = round(no_staff / (no_staff + with_staff), 4)
        rows.append(
            '(' + ', '.join([
                quote(trade), quote(code), quote(NAMES.get(code, code)), str(int(no_staff)),
                str(int(with_staff)), str(share), str(average), str(YEAR),
            ]) + ')'
        )
    print('insert into public.call_trade_metrics (trade, naics, industry, firms_no_staff, '
          'firms_with_staff, solo_share, avg_sales, source_year) values')
    print(',\n'.join(rows))
    print('on conflict (trade) do update set naics = excluded.naics, industry = excluded.industry, '
          'firms_no_staff = excluded.firms_no_staff, firms_with_staff = excluded.firms_with_staff, '
          'solo_share = excluded.solo_share, avg_sales = excluded.avg_sales, '
          'source_year = excluded.source_year, updated_at = now();')


if __name__ == '__main__':
    main(sys.argv[1])
