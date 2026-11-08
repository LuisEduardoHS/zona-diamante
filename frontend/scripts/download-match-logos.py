"""Refresh local full-color LMB/LMP logos from MLB's public asset CDN."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.request import urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'public'
DESTINATION = ROOT / 'assets/img/partidos'


def download(team):
    source = f'https://www.mlbstatic.com/team-logos/{team["id"]}.svg'
    try:
        with urlopen(source, timeout=25) as response:
            data = response.read()
        document = ET.fromstring(data)
        if not document.tag.endswith('svg'):
            raise ValueError('Not an SVG')
        (DESTINATION / f'{team["id"]}.svg').write_bytes(data)
        return {'id': team['id'], 'name': team['name'], 'source': source,
                'path': f'assets/img/partidos/{team["id"]}.svg'}
    except Exception as error:
        print(f'Logo unavailable for {team["name"]}: {error}')
        return None


if __name__ == '__main__':
    DESTINATION.mkdir(parents=True, exist_ok=True)
    teams = {}
    for sport, league in [(23, 125), (17, 132)]:
        url = f'https://statsapi.mlb.com/api/v1/teams?sportId={sport}&leagueIds={league}&season=2026'
        with urlopen(url, timeout=25) as response:
            for team in json.load(response)['teams']:
                teams[team['id']] = team
    with ThreadPoolExecutor(max_workers=6) as pool:
        logos = [logo for logo in pool.map(download, teams.values()) if logo]
    manifest = {'provider': 'MLB / MLBstatic', 'downloaded_at': datetime.now(timezone.utc).isoformat(),
                'logos': sorted(logos, key=lambda logo: logo['id'])}
    (ROOT / 'data/match-logos.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Saved {len(logos)}/{len(teams)} local team logos.')
