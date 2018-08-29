const GROUPS_DB = 1;
const URL = require('url');
const https = require('https');

function ServerEventHandler(webhooks, redisConnection, server_lookup, game_lookup) {
    this.redisConnection = redisConnection;
    this.webhooks = {serverUpdates: URL.parse(webhooks.serverUpdates), backendNotifications: URL.parse(webhooks.backendNotifications)};
    this.server_lookup = server_lookup;
    this.game_lookup = game_lookup;
}

ServerEventHandler.prototype.zeroGroupServerCount = function() {
    return new Promise(function(resolve, reject) {
        var deleteCount = 0, deleteCompletes = 0, finishedScanning = false;
        var tryResolve = function() {
            if(deleteCount == deleteCompletes) {
                resolve();
            }
        };
        this.redisConnection.select(GROUPS_DB, function(err) {
            if(err) return reject(err);
            var handleScanResults;
            var performScan = function(cursor) {
                this.redisConnection.scan(cursor, "MATCH", "*:custkeys", handleScanResults);
            }.bind(this);
            handleScanResults = function(err, res) {
                if(err) return reject(err);
                var val = parseInt(res[0]);
                for(key of res[1]) {
                    deleteCount++;
                    this.redisConnection.hdel(key, "numservers", function(err, count) {
                        deleteCompletes++;
                        if(finishedScanning) {
                            tryResolve();
                        }
                    });
                }
                if(val != 0) {
                    performScan(val);
                } else {
                    finishedScanning = true;
                    tryResolve();
                }
            }.bind(this);
            performScan(0);
        }.bind(this));
    }.bind(this));
};

ServerEventHandler.prototype.resyncGroupServerCount = function() {
    return new Promise(async function(resolve, reject) {
        var promises = [];
        await this.zeroGroupServerCount();
            var servers = await this.server_lookup.getAllServers();
            for(var server_key of servers) {
                var p = this.server_lookup.getServerInfo(server_key, ["groupid"]).then(function(key, server_info) {
                    if(!server_info.custkeys.groupid || server_info.deleted) return;
                    var game_key = key.split(':')[0];
                    var group_key = game_key + ":" + server_info.custkeys.groupid;
                    this.offsetGroupServerCount(group_key, 1);
                }.bind(this, server_key));
                promises.push(p);
            }
            Promise.all(promises).then(resolve);
    }.bind(this));
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

            this.performServerSecurityChecks(game_info, server_key);
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
    this.sendNotification(this.webhooks.serverUpdates, message);
};

ServerEventHandler.prototype.sendPrivateNotification = function(message) {
    this.sendNotification(this.webhooks.backendNotifications, message);
}

ServerEventHandler.prototype.sendNotification = function(url, message) {
    var options = URL.parse;
    var post_data = {content: message};
    var json_string = JSON.stringify(post_data);
    options.headers = {'Content-Type': "application/json", "Content-Length": Buffer.byteLength(json_string)};
    options.method = "POST";
    options.port = 443;

    var post_req = https.request(options, function(res) {
        
    });

    post_req.write(json_string);
    post_req.end();
}


//3546d58093237eb33b2a96bb813370d846ffcec8
ServerEventHandler.prototype.performServerSecurityChecks = function(game_info, server_key) {
    if(game_info.gamename == "flatout2pc") {
        this.performFlatout2SecurityChecks(server_key);
    }
};
ServerEventHandler.prototype.performFlatout2SecurityChecks = function(server_key) {
    this.server_lookup.getServerInfo(server_key, ["datachecksum", "car_class", "car_type"]).then(function(server_obj) {

        //invalid car class/type check
        var is_valid = true;
        if(isNaN(server_obj.custkeys.car_class) || isNaN(server_obj.custkeys.car_type)) {
            var car_class = parseInt(server_obj.custkeys.car_class, 10);
            var car_type = parseInt(server_obj.custkeys.car_type, 10);
    
            if(server_obj.custkeys.datachecksum == "3546d58093237eb33b2a96bb813370d846ffcec8") {
                if(car_class < 0 || car_class > 4) {
                    is_valid = false;
                } else if(car_type < 0 || car_type > 49) {
                    is_valid = false;
                }
            } else if(server_obj.custkeys.datachecksum == "d3c757a47b748b43d3ddcd8a40c9e9aff24e65a2") {
                if(car_type < 0 || car_type > 144) {
                    is_valid = false;
                }
                if(car_class < 0) {
                    is_valid = false;
                }
                if((car_class > 3 && car_class < 100) || car_class > 101) {
                    is_valid = false;
                }
            } else if(server_obj.custkeys.datachecksum == "f0776893196e7c8518b3e3fe4f241b6602d8a0b3") {
                if(car_type < 0 || car_type > 94) {
                    is_valid = false;
                }
                if(car_class < 0) {
                    is_valid = false;
                }
                if((car_class > 3 && car_class < 100) || car_class > 101) {
                    is_valid = false;
                }
            }
        } else {
            is_valid = false;
        }
        if(!is_valid) {
            this.server_lookup.deleteServer(server_key).then(function() {
                var message = "`Removed flatout2pc server("+server_obj.ip+":"+server_obj.port+","+server_key+") with invalid car_class or car_type ("+server_obj.custkeys.car_class+","+server_obj.custkeys.car_type+")`";
                this.sendPrivateNotification(message);
            }.bind(this));
        }
    }.bind(this));
}

module.exports = ServerEventHandler;