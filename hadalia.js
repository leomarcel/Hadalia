//To my futur self, don't try to understand it, I didn't either
const { Client, Util, Discord } = require('discord.js');
const YTDL = require("ytdl-core");
const PREFIX = "-";
const client = new Client({ disableEveryone: true });

function generateHEX() { 
	return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

///warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning
const ytdl = require('ytdl-core');
const YouTube = require('simple-youtube-api');
const GOOGLE_API_KEY = 'AIzaSyD3O1E4UmSE89h4I5DUqlItclMVWmHW-ZE';
const youtube = new YouTube(GOOGLE_API_KEY);
const queue = new Map();

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return;
	if (!msg.content.startsWith(PREFIX)) return;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length);

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('I\'m sorry but you need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('I cannot connect to your voice channel, make sure I have the proper permissions!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('I cannot speak in this voice channel, make sure I have the proper permissions!');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`:white_check_mark: Playlist: **${playlist.title}** has been added to the queue!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Song selection:**__

${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Please provide a value to select one of the search results ranging from 1-10.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 20000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('No or invalid value entered, cancelling video selection.');
					}
					const vIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[vIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send(':x: I could not obtain any search results.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
		if (!serverQueue) return msg.channel.send('There is nothing playing that I could skip for you.');
		serverQueue.connection.dispatcher.end('Skip command has been used!');
		//return undefined;
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
		if (!serverQueue) return msg.channel.send('There is nothing playing that I could stop for you.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('Stop command has been used!');
		//return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
		if (!serverQueue) return msg.channel.send('There is nothing playing.');
		if (!args[1]) return msg.channel.send(`The current volume is: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`I set the volume to: **${args[1]}**`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('There is nothing playing.');
		return msg.channel.send(`:notes: Now playing: **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('There is nothing playing.');
		return msg.channel.send(`
__**Song queue:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Now playing:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send(':pause_button: Paused the music for you!');
		}
		return msg.channel.send('There is nothing playing.');
	} else if (command === 'resume') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send(':arrow_forward: Resumed the music for you!');
		}
		return msg.channel.send('There is nothing playing.');
	}
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`I could not join the voice channel: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`I could not join the voice channel: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`:white_check_mark: **${song.title}** has been added to the queue!`);
	}
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`:notes: Start playing: **${song.title}**`);
}

///warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning - warning









//FONCTION WITH PREFIX
client.on("message", function(message) {
	if (message.author.equals(client.user)) return;

	if (!message.content.startsWith(PREFIX)) return;

	var args = message.content.substring(PREFIX.length).split(" ");

	switch (args[0].toLowerCase()) {
		case "about":
			message.channel.send("Hadalia est l'ange du diable, elle est la dernière chose que Lussade, dieu de la mort, peut encore aimer. Ils se sont mariés il y a bien des siècles dans les enfers.");
			break;
	  	case "help" :
  		message.channel.send( {
  			embed: {
  				color: 1752220,
				  description: "**Commands List**\n" +
				  	"Server prefix: " +PREFIX+ "\n" +
					"\n**:stuck_out_tongue_winking_eye: General**\n" +
					"`about`: About this bot\n" +
					"`help` : Show help\n" +
					"`Qui es tu @Hadalia` Qui suis-je ? \n" +
					"`je t'aime @Hadalia` Hadalia n'aime que son Dieu de la mort. \n" +
					"\n**:notes: Music**\n" + 
					"`play`: Plays a song\n" +
					"`skip`: Skip a song\n" +
					"`pause`: Pause the song\n" +
					"`resume`: Resume the song\n" +
					"`stop`: Stops the song\n" +
					"`volume *number*`: Choose a volume\n" +
					"`np`: current song\n" +
					"`queue`: Queue the song\n"
  			}
        });
		//case
	  }
	  
});

client.on("message", function(message) {
	if (message.author.equals(client.user)) return;
	if (!message.content.startsWith(PREFIX)) return;
	var args = message.content.split(" ").slice(1);
	
	let command = message.content.split(" ")[0];
	command = command.slice(PREFIX.length);

	if(command === "say") {
		var sayMessage = args.join(" ");
		message.delete();
		message.channel.send(sayMessage);
	}
});

//FUNCTION WITHOUT PREFIX
client.on("message", function(message) {
	var user = client.users.get(hadalia);

	if (message.content.startsWith(`Qui es tu ${user}`)) {
		if (message.author.id == love) {
			message.reply("Je suis ton ange :heart:");
			return;
		}
		else
			message.reply("Je suis l'ange du diable !");
	} //
	if (message.content.startsWith(`Je t'aime ${user}`) || message.content.startsWith(`je t'aime ${user}`)) {
		if (message.author.id == love) {
			message.reply("moi aussi mon diable je t'aime ! :heart:");
			return;
		}
		if (message.author.id == lamia) {
			message.reply("Je t'aime aussi ma fille chérie ! :heart:");
			return;
		}
		else
			message.reply("bah pas moi ! :imp:");
	}
});

client.on("guildCreate", guild => {
	console.log(`Joined guild ${guild.name} // id : ${guild.id}`);
});

client.on('warn', console.warn);

client.on('error', console.error);

client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconnect now...'));

client.on('reconnecting', () => console.log('I am reconnecting now!'));

client.on("ready", function() {
	console.log("OK");
});

client.login(TOKEN);
