
/*Should be moved to generic lib*/
function GameLookup(redisConnection) {
    this.GAME_DB = 2;
    this.redisQueryConnection = redisConnection;
}
GameLookup.prototype.getGameInfoById = function(game_id) {
    return new Promise(function(resolve, reject) {
        this.redisQueryConnection.select(this.GAME_DB, function(err) {
            if(err) return reject(err);
            var handleScanResults;
            var performScan = function(cursor) {
                this.redisQueryConnection.scan(cursor, "MATCH", "*:"+game_id,handleScanResults);
            }.bind(this);
            handleScanResults = function(err, res) {
                var val = parseInt(res[0]);
                if(res[1].length > 0) {
                    resolve(this.getGameInfoByKey(res[1][0]));
                    return;
                }
                if(val != 0)
                    performScan(val);
            }.bind(this);
            performScan(0);
        }.bind(this));

    }.bind(this)); 
}

GameLookup.prototype.getGameInfoByKey = function(key) {
    return new Promise(function(resolve, reject) {
        if(err) return reject(err);
        var game_data = {};
        var lookup_data = ["gameid", "gamename", "secretkey", "description", "queryport", "disabled_services"];
        this.redisQueryConnection.hmget(key, lookup_data, function(err, res) {
            for(var i in lookup_data) {
                game_data[lookup_data[i]] = res[i];
            }
            resolve(game_data);
        });
    }.bind(this));
};
module.exports = GameLookup;