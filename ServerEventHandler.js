const GROUPS_DB = 1;
const URL = require('url');
const https = require('https');

function ServerEventHandler(discord_webhook_url, redisConnection, server_lookup, game_lookup) {
    this.redisConnection = redisConnection;
    this.discord_webhook_url = URL.parse(discord_webhook_url);
    this.server_lookup = server_lookup;
    this.game_lookup = game_lookup;
}

ServerEventHandler.prototype.offsetGroupServerCount = function(group_key, diff) {
    this.redisConnection.select(GROUPS_DB, function(err) {
        this.redisConnection.hincrby(group_key+":custkeys", "numservers", diff, function(err) {

        });
    }.bind(this));
};

ServerEventHandler.prototype.handleSBUpdate = function(type, server_key) {
    this.server_lookup.getServerInfo(server_key, ["hostname", "groupid", "mapname", "numplayers", "maxplayers"]).then(function(server_obj) {
        if(!server_obj) return;
        this.game_lookup.getGameInfoById(server_obj.gameid).then(function(game_info) {
            if(!game_info) return;
            var server_details = "]\n`\n`Game: "+game_info.description+" ("+game_info.gamename+")\nHostname: "+server_obj.custkeys.hostname+"\nMap: "+server_obj.custkeys.mapname+"\nPlayers: ("+server_obj.custkeys.numplayers+"/"+server_obj.custkeys.maxplayers+")`";
            var message;
            switch(type) {
                case 'new':
                    message = "`[New Server";
                    if(server_obj.custkeys.groupid) {
                        this.offsetGroupServerCount(game_info.gamename+ ":" + server_obj.custkeys.groupid, 1);
                    }
                break;
                case 'del':
                    if(server_obj.custkeys.groupid) {
                        this.offsetGroupServerCount(game_info.gamename+ ":" + server_obj.custkeys.groupid, -1);
                    }
                    return;
                break;
                default:
                return;
            }
            message += server_details;
            this.sendGeneralUpdatesMessage(message);
        }.bind(this));
    }.bind(this));
}

ServerEventHandler.prototype.sendGeneralUpdatesMessage = function(message) {
    var options = this.discord_webhook_url;
    var post_data = {content: message};
    var json_string = JSON.stringify(post_data);
    options.headers = {'Content-Type': "application/json", "Content-Length": Buffer.byteLength(json_string)};
    options.method = "POST";
    options.port = 443;

    var post_req = https.request(options, function(res) {
        
    });

    post_req.write(json_string);
    post_req.end();
};

module.exports = ServerEventHandler;