"""Upload reviewed catalog artwork or verify public copies without changing cards.

From the repo root:
  backend/venv/Scripts/python.exe backend/checks/publish_card_images.py --upload
  backend/venv/Scripts/python.exe backend/checks/publish_card_images.py

Apply the bucket migration first; apply the image assignment migration only after
all public objects pass verification. Secrets are read from backend/.env, never
printed. Object names include content hashes and existing objects are not replaced.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import re
import sys

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from app.core.config import Settings


async def main(upload=False):
    settings = Settings(_env_file=ROOT / 'backend/.env')
    folder = ROOT / 'supabase/assets/card-images'
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    rows = manifest['cards']
    bucket = manifest['bucket']
    if bucket != 'card-images' or len(rows) != 20 or len({row['card_slug'] for row in rows}) != 20:
        raise ValueError('Unexpected artwork manifest.')
    for row in rows:
        if not re.fullmatch(r'\d{8}/[a-z0-9-]+-[a-f0-9]{12}\.(webp|svg)', row['object_path']):
            raise ValueError('Invalid object path.')
        raw = (folder / row['object_path']).read_bytes()
        if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
            raise ValueError('Artwork checksum mismatch: ' + row['card_slug'])
    base = settings.supabase_url.rstrip('/') + '/storage/v1'
    headers = {'apikey': settings.supabase_secret_key}
    if settings.supabase_secret_key.count('.') == 2:
        headers['Authorization'] = 'Bearer ' + settings.supabase_secret_key
    if upload and not settings.supabase_secret_key:
        raise ValueError('Server Storage credentials required for upload.')
    semaphore = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=40) as client:
        async def publish(row):
            async with semaphore:
                path = row['object_path']
                public_url = f'{base}/object/public/{bucket}/{path}'
                response = await client.get(public_url)
                if response.status_code != 200 and upload:
                    result = await client.post(f'{base}/object/{bucket}/{path}',
                                               headers={**headers, 'Content-Type': row['mime_type'],
                                                        'Cache-Control': '31536000', 'x-upsert': 'false'},
                                               content=(folder / path).read_bytes())
                    if not result.is_success:
                        raise RuntimeError(f'Storage upload failed for {row["card_slug"]}: HTTP {result.status_code}')
                    response = await client.get(public_url)
                if response.status_code != 200 or hashlib.sha256(response.content).hexdigest() != row['sha256']:
                    raise RuntimeError('Public artwork unavailable or mismatched: ' + row['card_slug'])
                print('PASS public artwork:', row['card_slug'], flush=True)
        await asyncio.gather(*(publish(row) for row in rows))
    print(f'PASS: {len(rows)} public images match reviewed local files.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upload', action='store_true')
    args = parser.parse_args()
    asyncio.run(main(args.upload))
