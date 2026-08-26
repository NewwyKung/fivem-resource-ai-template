fx_version 'cerulean'
game 'gta5'

author 'Newwy'
version '0.1.0'
description 'AI-assisted FiveM resource template'
lua54 'yes'

shared_scripts {
    'config/config.general.lua',
    'shared/**/*.lua',
}

client_scripts {
    'config/functions/config.client.functions.lua',
    'client/**/*.lua',
}

server_scripts {
    'config/functions/config.server.functions.lua',
    'server/**/*.lua',
}

-- Build resource/ui before starting the resource in production.
ui_page 'html/index.html'

files {
    'html/**/*',
}
