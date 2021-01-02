const Discord = require('discord.js');
require('dotenv').config();
const express = require('express');

const app = express();
const expressWs = require('express-ws')(app);
app.use(express.text());

const client = new Discord.Client();

client.once('ready', () => {
    console.log('Discord bot connected!');
});

const Commands = {
    HELP: 'help',
    NICK: 'nick',
    CLEAR: 'clear',
    BOT_STATUS: 'botstatus',
    SETUP_WEBSOCKET: 'setupwebsocket',
};

function getLast(list) {
    return list[list.length - 1];
}

function reportError(msg) {
    return e => {
        console.error(e);
        msg.reply("Something went wrong :(");
    }
}

function wrapMessage(message){
    return `ws: ${message}`;
}

function rename(msg, args) {
    const { content, mentions, member: author } = msg;
    const { members } = mentions;
    if (members.size !== 1) {
        msg.reply('Pick a single user (it should be blue)');
        return;
    }
    const member = members.values().next().value;
    const newNickname = args[args.length - 1];
    const reasonMessage =
        `${author.user.username} renamed ${member.user.username}`;
    member.setNickname(newNickname, reasonMessage);
}

function clearMessages(msg, args) {
    const maxDeletes = 10;
    const num = Number(getLast(args));
    if (!num) {
        msg.reply('Select number of messages to delete');
        return;
    }
    const toDelete = Math.min(num, maxDeletes);
    const { channel } = msg;
    channel.bulkDelete(toDelete + 1)
        .then(messages => {
            msg.reply(`Deleted ${messages.size ? messages.size - 1 : 0} messages`);
        }).catch(reportError(msg));
}

function setBotStatus(msg, args = []) {
    const { member } = msg;
    const status = String(args.
        slice(args.indexOf(Commands.BOT_STATUS) + 1).join(' '));
    client.user.setPresence({
        activity:
        {
            name: status
        },
        status: 'online'
    }).then(() => {
        msg.reply(`Set status to ${status}`)
    }).catch(reportError(msg));
}

function setupWebsocket(msg, args) {
    msg.guild.channels.create('websocket')
        .then(channel => {
            channel.send(`Id: ${channel.id}`)
            msg.reply(`Websocket channel created. POST to socketEndpoint/${channel.id} with the message to be broadcasted and attach a websocket to listen`);
        }).catch(reportError(msg));
}

function handleCommands(msg, args) {
    switch (args[0]) {
        case Commands.HELP:
            msg.reply('\n' + Object.values(Commands).join('\n'));
            break;
        case Commands.NICK:
            rename(msg, args);
            break;
        case Commands.CLEAR:
            clearMessages(msg, args);
            break;
        case Commands.BOT_STATUS:
            setBotStatus(msg, args);
            break;
        case Commands.SETUP_WEBSOCKET:
            setupWebsocket(msg, args);
            break;
        default:
            break;
    }
}

client.on('message', msg => {
    const { content, mentions, member: author } = msg;
    if (content.startsWith(process.env.BOT_TRIGGER)) {
        if (author.user.id === client.user.id) {
            msg.reply('Bot cannot trigger itself ...');
            return;
        }
        const [, ...args] = content.split(' ');
        handleCommands(msg, args);
    }
    if (msg.channel.name === 'websocket' && msg.member.user.id !== client.user.id) {
        expressWs.getWss().clients.forEach(client => {
            if (client.channelId === msg.channel.id) {
                client.send(content);
            }
        });
    }
});

client.login(process.env.DISCORD_TOKEN);

app.get('/', (req, res) => {
    res.json('I am a discord bot :D');
});


app.post('/channels/:channelId', (req, res) => {
    client.channels.fetch(req.params.channelId)
        .then(channel => {
            if (channel.name !== 'websocket') {
                res.status(400).send('Can only POST to channels named "websocket"');
            }
            channel.send(wrapMessage(req.body))
                .then(() => {
                    res.status(200).end();
                })
                .catch(e => {
                    res.status(500).send(e);
                })
        })
        .catch(e => {
            //Todo: make this mor3e secure with an inclusive pattern
            res.json(e);
        });
});

app.ws('/socket/:channelId', (ws, req) => {
    console.log('got connection!');
    console.log(req.params.channelId);
    ws.channelId = req.params.channelId;

    client.channels.fetch(req.params.channelId)
        .then(channel => {
            if (channel.name !== 'websocket') {
                ws.send('Can only POST to channels named "websocket"');
                return;
            }
            ws.on('message', (message) => {
                channel.send(wrapMessage(message)).catch(e => {
                    ws.send(e);
                })
            });
            ws.send('Hi there, I am a WebSocket server listening on ' + req.params.channelId);
        })
        .catch(e => {
            //Todo: make this more secure with an inclusive pattern
            res.json(e);
        });
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
