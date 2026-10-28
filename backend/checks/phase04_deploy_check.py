"""Read-only production acceptance: public pages/assets/API, never a reward."""
import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--revision',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();front='https://zona-diamante.netlify.app';back='https://zona-diamante.onrender.com'
    out={'checked_at_utc':datetime.now(timezone.utc).isoformat(),'expected_revision':args.revision,
         'authenticated_production_tested':False,'authenticated_reason':'No authorized production test account supplied.'}
    with httpx.Client(timeout=45,follow_redirects=True,headers={'Cache-Control':'no-cache'}) as c:
        build=c.get(front+'/build-info.json');build.raise_for_status();out['netlify']=build.json()
        version=c.get(back+'/version');version.raise_for_status();out['render']=version.json()
        assert out['netlify']['revision']==args.revision,'Netlify revision mismatch'
        assert out['render']['revision']==args.revision,'Render revision mismatch'
        assert c.get(back+'/health').json()['status']=='ok'
        config=c.get(back+'/api/v1/games/beta/config');assert config.status_code==200
        rules=config.json();assert rules['version']=='beta-1' and rules['modes']['classic']['targetHits']==6 and rules['modes']['streak']['targetStreak']==5
        out['game_protocol']=rules['protocol'];out['economy']=rules['economy']
        private=['/api/v1/games/beta/current','/api/v1/cards','/api/v1/me','/api/v1/ar/mascots']
        out['private_routes']={p:c.get(back+p).status_code for p in private};assert set(out['private_routes'].values())=={401}
        out['pages']={}
        for p in ['/','/pages/experiencias/juego.html','/pages/auth/login.html','/pages/auth/perfil.html','/pages/coleccion/coleccion.html','/pages/experiencias/trivia.html','/pages/experiencias/camara.html']:
            r=c.get(front+p);assert r.status_code==200,p;out['pages'][p]=r.status_code
        runtime=c.get(front+'/js/app/runtime-config.js');assert runtime.status_code==200
        assert 'https://zona-diamante.onrender.com' in runtime.text and 'sb_secret_' not in runtime.text and 'localhost:8000' not in runtime.text
        out['public_runtime_safe']=True
        art=c.get(front+'/data/game-beta-art.json');assert art.status_code==200
        out['sprites']=[]
        for frame in art.json()['frames']:
            data=c.get(front+'/'+frame['src']);assert data.status_code==200 and data.content[:4]==b'RIFF'
            local=Path(__file__).parents[2]/'frontend/public'/frame['src']
            assert hashlib.sha256(data.content).hexdigest()==hashlib.sha256(local.read_bytes()).hexdigest()
            out['sprites'].append({'path':frame['src'],'bytes':len(data.content),'matches_repo':True})
        for p in ['/js/features/juego/game-official.js','/js/features/juego/game-page.js','/js/features/juego/game-state.js','/css/juego-Style.css','/css/output.css','/vendor/supabase.js']:
            assert c.get(front+p).status_code==200,p
        public_rules=c.get(front+'/data/game-beta-rules.json').json();assert public_rules['economy']['enabled'] is False
        catalog=c.get(back+'/api/v1/cards/catalog').json();assert catalog['total_cards']==len(catalog['cards'])==20
        assert 'points_balance' not in catalog and all('is_owned' not in item for item in catalog['cards'])
        out['catalog_cards']=catalog['total_cards']
        cors=c.options(back+'/api/v1/games/beta',headers={'Origin':front,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,idempotency-key'})
        assert cors.status_code==200 and cors.headers.get('access-control-allow-origin')==front
        out['cors']=True
        out['auth_rejection_latency_ms']=[]
        for _ in range(3):
            t=time.monotonic();r=c.get(back+'/api/v1/me',headers={'Authorization':'Bearer invalid'});assert r.status_code==401
            out['auth_rejection_latency_ms'].append(round((time.monotonic()-t)*1000))
    Path(args.output).write_text(json.dumps(out,indent=2),encoding='utf-8');print(json.dumps(out))


if __name__=='__main__':main()
