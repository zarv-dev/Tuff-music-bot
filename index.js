require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState 
} = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const PREFIX = '!p ';

client.once('ready', () => {
    console.log(`Music bot online as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const input = message.content.slice(PREFIX.length).trim();
    if (!input) {
        return message.reply('Please provide a song title or YouTube link!');
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
        return message.reply('You need to be in a Voice Channel to play music!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply('I need permissions to join and speak in your voice channel!');
    }

    try {
        const statusMsg = await message.reply(`Processing request: \`${input}\`...`);

        let videoUrl = '';
        let videoTitle = '';
        let videoDuration = '';
        const validation = await play.yt_validate(input);

        if (validation === 'video') {
            const info = await play.video_info(input);
            videoUrl = info.video_details.url;
            videoTitle = info.video_details.title;
            videoDuration = info.video_details.durationRaw;
        } else {
            const ytResults = await play.search(input, { limit: 1 });
            if (!ytResults || ytResults.length === 0) {
                return statusMsg.edit('No results found on YouTube for your query.');
            }
            videoUrl = ytResults[0].url;
            videoTitle = ytResults[0].title;
            videoDuration = ytResults[0].durationRaw;
        }
      
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

        const stream = await play.stream(videoUrl);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
        });

        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);

        await statusMsg.edit(`Now playing: **${videoTitle}** (${videoDuration})`);

        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
        });

        player.on('error', (error) => {
            console.error('Audio player error:', error);
            connection.destroy();
        });

    } catch (error) {
        console.error('Playback error:', error);
        message.reply('There was an error trying to play that track or link.');
    }
});

client.login(process.env.DISCORD_TOKEN);
