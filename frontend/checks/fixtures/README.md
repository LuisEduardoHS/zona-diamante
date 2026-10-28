# Collection browser fixture

`collection-catalog.json` is the public catalog read on 28 October 2026 (20 active cards, four existing categories, no individual image paths). It has no user, balance, inventory or credentials. It is only consumed by the explicit loopback review server under `checks/phase03-preview.cjs`.

Fixture balances/ownership and purchase responses are synthetic. The production UI always reads FastAPI; this file is never imported by public modules and is not a business rule for catalog size or prices. The separate `--live` review uses disposable Supabase/Auth/FastAPI, not this fixture.
