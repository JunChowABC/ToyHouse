"""Stage the latest Web changes into the currently published independent Lua port."""
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'output/maker-ui-sync'
MAKER=pathlib.Path(r'D:\AI游戏\晚安，玩具屋-Maker')
view=(MAKER/'scripts/View.lua').read_text('utf-8-sig')
main=(MAKER/'scripts/main.lua').read_text('utf-8-sig')
assert "require('Loading')" not in main,'Already migrated'
(OUT/'View.before-loading.lua').write_text(view,encoding='utf-8')
(OUT/'main.before-loading.lua').write_text(main,encoding='utf-8')
start=view.index('function V.loadImages()');end=view.index('function V.box',start)
view=view[:start]+'''local function assetGroups(kind)
    local currencyAssets,playAssets={},{}
    for id,a in pairs(D.core.assets) do
        if a.group=='06_RESOURCES' then currencyAssets[id]=a else playAssets[id]=a end
    end
    local groups={home={D.home.assets,currencyAssets},play={playAssets},settings={D.pause.assets,D.tool.assets,D.tool.disabled},complete={D.complete.assets},loading={uiData.loading.assets}}
    if kind then return assert(groups[kind],'Unknown asset group') end
    return {D.core.assets,D.home.assets,D.pause.assets,D.complete.assets,D.tool.assets,D.tool.disabled,uiData.loading.assets}
end
function V.loadImages(kind,optional)
    for _,group in ipairs(assetGroups(kind)) do
        for _,a in pairs(group) do if not V.images[a.file] then
            local id=nvgCreateImage(V.vg,a.file,0)
            if id>0 then V.images[a.file]=id elseif not optional then error('Image unavailable: '..a.file) end
        end end
    end
end
function V.files(kind)
    local seen,files={},{}
    for _,group in ipairs(assetGroups(kind)) do
        for _,a in pairs(group) do if not seen[a.file] then seen[a.file]=true;files[#files+1]=a.file end end
    end
    return files
end
'''+view[end:]
view=view.replace("art(b.id..'_label')", "sourceText('txt_'..b.id,b.label)")
view=view.replace('nvgRestore(v);currency(g,true)','nvgRestore(v);currency(g,false)')
# Home manifests now contain only enabled controls with precomputed compact positions.
start=view.index('local homeLabels=');end=view.index('function V.home(g)',start)
view=view[:start]+view[end:]
view=view.replace("    if notice then V.box({125,587,290,36},'#fff7f0',16);V.text(notice.text,270,605,15,'#914963') end\n",'')
loading='''function V.loading(progress,failed)
    local A=uiData.loading;local v=V.vg
    progress=math.max(0,math.min(1,progress or 0))
    V.box({0,0,540,960},'#fae7e4');nvgSave(v);nvgTranslate(v,0,offset);nvgScale(v,scale,scale)
    local track=A.assets.ui_progress_track.bounds
    for _,id in ipairs(A.layers) do
        local a=A.assets[id];local b=a.bounds
        if id=='ui_progress_fill' then
            if progress>0 then local f=A.assets.progress_fitted;local r=f.bounds
                nvgSave(v);nvgIntersectScissor(v,r[1],r[2],r[3]*progress,r[4]);img(f,r);nvgRestore(v)
            end
        elseif id=='ui_progress_star' then
            if progress>0 then local x=math.max(track[1]+2,math.min(track[1]+track[3]-b[3]-2,track[1]+2+(track[3]-4)*progress-b[3]/2));img(a,{x,b[2],b[3],b[4]}) end
        else img(a,b) end
    end
    local s=A.text
    specText(s,failed and '暂时没准备好，请重试一下吧～' or s.text)
    if not V.images[A.assets.art_loading_title.file] then
        V.text(failed and '暂时没准备好，请重试' or '正在布置玩具屋…',470.5,1320,34,s.color)
        V.box({170,1390,600,34},'#efd0e7');V.box({170,1390,600*progress,34},'#eb80b9')
    end
    nvgRestore(v)
end
'''
view=view.replace('function V.draw(g)',loading+'function V.draw(g)')
main=main.replace("local View=require('View')", "local View=require('View')\nlocal Loading=require('Loading')\nlocal loader=nil")
start=main.index('local function loadAssets()');end=main.index('function Start()',start)
main=main[:start]+'''local function loadAssets()
    loader:request('home',function() ready=true;print('TOYHOUSE home_assets_ready') end,true)
end
'''+main[end:]
main=main.replace('    Save.load(loadedProfile);loadAssets();', "    loader=Loading.new(View,cache,function() return elapsed end);loader:loadDecorations()\n    Save.load(loadedProfile);loadAssets();")
main=main.replace('    View.updateNotice(dt)','    if loader then loader:update() end')
main=main.replace('if game and ready and not Save.blocked() then game:update(dt) end',"""if game and ready and not loader.pending and not Save.blocked() then
        game:update(dt)
        if game.mode=='level-complete' and not loader.ready.complete then loader:request('complete',function() end) end
    end""")
