"""Stage the current Maker view with the published home-screen2 UI and controls."""
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/maker-ui-sync'
MAKER=pathlib.Path(r'D:\AI游戏\晚安，玩具屋-Maker')
view=(MAKER/'scripts/View.lua').read_text('utf-8-sig')
main=(MAKER/'scripts/main.lua').read_text('utf-8-sig')
if 'home=uiData.home' in view:
    raise SystemExit('Home UI already migrated; do not apply the patch twice')
(STAGE/'View.before-home.lua').write_text(view,encoding='utf-8')
(STAGE/'main.before-home.lua').write_text(main,encoding='utf-8')
view=view.replace('home=original.home','home=uiData.home')
view=view.replace('D.home.assets,D.shared.assets,','D.home.assets,')
start=view.index('local settingsRects=')
end=view.index('\nlocal tools=',start)
view=view[:start]+'''local function shiftedSettings(b) return {b[1],b[2]+180,b[3],b[4]} end
local settingsBounds={close=shiftedSettings(D.tool.assets.close_base.bounds)}
for _,key in ipairs({'music','audio','vibration'}) do settingsBounds[key]=shiftedSettings(pauseBounds[key]) end
local settingsRects={};for key,b in pairs(settingsBounds) do settingsRects[key]=rect(b) end
'''+view[end:]
start=view.index('function V.home(g)')
end=view.index('-- Native PNG eye anchors',start)
view=view[:start]+'''local homeLabels={task='任务',event='活动',mail='邮箱',signin='七日签到',album='图鉴',dress='装扮'}
local notice=nil
function V.showHomeNotice(key)
    if homeLabels[key] then notice={text=homeLabels[key]..'功能敬请期待',remaining=2.2} end
end
function V.updateNotice(dt)
    if notice then notice.remaining=notice.remaining-dt;if notice.remaining<=0 then notice=nil end end
end
function V.home(g)
    local v=V.vg;V.box({0,0,540,960},'#fbe6e7');nvgSave(v);nvgTranslate(v,0,offset);nvgScale(v,scale,scale)
    local index=g:nextIndex();local progress='更多夜晚准备中'
    if index then
        local l=D.levels.levels[index];local day=0;for i=1,index do if D.levels.levels[i].chapter_id==l.chapter_id then day=day+1 end end
        local night=l.chapter_id==1 and '一' or l.chapter_id==2 and '二' or tostring(l.chapter_id)
        progress='第'..night..'夜 · 第'..day..'关'
    end
    for _,id in ipairs(D.home.layers) do
        if index or id~='art_start_title' then
            local a=D.home.assets[id]
            local function paint() img(a,a.bounds,(a.opacity or 1)*(not index and a.control=='start' and .68 or 1)) end
            if a.control then feedback('home.'..a.control,D.home.controls[a.control],paint) else paint() end
        end
    end
    for _,s in ipairs(D.home.textLayers) do
        local function paint() specText(s,s.name=='txt_date' and progress or s.text) end
        if s.control then feedback('home.'..s.control,D.home.controls[s.control],paint) else paint() end
    end
    if not index then
        V.text('今晚好梦',463.5,1315,55,'#FFF5BC',313,'#EE70A5')
        V.text(progress,475,1466,25,'#914963',350)
    end
    nvgRestore(v);currency(g,true)
    if notice then V.box({125,587,290,36},'#fff7f0',16);V.text(notice.text,270,605,15,'#914963') end
end
'''+view[end:]
start=view.index('    if home then\n',view.index('function V.pause(g,home)'))
end=view.index('    else\n        local P=D.pause',start)
view=view[:start]+'''    if home then
        local P=D.pause
        local function image(id,b) img(P.assets[id],shiftedSettings(b or P.assets[id].bounds)) end
        img(P.assets.home_settings_frame,P.assets.home_settings_frame.bounds)
        for _,id in ipairs(P.staticLayers) do
            if id~='panel_base' and not id:match('^arttext_') and not id:match('^restart_') and not id:match('^continue_') and not id:match('^exit_') and id~='music_icon' and id~='sound_icon' and id~='vibration_icon' then
                local b={table.unpack(P.assets[id].bounds)}
                if id:match('^star_bottom_') then b[2]=b[2]+610-P.assets.panel_base.bounds[4] end
                image(id,b)
            end
        end
        V.text('设置',473,635.5,66,'#B47BC4',178,'#FFF9FE')
        feedback('settings.close',settingsBounds.close,function()
            for _,id in ipairs(D.tool.close) do img(D.tool.assets[id],shiftedSettings(D.tool.assets[id].bounds)) end
        end)
        for _,c in ipairs(P.controls) do
            local key=c.id=='sound' and 'audio' or c.id
            feedback('settings.'..key,settingsBounds[key],function()
                image(c.id..'_icon')
                for _,s in ipairs(P.textLayers) do if s.name=='txt_'..c.id then specText(s,s.text,shiftedSettings(s.delivery_bounds)) end end
                local on=g.profile.settings[c.setting]
                image(on and c.onTrack or c.offTrack,c.trackBounds)
                image(on and c.onThumb or c.offThumb,on and c.onThumbBounds or c.offThumbBounds)
                image(on and c.onStar or c.offStar,on and c.onStarBounds or c.offStarBounds)
            end)
        end
'''+view[end:]
old="add('home.settings',rect({18,40,96,118}));if g:nextIndex() then add('home.start',rect(D.home.assets.ui_sleep_outer.bounds)) end"
assert old in view
view=view.replace(old,"for key,b in pairs(D.home.controls) do if key~='start' or g:nextIndex() then add('home.'..key,rect(b)) end end")
# Existing pointer capture/release and drag-cancel semantics remain in main.lua.
main=main.replace('    Save.update(dt)','    View.updateNotice(dt)\n    Save.update(dt)')
main=main.replace("    elseif id=='tool.action' then game:confirmTool()", "    elseif id=='tool.action' then game:confirmTool()\n    elseif id and id:match('^home%.') then View.showHomeNotice(id:sub(6))")
(STAGE/'scripts/View.lua').write_text(view,encoding='utf-8')
(STAGE/'scripts/main.lua').write_text(main,encoding='utf-8')
print('Staged Maker home UI, settings frame, all eight entry hit areas and six notices')
