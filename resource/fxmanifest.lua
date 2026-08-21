fx_version 'cerulean'
game "gta5"
author "Newwy"
version '1.0.0'
description ''
lua54 'yes'

loadscreen 'html/index.html'
loadscreen_manual_shutdown 'yes'
-- ui_page 'http://localhost:3301/'

client_scripts {
    'client/main.lua',
}

server_scripts {
    'server/main.lua',
}

shared_scripts {
    'config/config.general.lua',
}

files {
    'html/**',
    'html/img/assets/*.*',
}