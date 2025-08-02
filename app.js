const format = require('./format.json')

const express = require('express');
const ytdl = require('@distube/ytdl-core');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const bodyParser = require('body-parser');
const cors = require('cors');

// ffmpeg settings
ffmpeg.setFfmpegPath(ffmpegPath);

// express server configuration
const app = express();
const port = 5000;

app.use(cors({
	origin: '*', // Allow all origins
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
	res.header('Access-Control-Expose-Headers', 'Content-Disposition');
	next();
});

app.post('/download', async (req, res) => {
	try {
		if(!format[req.body.format]) {
			return res.status(400).send('Invalid format. Supported formats: ' + format.join(', '));
		}

		const ytdl_stream = ytdl(req.body.url, format[req.body.format]['ytdl-options']);
		
		ytdl_stream.on('error', (err) => {
			res.status(500).send(err.message);
		});

		ytdl_stream.on('info', (info) => {
			res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title}.${req.body.format}"`);
		});

		if (req.body.format === 'mp4') {
			// use ytdl_stream directly for mp4 format
			const buffer = [];

			ytdl_stream.on('readable', async() => {
				let chunk;
				while (null !== (chunk = await ytdl_stream.read())) {
					buffer.push(chunk);
				}
			})

			ytdl_stream.on('end', () => {
				const streamBuffer = Buffer.concat(buffer);
				res.setHeader('Content-Type', format[req.body.format]['content-type']);
				res.setHeader('Content-Length', streamBuffer.length);
				res.send(streamBuffer);
			});
		}
		else {
			let bufferStream = new stream.PassThrough();
			ffmpeg(ytdl_stream)
				.format(req.body.format)
				.on('error', (err) => {
					res.status(500).send(err.message);
				})
				.writeToStream(bufferStream, { end: true })

			const buffer = [];

			bufferStream.on('data', (chunk) => {
				buffer.push(chunk);
			});

			bufferStream.on('end', () => {
				const streamBuffer = Buffer.concat(buffer);
				res.setHeader('Content-Type', format[req.body.format]['content-type']);
				res.setHeader('Content-Length', streamBuffer.length);
				res.send(streamBuffer);
			});
		}
			
	}
	catch (err) {
		console.error(err);
		res.status(500).send(err);
	}
});

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});
