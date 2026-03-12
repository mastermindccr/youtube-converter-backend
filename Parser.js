const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { spawn } = require('child_process');
const { Readable } = require('stream');
const fs = require('fs');
const { Utils } = require('youtubei.js');

async function parse_mp3(webStream, res) {
    const nodeStream = Readable.fromWeb(webStream);

    // Spawn FFmpeg natively, read from stdin, write to stdout
    const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',            // input from stdin
        '-vn',                     // disable video (audio only)
        '-acodec', 'libmp3lame',   // MP3 codec
        '-f', 'mp3',               // enforce output format
        'pipe:1'                   // output to stdout
    ]);

    nodeStream.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res); // pipe the processed chunks straight into the HTTP response

    ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err);
        if (!res.headersSent) res.status(500).send('Error processing audio.');
    });
}

async function parse_mp4(webStream, res) {
    const nodeStream = Readable.fromWeb(webStream);
    nodeStream.pipe(res);
}

async function parse_wav(webStream, res) {
    const nodeStream = Readable.fromWeb(webStream);
    
    const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-vn',
        '-acodec', 'pcm_s16le',
        '-f', 'wav',
        'pipe:1'
    ]);

    nodeStream.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err);
        if (!res.headersSent) res.status(500).send('Error processing audio.');
    });
}

module.exports = {
    parse_mp3,
    parse_mp4,
    parse_wav
}