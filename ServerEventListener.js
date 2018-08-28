function ServerEventListener(redisConnection, eventCallback) {
    this.redisConnection = redisConnection;
    this.eventCallback = eventCallback;

    this.redisConnection.on("message", this.handleRedisMessage.bind(this));

    this.redisConnection.subscribe("serverbrowsing.servers");
}

ServerEventListener.prototype.handleRedisMessage = function(channel, message) {
    var update_data = message.trimLeft().split('\\');
    switch(update_data[1]) {
        case 'del':
        case 'new':
        case 'update':
            this.eventCallback(update_data[1], update_data[2]);
        break;
    }
};

module.exports = ServerEventListener;
