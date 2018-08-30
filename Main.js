var redis = require('redis');
const redisURL = process.env.REDIS_URL;

var GameLookup = require('./GameLookup');
var ServerLookup = require('./ServerLookup');
var ServerEventListener = require('./ServerEventListener');
var ServerEventHandler = require('./ServerEventHandler');
var game_lookup = new GameLookup(redis.createClient(redisURL));
var server_lookup = new ServerLookup(redis.createClient(redisURL));
var webhooks = {serverUpdates: process.env.DISCORD_SERVER_UPDATES_WEBHOOK, backendNotifications: process.env.DISCORD_BACKEND_NOTIFICATIONS_WEBHOOK};
var server_event_handler = new ServerEventHandler(webhooks, redis.createClient(redisURL), server_lookup, game_lookup);

function serverEventHandler(type, server_key) {
    server_event_handler.handleSBUpdate(type, server_key);
}

var server_event_listener;
server_lookup.getAllServers().then(function(servers) {
    var promises = [];
    for(var server of servers) {
        promises.push(server_event_handler.handleSBUpdate("update", server, true));  
    }
    Promise.all(promises).then(function() {
        server_event_handler.resyncGroupServerCount().then(function() {
            server_event_listener = new ServerEventListener(redis.createClient(redisURL), serverEventHandler);
        })
    })
    
});