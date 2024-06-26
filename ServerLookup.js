function ServerLookup(redisConnection) {
    this.SERVER_DB = 0;
    this.redisQueryConnection = redisConnection;
}

ServerLookup.prototype.getServerInfo = function(server_key, basic_lookup_keys) {
    return new Promise(function(resolve, reject) {
        var server_obj = {custkeys: {}};
        this.redisQueryConnection.select(this.SERVER_DB, function(err) {
            if(err) return reject(err);
            this.redisQueryConnection.hmget(server_key+"custkeys", basic_lookup_keys, function(err, res) {
                if(err) return reject(err);
                for(var i in res) {
                    server_obj.custkeys[basic_lookup_keys[i]] = res[i];
                }
                this.redisQueryConnection.hmget(server_key, ["wan_ip", "wan_port", "gameid", "deleted"], function(err, res) {
                    if(err) return reject(err);
                    server_obj.ip = res[0];
                    server_obj.port = res[1];
                    server_obj.gameid = res[2];
                    var deleted = parseInt(res[3]);
                    if(deleted == 1)
                        server_obj.deleted = true;
                    resolve(server_obj);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

ServerLookup.prototype.getAllServers = function() {
    return new Promise(function(resolve, reject) {
        var servers = [];
        this.redisQueryConnection.select(this.SERVER_DB, function(err) {
            if(err) return reject(err);
            var handleScanResults;
            var performScan = function(cursor) {
                this.redisQueryConnection.scan(cursor, "MATCH", "*:*:",handleScanResults);
            }.bind(this);
            handleScanResults = function(err, res) {
                var val = parseInt(res[0]);
                servers = servers.concat(res[1]);

                if(val != 0) {
                    performScan(val);
                } else {
                    resolve(servers);
                }
            }.bind(this);
            performScan(0);
        }.bind(this));
    }.bind(this));
};

ServerLookup.prototype.deleteServer = function(server_key) {
    return new Promise(function(resolve, reject) {
        this.redisQueryConnection.select(this.SERVER_DB, function(err) {
            if(err) return reject(err);

            this.redisQueryConnection.hset(server_key, "deleted", 1, function(err, reply) {
                if(err) return reject(err);
                resolve();
            }.bind(this));
        }.bind(this));
    }.bind(this));
}
ServerLookup.prototype.setCustomKeys = function(server_key, cust_keys) {
    return new Promise(function(resolve, reject) {
        var num_resolves = 0;
        this.redisQueryConnection.select(this.SERVER_DB, function(err) {
            if(err) return reject(err);

            this.redisQueryConnection.hmset(server_key+"custkeys", cust_keys, function(err, res) {
                if(err) {
                    return reject(err);
                }
                resolve();
            }.bind(this));
        }.bind(this));
    }.bind(this));
};
module.exports = ServerLookup;
