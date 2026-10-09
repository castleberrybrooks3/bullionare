from pathlib import Path
import shutil
import pandas as pd

PATH = Path('sp500_monthly_membership_pit_final.csv')
BACKUP = Path('sp500_monthly_membership_pit_final.before_identity_fix.csv')
META_DATES = {'2021-10-31','2021-11-30','2021-12-31','2022-01-31'}
META_CIK = '0001326801'
CENCORA_CIK = '0001140859'

if not PATH.exists():
    raise RuntimeError(f'Missing file: {PATH.resolve()}')

if not BACKUP.exists():
    shutil.copy2(PATH, BACKUP)

x = pd.read_csv(PATH, dtype=str).fillna('')
dates = pd.to_datetime(x['snapshot_date'], errors='coerce').dt.strftime('%Y-%m-%d')

meta_mask = (
    dates.isin(META_DATES)
    & x['security'].str.contains('Meta', case=False, na=False)
)
cencora_mask = (
    dates.eq('2023-08-31')
    & (
        x['ticker'].str.upper().eq('COR')
        | x['security'].str.contains('Cencora', case=False, na=False)
    )
)

if int(meta_mask.sum()) != 4:
    raise RuntimeError(f'Expected 4 historical Meta rows, found {int(meta_mask.sum())}')
if int(cencora_mask.sum()) != 1:
    raise RuntimeError(f'Expected 1 Cencora row, found {int(cencora_mask.sum())}')

x.loc[meta_mask, 'ticker'] = 'FB'
x.loc[meta_mask, 'cik'] = META_CIK
x.loc[cencora_mask, 'ticker'] = 'COR'
x.loc[cencora_mask, 'cik'] = CENCORA_CIK

if 'pit_resolution_method' in x.columns:
    x.loc[meta_mask, 'pit_resolution_method'] = 'manual_verified_fb'
    x.loc[cencora_mask, 'pit_resolution_method'] = 'manual_verified_cencora'
if 'tradable_at_snapshot' in x.columns:
    x.loc[meta_mask | cencora_mask, 'tradable_at_snapshot'] = 'True'

if x.duplicated(['snapshot_date','ticker']).any():
    raise RuntimeError('Patch created duplicate (snapshot_date, ticker) rows')
if x['cik'].astype(str).str.strip().eq('').any():
    raise RuntimeError('Blank CIK rows remain after patch')

x.to_csv(PATH, index=False)
print('Patched membership file successfully.')
print('Meta/FB rows patched:', int(meta_mask.sum()))
print('Cencora rows patched:', int(cencora_mask.sum()))