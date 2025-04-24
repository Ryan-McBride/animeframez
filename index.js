process.title = "AnimeFramez";
import dotenv from 'dotenv';
import pino from 'pino'
dotenv.config();

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { BskyAgent } from '@atproto/api';
import { exec } from 'child_process';
import { CronJob } from 'cron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
const logger = pino(pino.destination('animeframez.log'));

function getVideoFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getVideoFiles(filePath));
    } else {
      if (
        allowedExtensions.includes(path.extname(file).toLowerCase()) &&
        !file.startsWith('.')
      ) {
        results.push(filePath);
      }
    }
  });
  return results;
}

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      resolve(duration);
    });
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function extractFrame(filePath, timeInSeconds, outputImagePath) {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .screenshots({
        timestamps: [timeInSeconds],
        filename: path.basename(outputImagePath),
        folder: path.dirname(outputImagePath),
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

function getGuessitMetadata(filePath) {
  return new Promise((resolve, reject) => {
    exec(`guessit -j "${filePath}"`, (error, stdout) => {
      if (error) {
        return reject(error);
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function main() {
  try {
    const pathsFile = process.argv[2];
    if (!pathsFile) {
      logger.error('Please provide a text file with directory paths as the first argument.');
      process.exit(1);
    }

    const pathsContent = fs.readFileSync(pathsFile, 'utf-8');
    const directories = pathsContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
      
    if (directories.length === 0) {
      logger.error('No valid directories found in the provided text file.');
      process.exit(1);
    }

    const randomDir = directories[Math.floor(Math.random() * directories.length)];
    logger.info(`Selected directory: ${randomDir}`);

    const videoFiles = getVideoFiles(randomDir);
    if (videoFiles.length === 0) {
      logger.error('No video files found in the selected directory and its subfolders.');
      process.exit(1);
    }

    const videoFilePath = videoFiles[Math.floor(Math.random() * videoFiles.length)];
    logger.info(`Randomly selected video file: ${videoFilePath}`);

    let metadata = {};
    try {
      metadata = await getGuessitMetadata(videoFilePath);
      logger.info('GuessIt metadata:', metadata);
    } catch (err) {
      logger.error('GuessIt failed, proceeding without metadata:', err);
    }

    const duration = await getVideoDuration(videoFilePath);
    const randomTime = Math.random() * duration;
    const outputImagePath = path.join(__dirname, 'random_frame.jpg');
    await extractFrame(videoFilePath, randomTime, outputImagePath);
    const fileName = path.basename(videoFilePath);
    const showName = metadata.title || metadata.series || fileName;
    const season = metadata.season ? `S${String(metadata.season).padStart(2, '0')}` : '';
    const episode = metadata.episode ? `E${String(metadata.episode).padStart(2, '0')}` : '';
    const episodeTitle = metadata.episode_title ? ` - ${metadata.episode_title}` : '';
    const year = metadata.year ? ` (${metadata.year})` : '';
    const caption = `${showName}${year} ${season} ${episode} ${episodeTitle} at ${formatTime(randomTime)}`;

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: process.env.BSKY_IDENTIFIER,
      password: process.env.BSKY_PASSWORD,
    });

    const fileBuffer = fs.readFileSync(outputImagePath);
    const uploadResp = await agent.uploadBlob(fileBuffer, { encoding: 'image/jpeg' });
    logger.info('Image uploaded:', uploadResp);

    const postResp = await agent.post({
      text: caption,
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            image: uploadResp.data.blob,
            alt: `Randomly extracted frame from ${caption}`
          }
        ]
      }
    });
    fs.unlinkSync(outputImagePath);
    logger.info('Post created successfully:', postResp);
  } catch (error) {
    logger.error('An error occurred:', error);
  }
}

if (process.env.scheduled === 'true') {
  const scheduleStr = process.env.cron || '0 */3 * * *';
  logger.info(`Scheduling job with cron pattern: ${scheduleStr}`);
  new CronJob(scheduleStr, main, null, true);
} else {
  main();
}
