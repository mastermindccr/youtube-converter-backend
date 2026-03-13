import format from './format.json' with {type: 'json'};

import express from 'express';
import { Innertube, UniversalCache, Platform } from 'youtubei.js';
import { generate } from 'youtube-po-token-generator';
import Parser from './Parser.js';
import bodyParser from 'body-parser';
import cors from 'cors';
import vm from 'vm';

let visitorData = 'CgtlQ2I5Yy04TFV4ayju1s7NBjIKCgJUVxIEGgAgSQ%3D%3D';
let poToken = 'Mng_BteeHMvt8j86gOHu62htfGU1MlPkPqR9HT65UK-uP4K-KOfvEY7DTuX1pFWgoSIjXhvoN3ks5XAsVkdLRExH-N8Fl-bQfeyHTPbtibbmEC5JNywIdiyRWUd4nKd8lHqISNIERA9rpQ1x-s2OdSnpd1ejjdzNO-Y=';

// let visitorData;
// let poToken;

/** @type {Innertube} */
let yt;

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

function extractVideoId(url) {
	const match = url.match(/(?:(?:youtu\.be\/)|(?:v\/)|(?:u\/\w\/)|(?:embed\/)|(?:watch\?.*\bv=))([\w-]{11})/);
	return match ? match[1] : null;
}

app.post('/download', async (req, res) => {
	try {
		if(!format[req.body.format]) {
			return res.status(400).send(`Invalid format. Supported formats: ${Object.keys(format).join(', ')}`);
		}

		const videoId = extractVideoId(req.body.url);
		if (!videoId) {
			return res.status(400).send("Invalid YouTube URL.");
		}

		const info = await yt.getInfo(videoId);

		const setTitle = () => {
			const title = info.basic_info.title;
			console.log(`Processing download for: ${title}`);
			const encodedTitle = encodeURIComponent(title);
			res.setHeader('Content-Disposition', `attachment; filename*=utf-8''"${encodedTitle}.${req.body.format}"`);
		};

		setTitle();


		const streamOptions = {
			client: "ANDROID",
			quality: "best",
			type: "video+audio",
            format: "mp4"
		};

		const stream = await yt.download(videoId, streamOptions);
		res.setHeader('Content-Type', format[req.body.format]['content-type']);

		if (req.body.format === 'mp3') {
			console.log("Processing MP3 format...");
			await Parser.parse_mp3(stream, res);
		} else if (req.body.format === 'mp4') {
			await Parser.parse_mp4(stream, res);
		} else if (req.body.format === 'wav') {
			await Parser.parse_wav(stream, res);
		}
			
	}
	catch (err) {
		console.error(err);
		res.status(500).send(err);
	}
});

async function startServer() {
	try {
		Platform.shim.eval = function (data, env) {
			return new Promise((resolve, reject) => {
				try {
					// Clean up const variable redeclaration issues from youtubei's raw script code
					let cleanedOutput = data.output.replace(/const window =.*?;/g, '');
					cleanedOutput = cleanedOutput.replace(/const document =.*?;/g, '');
					cleanedOutput = cleanedOutput.replace(/const self =.*?;/g, '');
					cleanedOutput = cleanedOutput.replace(/const globalThis =.*?;/g, '');

					const js = `
						var window = { Object, Array };
						var document = {};
						var self = window;
						var globalThis = window;
						
						${cleanedOutput}

						var _res = {
							n: typeof exportedVars !== 'undefined' && exportedVars.nFunction ? exportedVars.nFunction("${env.n || ''}") : "${env.n || ''}",
							sig: typeof exportedVars !== 'undefined' && exportedVars.sigFunction ? exportedVars.sigFunction("${env.sig || ''}") : "${env.sig || ''}"
						};
						_res;
					`;

					const context = {};
					vm.createContext(context);
					const result = vm.runInContext(js, context);
					resolve(result);

				} catch (err) {
					reject(err);
				}
			});
		};

		
		if (!visitorData || !poToken) {
			console.log("Generating new visitor data and po token...");
			({ visitorData, poToken } = await generate());
		}
		else {
			console.log("Using existing visitor data and po token...");
		}

		console.log("Initialization complete. Starting server...");

		yt = await Innertube.create({
			cache: new UniversalCache(
				false
			),
			enable_session_cache: true,
			po_token: poToken,
			visitor_data: visitorData
		});
		
		app.listen(port, () => {
			console.log(`Example app listening at http://localhost:${port}`);
		});
	} catch (error) {
		console.error('Failed to initialize Innertube', error);
	}
}

startServer();
