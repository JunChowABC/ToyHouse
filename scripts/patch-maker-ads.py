"""Stage Maker ad integration without changing unrelated UI or gameplay."""
import pathlib, hashlib, json, shutil
from PIL import Image, ImageOps
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
OUT=ROOT/'output/maker-ad-integration'
(OUT/'scripts').mkdir(parents=True,exist_ok=True)
hashes={}
def read(name):
    p=MAKER/'scripts'/f'{name}.lua';hashes[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
    return p.read_text('utf-8-sig')
def change(text,old,new):
    assert text.count(old)==1,old
    return text.replace(old,new)
game=read('Game');main=read('main');view=read('View')
game=change(game,"self.combo=0;self.comboUntil=0;self.pause=false;self.modal=nil;self.tool=nil", "self.combo=0;self.comboUntil=0;self.pause=false;self.modal=nil;self.tool=nil;self.adPending=false")
game=change(game,'self:cancelTool();self.modal=id','self:cancelTool();self.modal=id;self.adMessage=nil')
game=change(game,"local id=self.modal;if not id or self:unavailable(id)~='' then return end", "local id=self.modal;if self.adPending or not id or self:unavailable(id)~='' then return end")
main=change(main,"local Save=require('Save')", "local Save=require('Save')\nlocal RewardedAds=require('RewardedAds')\nlocal ads=nil")
main=change(main,'---@field VibrateShort', '---@field ShowRewardVideoAd fun(self: ToyhouseSdk, callback: fun(result: table)): boolean\n---@field VibrateShort')
main=change(main,'local function loadedProfile(profile) game=Game.new(profile,Save.mark,playSound) end', '''local function loadedProfile(profile)
    if ads then ads:stop() end
    game=Game.new(profile,Save.mark,playSound)
    ads=RewardedAds.new(game,function(done) return platform:ShowRewardVideoAd(done) end)
end''')
main=change(main,'function Stop()\n', 'function Stop()\n    if ads then ads:stop() end\n')
main=change(main,"    if loader then loader:update() end", "    if ads then ads:update(data:GetFloat('TimeStep')) end\n    if loader then loader:update() end")
main=change(main,'local function performAction(id)\n', 'local function performAction(id)\n    if game.adPending then return end\n')
main=change(main,"    elseif id=='tool.action' then game:confirmTool()", "    elseif id=='tool.action' then game:confirmTool()\n    elseif id=='tool.ad' then if ads then ads:watch() end")
main=change(main,"if game and game.mode=='play' then game:cancelTool();game.modal=nil;game.pause=true end", "if game and game.mode=='play' and not game.adPending then game:cancelTool();game.modal=nil;game.pause=true end")
main=change(main,"    if not game or not ready or Save.blocked() then return end", "    if not game or not ready or Save.blocked() or game.adPending then return end")
extra="""local adArt={
    buy={file='toyhouse-ui-v2/ads/ui_tool_buy_yellow_v3.png'},
    ad={file='toyhouse-ui-v2/ads/ui_tool_ad_pink_v3.png'},
    icon={file='toyhouse-ui-v2/ads/ui_rewarded_ad_v3.png'},
    buyOff={file='toyhouse-ui-v2/ads/buy_disabled.png'},
    adOff={file='toyhouse-ui-v2/ads/ad_disabled.png'},
}
local toolAction={204,1122,254,143}
local toolAd={479,1122,254,143}
"""
view=change(view,'local V={images={},pressed=nil}',extra+'local V={images={},pressed=nil}')
view=change(view,'settings={D.pause.assets,D.tool.assets,D.tool.disabled}', 'settings={D.pause.assets,D.tool.assets,D.tool.disabled,adArt}')
view=change(view,'return {D.core.assets,D.home.assets,D.pause.assets,D.complete.assets,D.tool.assets,D.tool.disabled,uiData.loading.assets}', 'return {D.core.assets,D.home.assets,D.pause.assets,D.complete.assets,D.tool.assets,D.tool.disabled,adArt,uiData.loading.assets}')
start=view.index("    feedback('tool.action',T.assets.purchase_base.bounds,function()")
end=view.index('    panelEnd()',start)
view=view[:start]+'''    feedback('tool.action',toolAction,function()
        local disabled=reason~='' or g.adPending
        img(disabled and adArt.buyOff or adArt.buy,toolAction,disabled and .75 or 1)
        local fill=disabled and '#aaaaaa' or '#AC77AE'
        if buying then
            V.text('购买',330,1169.5,33,fill,180,'#FFFCF5')
            img(T.assets.purchase_coin,{270,1196,35,36})
            V.text('100',350,1213,28,fill,80,'#FFFCF5')
        else V.text('使用',330,1191.5,33,fill,180,'#FFFCF5') end
    end)
    feedback('tool.ad',toolAd,function()
        img(g.adPending and adArt.adOff or adArt.ad,toolAd,g.adPending and .75 or 1)
        img(adArt.icon,{498,1152,72,72})
        V.text(g.adPending and '观看中' or '看广告',640,1169.5,32,'#B575A1',138,'#FFF8FC')
        V.text('获得 1 个',640,1212.5,24,'#B575A1',150,'#FFF8FC')
    end)
    if g.adMessage then V.text(g.adMessage,470.5,1289,21,'#98669F',531) end
'''+view[end:]
view=change(view,"    if g.modal then add('tool.close',rect(D.tool.assets.close_base.bounds));if g:unavailable(g.modal)=='' then add('tool.action',rect(D.tool.assets.purchase_base.bounds)) end", "    if g.adPending then return result end\n    if g.modal then add('tool.close',rect(D.tool.assets.close_base.bounds));add('tool.ad',rect(toolAd));if g:unavailable(g.modal)=='' then add('tool.action',rect(toolAction)) end")
for name,text in [('Game',game),('main',main),('View',view)]:
    (OUT/'scripts'/f'{name}.lua').write_text(text,encoding='utf-8')
shutil.copyfile(ROOT/'scripts/maker/RewardedAds.lua',OUT/'scripts/RewardedAds.lua')
assets=OUT/'assets/toyhouse-ui-v2/ads';assets.mkdir(parents=True,exist_ok=True)
for name in ('ui_tool_buy_yellow_v3','ui_tool_ad_pink_v3','ui_rewarded_ad_v3'):
    shutil.copyfile(ROOT/'assets/tool-dialog-v1'/f'{name}.png',assets/f'{name}.png')
for name,source in [('buy','ui_tool_buy_yellow_v3'),('ad','ui_tool_ad_pink_v3')]:
    im=Image.open(assets/f'{source}.png').convert('RGBA');gray=ImageOps.grayscale(im).convert('RGBA');gray.putalpha(im.getchannel('A'));gray.save(assets/f'{name}_disabled.png')
(OUT/'original-hashes.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2),encoding='utf-8')
print('Staged Maker scripts and 5 ad UI assets')
