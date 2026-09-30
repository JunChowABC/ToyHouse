-- FakeAd loads UI/Core/UI directly, bypassing UI/init's Inspector registration.
-- Register the real inspector before the SDK initializes its preview-only UI.
local P={}
function P.prepare()
    local environment=rawget(_G,'GetTapMakerEnvString')
    if not environment or environment()~='preview' then return end
    local UI=require('urhox-libs/UI/Core/UI')
    if not UI.Inspector then
        -- The bundled Panel contains typographic quotes in four Lua literals.
        -- Keep the corrected real implementation project-owned, without editing the dev kit.
        package.preload['urhox-libs/UI/Core/UIInspector/Panel']=function()
            return require('compat/InspectorPanel')
        end
        UI.Inspector=require('urhox-libs/UI/Core/UIInspector')
    end
end
return P
