var redis = require('redis');
const redisURL = process.env.REDIS_URL || "redis://10.1.1.125/0";

var redisConnection = redis.createClient(redisURL);
var GameLookup = require('./GameLookup');
var ServerLookup = require('./ServerLookup');
var ServerEventListener = require('./ServerEventListener');
var ServerEventHandler = require('./ServerEventHandler');
var game_lookup = new GameLookup(redisConnection);
var server_lookup = new ServerLookup(redisConnection);
var server_event_handler = new ServerEventHandler(process.env.DISCORD_WEBHOOK_URL, redisConnection, server_lookup, game_lookup);

function serverEventHandler(type, server_key) {
    if(type == "new" || type == "del") {
        server_event_handler.handleSBUpdate(type, server_key);
    }

}


var server_event_listener = new ServerEventListener(redis.createClient(redisURL), serverEventHandler);
serverEventHandler("new", "stella:0:27:");