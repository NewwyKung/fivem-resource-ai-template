fx_version 'cerulean'
game 'gta5'

author 'Newwy'
version '0.2.0'
description 'AI-assisted FiveM resource template'

shared_scripts {
    'config/config.main.lua',
    'shared/debug.lua',
    'shared/enum.lua',
}

client_scripts {
    'config/fucntions/config.client.functions.lua',
    'client/functions/sendNui.lua',
    'client/main.lua',
}

server_scripts {
    'config/fucntions/config.server.functions.lua',
    'server/main.lua',
}

-- Build resource/ui before starting the resource in production.
ui_page 'html/index.html'

files {
    'html/**/*',
}
