"""Install a reviewed, validated stage with backups and concurrent-change guards."""
import hashlib,json,pathlib,shutil,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/maker-current-release'
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker').resolve()
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None
if '--prepare' in sys.argv:
    manifest=[]
    for file in list((STAGE/'scripts').glob('*.lua'))+list((STAGE/'assets').rglob('*.png')):
        relative=file.relative_to(STAGE).as_posix();target=MAKER/relative
        manifest.append({'path':relative,'before':digest(target),'after':digest(file)})
        if target.exists():
            backup=STAGE/'before-maker'/relative;backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,backup)
    (STAGE/'sync-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Prepared guarded Maker sync:',len(manifest),'files, existing files backed up')
else:
    manifest=json.loads((STAGE/'sync-manifest.json').read_text('utf-8'))
    for entry in manifest:
        target=(MAKER/entry['path']).resolve();assert target.is_relative_to(MAKER),target
        assert digest(target)==entry['before'],'Concurrent Maker edit: '+entry['path']
        assert digest(STAGE/entry['path'])==entry['after'],'Stage changed: '+entry['path']
    for entry in manifest:
        target=MAKER/entry['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(STAGE/entry['path'],target)
        assert digest(target)==entry['after'],target
    print('Installed and SHA256 verified:',len(manifest),'production files')
