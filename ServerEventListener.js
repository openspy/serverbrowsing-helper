var amqp = require('amqplib/callback_api');

function ServerEventListener(amqpConnection, eventCallback) {
    this.eventCallback = eventCallback;

    var channelCallback = this.handleChannelMessage.bind(this);

    amqp.connect(amqpConnection, function(err, conn) {
        this.amqpConnection = conn;
        
        var ex = 'openspy.master';
        conn.createChannel(function(err, ch) {
            ch.assertExchange(ex, 'topic', {durable: false});
            ch.assertQueue('serverbrowsing-helper', {durable: true}, function(err, q) {
                ch.bindQueue(q.queue, ex, 'server.event');

                ch.consume(q.queue, function(msg) {
                    if(msg.content) {
                        channelCallback(msg.content.toString());
                    }
                    ch.ack(msg);
                }, {noAck: true});
            });
        }.bind(this));
    });
}

ServerEventListener.prototype.handleChannelMessage = function(message) {
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
