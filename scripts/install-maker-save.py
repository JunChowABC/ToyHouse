"""Install tested cloud-save modules into the separately bound Maker checkout."""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
OUT=ROOT/'output/save-r7';OUT.mkdir(parents=True,exist_ok=True)
names=['Save.lua','SaveCodec.lua','main.lua']
digest=lambda b:hashlib.sha256(b).hexdigest()
if '--prepare' in sys.argv:
    manifest={}
    for name in names:
        target=MAKER/'scripts'/name
        previous=target.read_bytes() if target.exists() else None
        manifest[name]=digest(previous) if previous is not None else None
        if previous is not None:(OUT/('before-'+name)).write_bytes(previous)
    main=(MAKER/'scripts/main.lua').read_text('utf-8-sig')
    old="..' · R6'";assert old in main
    (OUT/'main.lua').write_text(main.replace(old,"..' · '..Save.version"),encoding='utf-8')
    (OUT/'install.json').write_text(json.dumps(manifest),encoding='utf-8')
else:
    manifest=json.loads((OUT/'install.json').read_text('utf-8'))
    for name in names:
        target=MAKER/'scripts'/name
        assert (digest(target.read_bytes()) if target.exists() else None)==manifest[name],f'Concurrent edit: {name}'
    for name in names:
        source=(OUT if name=='main.lua' else ROOT/'scripts/maker')/name
        data=source.read_bytes();assert b'__toyhouse_debug' not in data and b'local-gm' not in data
        (MAKER/'scripts'/name).write_bytes(data)
    print('Installed Save.lua, SaveCodec.lua and R7 diagnostic label with hash guards')
