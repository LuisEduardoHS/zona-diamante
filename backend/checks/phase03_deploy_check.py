"""Read-only public smoke checks; never logs in or purchases in production."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--revision', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    front = 'https://zona-diamante.netlify.app'
    back = 'https://zona-diamante.onrender.com'
    with httpx.Client(timeout=45, follow_redirects=True) as client:
        build = client.get(front+'/build-info.json').json()
        version = client.get(back+'/version').json()
        assert build['revision'] == args.revision, 'Netlify revision not current'
        assert version['revision'] == args.revision, 'Render revision not current'
        health = client.get(back+'/health')
        assert health.status_code == 200 and health.json()['status'] == 'ok'
        catalog = client.get(back+'/api/v1/cards/catalog')
        assert catalog.status_code == 200
        payload = catalog.json()
        assert payload['total_cards'] == len(payload['cards']) > 0
        assert 'points_balance' not in payload
        assert not any({'user_id','is_owned','source','unlocked_at'} & c.keys() for c in payload['cards'])
        private = {path:client.get(back+path).status_code for path in ['/api/v1/cards','/api/v1/ar/mascots','/api/v1/me']}
        assert set(private.values()) == {401}
        pages = {}
        for path in ['/', '/pages/coleccion/coleccion.html','/pages/auth/login.html',
                     '/pages/experiencias/camara.html','/pages/experiencias/trivia.html','/pages/experiencias/juego.html']:
            response = client.get(front+path)
            assert response.status_code == 200, path
            pages[path] = response.status_code
        js = client.get(front+'/js/features/coleccion/collection-page.js')
        assert js.status_code == 200 and 'iniciarColeccion' in js.text
        css = client.get(front+'/css/Collect-Style.css')
        assert css.status_code == 200 and '.col-grid' in css.text
        for path in ['/css/output.css','/vendor/supabase.js','/js/api/collection-client.js']:
            assert client.get(front+path).status_code == 200, path
        preflight = client.options(back+'/api/v1/cards/catalog',headers={'Origin':front,'Access-Control-Request-Method':'GET'})
        assert preflight.headers.get('access-control-allow-origin') == front
        result = {'checked_at_utc':datetime.now(timezone.utc).isoformat(),'revision':args.revision,
                  'netlify':build,'render':version,'health':health.status_code,
                  'catalog_cards':payload['total_cards'],'private_routes':private,'pages':pages,
                  'cors':True,'collection_assets':True,'production_purchase_tested':False}
        Path(args.output).write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))


if __name__ == '__main__':
    main()
