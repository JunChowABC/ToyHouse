"""Stage current web presentation in the independent, already ad-enabled Maker port."""
import json, pathlib, shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
OUT=ROOT/'output/maker-ui-sync'
view=(MAKER/'scripts/View.lua').read_text('utf-8-sig')
main=(MAKER/'scripts/main.lua').read_text('utf-8-sig')
assert "require('UiMotion')" not in view, 'Already migrated'
for name,text in [('View',view),('main',main)]:
    (OUT/f'{name}.before-presentation.lua').write_text(text,encoding='utf-8')
view=view.replace("local original=require('Data')", "local original=require('Data')\nlocal Motion=require('UiMotion')")
view=view.replace("    local b=D.core.assets[id].bounds;return rect", "    ---@type number[]\n    local b=D.core.assets[id].bounds;return rect")
start=view.index('    if g.combo>0 then')
end=view.index('    for _,b in ipairs(tools)',start)
view=view[:start]+'''    if g.combo>0 then
        local b=artRect('combo_track');local fraction=math.max(0,math.min(1,(g.comboUntil-g.time)/8000))
        art('combo_track')
        nvgSave(v);nvgIntersectScissor(v,b[1],b[2],b[3]*fraction,b[4]);art('combo_fill',b)
        for i=1,7 do art(string.format('combo_inner_star_%02d',i)) end
        nvgRestore(v);art('combo_base')
        local cursor=artRect('combo_star');cursor[1]=math.max(b[1],math.min(b[1]+b[3]-cursor[3],b[1]+b[3]*fraction-cursor[3]/2));art('combo_star',cursor)
        ---@type number[][]
        local ink={{9,86},{20,76},{11,85},{12,83},{5,90},{11,85},{10,85},{9,87},{11,85},{10,85}}
        local digits=tostring(g.combo);local ds=math.min(72/128,160/(#digits*80))*scale;local gap=4*ds
        local width=(#digits-1)*gap
        for i=1,#digits do local k=ink[tonumber(digits:sub(i,i))+1];width=width+(k[2]-k[1])*ds end
        local frame=artRect('combo_base');local label=artRect('art_combo_label');label[3]=label[3]*1.3;label[4]=label[4]*1.3
        local bottom=frame[2]-2*scale;label[1]=frame[1]+(frame[3]-label[3]-8*scale-width)/2;label[2]=bottom-label[4];art('art_combo_label',label)
        local x=label[1]+label[3]+8*scale
        for i=1,#digits do
            local digit=digits:sub(i,i);local k=ink[tonumber(digit)+1];local w=(k[2]-k[1])*ds
            nvgSave(v);nvgIntersectScissor(v,x,bottom-96*ds,w,96*ds)
            art('digit_'..digit,{x-k[1]*ds,bottom-112*ds,96*ds,128*ds});nvgRestore(v);x=x+w+gap
        end
    end
'''+view[end:]
view=view.replace("    local v=V.vg;nvgBeginPath(v);nvgRect(v,0,0,540,960);nvgFillColor(v,nvgRGBA(100,64,85,122));nvgFill(v)\n    nvgSave(v);nvgTranslate", "    local v=V.vg;nvgSave(v);local alpha,size=Motion.pose();nvgGlobalAlpha(v,alpha)\n    nvgBeginPath(v);nvgRect(v,0,0,540,960);nvgFillColor(v,nvgRGBA(100,64,85,122));nvgFill(v)\n    nvgTranslate(v,270,480);nvgScale(v,size,size);nvgTranslate(v,-270,-480);nvgTranslate")
view=view.replace('    if g.adPending then return result end','    if g.adPending or Motion.busy() then return result end')
view=view.replace("    if g.mode=='level-complete' then V.complete(g) end", "    if g.mode=='level-complete' and not Motion.transition then V.complete(g) end")
view=view.replace('function V.draw(g)', '''function V.transition()
    local t=Motion.transition;if not t then return end
    local cover=math.min(1,t.elapsed/.3);local reveal=math.max(0,math.min(1,(t.elapsed-.4)/.36))
    local function smooth(x) return x*x*(3-2*x) end
    local v=V.vg;nvgSave(v);nvgBeginPath(v)
    if t.elapsed<.4 then nvgCircle(v,270,480,560*smooth(cover))
    else nvgRect(v,0,0,540,960);nvgCircle(v,270,480,560*smooth(reveal));nvgPathWinding(v,NVG_HOLE) end
    nvgFillColor(v,color('#f8e9ef'));nvgFill(v)
    nvgGlobalAlpha(v,math.max(0,math.min(1,(t.elapsed-.16)/.1))*(1-math.min(1,reveal*3)))
    V.text(t.next<=#D.levels.levels and ('第 '..t.next..' 关') or '晚安，玩具屋',270,480,32,'#9c718a',360)
    nvgRestore(v)
end
function V.draw(g)''')
main=main.replace("local View=require('View')", "local View=require('View')\nlocal Motion=require('UiMotion')")
main=main.replace("    loader=Loading.new", "    View.loadImages('loading',true) -- Explicit preload group makes artwork available on the first frame.\n    loader=Loading.new")
main=main.replace('    Save.update(dt)\n', '    Save.update(dt)\n    local frozen=Motion.update(dt)\n')
main=main.replace('        game:update(dt)', '        if not frozen then game:update(dt) end')
main=main.replace('    if loader and loader.pending then\n        local r=', "    Motion.sync((loader and loader.pending or Motion.transition) and nil or game and (game.modal and ('tool.'..game.modal) or game.pause and (game.mode..'.settings') or game.mode=='level-complete' and 'complete' or nil))\n    if loader and loader.pending then\n        local r=")
# Lua's and/or cannot select nil; explicitly suppress underlying dialog while waiting.
main=main.replace("    Motion.sync((loader and loader.pending or Motion.transition) and nil or game and (game.modal and ('tool.'..game.modal) or game.pause and (game.mode..'.settings') or game.mode=='level-complete' and 'complete' or nil))", "    if (loader and loader.pending) or Motion.transition then Motion.sync(nil)\n    elseif game then Motion.sync(game.modal and ('tool.'..game.modal) or game.pause and (game.mode..'.settings') or game.mode=='level-complete' and 'complete' or nil) end")
main=main.replace('    if not ready then\n', '    View.transition()\n    if not ready then\n')
main=main.replace("elseif id=='complete.next' then game:advance();navUntil=elapsed+.35", "elseif id=='complete.next' then Motion.nextLevel(game)")
main=main.replace('local function action(id)\n', '''local function action(id)
    if Motion.busy() then return end
    local closing={['pause.resume']=true,['settings.close']=true,['pause.restart']=true,['pause.exit']=true,['complete.home']=true,['complete.next']=true,['tool.close']=true,['tool.action']=true}
    if closing[id] then Motion.close(function() performAction(id) end);return end
''')
main=main.replace('    if pointer or elapsed<navUntil then return end', '    if pointer or elapsed<navUntil or Motion.busy() then return end')
main=main.replace('    if pressed.loading then return end', '    if pressed.loading or Motion.busy() then return end')
main=main.replace('function HandleKeyDown(_,d)\n', 'function HandleKeyDown(_,d)\n    if Motion.busy() then return end\n')
main=main.replace("if game.modal then game.modal=nil elseif game.tool then game:cancelTool() elseif game.pause then game.pause=false", "if game.modal then action('tool.close') elseif game.tool then game:cancelTool() elseif game.pause then action(game.mode=='home' and 'settings.close' or 'pause.resume')")
for name,text in [('View',view),('main',main)]: (OUT/'scripts'/f'{name}.lua').write_text(text,encoding='utf-8')
shutil.copyfile(ROOT/'scripts/maker/UiMotion.lua',OUT/'scripts/UiMotion.lua')
resources=json.loads((MAKER/'.project/resources.json').read_text('utf-8-sig'))
resources['groups']['loading_screen']=['toyhouse-ui-v2/loading/**']
if 'loading_screen' not in resources['preload_groups']:resources['preload_groups'].append('loading_screen')
(OUT/'resources.json').write_text(json.dumps(resources,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Staged Combo, loading logo/preload, dialog and level transition motion; preserved ad integration')
