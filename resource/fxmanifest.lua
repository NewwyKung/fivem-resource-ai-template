fx_version 'cerulean'
game 'gta5'

author 'Newwy'
version '0.1.0'
description 'AI-assisted FiveM resource template'

shared_scripts {
    'config/config.main.lua',
}

client_scripts {
    'client/main.lua',
}

server_scripts {
    'server/main.lua',
}

-- Build resource/ui before starting the resource in production.
ui_page 'html/index.html'

files {
    'html/**/*',
}