start=main.index('    if ready and game then View.draw(game)');end=main.index('    elseif Save.error then',start)
main=main[:start]+'''    if loader and loader.pending then
        local r=loader.pending;View.loading(r.progress,r.error)
        if r.error then View.box({170,520,200,52},'#fff1eb',20);View.text('重试',270,546,20,'#8b5e4d') end
        if not r.initial then View.box({170,900,200,40},'#fff1eb',20);View.text('返回',270,920,18,'#8b5e4d') end
        nvgEndFrame(vg);return
    end
    if ready and game then View.draw(game) else View.loading(0,false) end
    if not ready then
        -- The initial request owns entry readiness.
'''+main[end:]
main=main.replace('local function action(id)','local function performAction(id)')
main=main.replace("    elseif id and id:match('^home%.') then View.showHomeNotice(id:sub(6))\n",'')
start=main.index('local function pointerDown')
main=main[:start]+'''local function action(id)
    local group=nil
    if id=='home.start' then group='play'
    elseif id=='home.settings' or id=='play.pause' or id=='play.remove' or id=='play.shuffle' or id=='play.flip' then group='settings' end
    if group then loader:request(group,function() performAction(id) end) else performAction(id) end
end
local function cancelLoading()
    if loader:cancel() and game and game.mode=='level-complete' then game:home() end
end
'''+main[start:]
main=main.replace('    if assetError then loadAssets();return end', '''    ---@type ToyhouseLoadRequest?
    local pending=loader.pending
    if pending then
        if pending.error and View.contains({170,520,200,52},x,y) then loader:retry()
        elseif View.contains({170,900,200,40},x,y) then cancelLoading() end
        return
    end''')
main=main.replace('function HandleKeyDown(_,d)\n', '''function HandleKeyDown(_,d)
    if loader and loader.pending then if d:GetInt('Key')==KEY_ESCAPE then cancelLoading() end;return end
''')
main=main.replace("elseif game.mode=='play' or game.mode=='home' then game.pause=not game.pause end", "elseif game.pause then game.pause=false elseif game.mode=='play' then action('play.pause') elseif game.mode=='home' then action('home.settings') end")
main=main.replace("game:openTool('remove') elseif key==KEY_2 then game:openTool('shuffle') elseif key==KEY_3 then game:openTool('flip')", "action('play.remove') elseif key==KEY_2 then action('play.shuffle') elseif key==KEY_3 then action('play.flip')")
main=main.replace('control=game and View.hit(game,x,y),inside=true}', 'control=game and View.hit(game,x,y),inside=true,loading=loader and loader.pending~=nil}')
main=main.replace('    if Save.error then\n', '    if pressed.loading then return end\n    if Save.error then\n')
main=main.replace('local ready=false;local assetError=nil;local assetProgress=0;local assetBusy=false','local ready=false')
for name,text in [('View',view),('main',main)]: (OUT/'scripts'/f'{name}.lua').write_text(text,encoding='utf-8')
(OUT/'scripts/Loading.lua').write_text((ROOT/'scripts/maker/Loading.lua').read_text('utf-8'),encoding='utf-8')
print('Staged program labels, compact home, background3 and cancelable staged loading')
