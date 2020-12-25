const Discord = require('discord.js');

require('dotenv').config();

const client = new Discord.Client();

client.once('ready', () => {
    console.log('Ready!');
});

const Commands = {
    HELP: 'help',
    NICK: 'nick',
    CLEAR: 'clear',
    BOT_STATUS: 'botstatus',
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
    channel.bulkDelete(toDelete)
        .then(messages => {
            msg.reply(`Deleted ${messages.size} messages`);
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
        default:
            break;
    }
}

client.on('message', msg => {
    const { content, mentions, member: author } = msg;
    if (content.startsWith('-fag')) {
        const [, ...args] = content.split(' ');
        handleCommands(msg, args);
    }
});

client.login(process.env.DISCORD_TOKEN);
