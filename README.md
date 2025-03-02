# What
Absolutely nothing groundbreaking. Just some quick js to grab a random frame from a collection of videos and yeet it onto bsky

# Requirements:
- [Node.js](https://nodejs.org/en)
- [ffmpeg](https://ffmpeg.org/)
- [Python](https://www.python.org/)
- [Guessit](https://pypi.org/project/guessit/)
- [Bluesky](https://bsky.app/) account (duh)

# Setup
```bash
git clone git@github.com:Ryan-McBride/animeframez.git
cd animeframez
npm install
```
Rename .env.example to .env and replace the values with your own

Edit `paths.txt` to be a list of directories with video files (will also search subdirectories)

# Usage
Run once:
```bash
npm run once
```

Run on a schedule (default once a day at noon server time):
Note that killing the process will stop the schedule
```bash
npm run schedule
```
For a custom schedule:
```bash
npm run schedule -- --cron "<some cron schedule goes here>"
```

# Tipz n Trickz
The episode information is magicked from the filenames by Guessit, so if you have a weird file name it may not work. Best pattern is something like `Show Name - S01E01 - Episode Title.mp4` or something similar.

Together we can make Bsky a weebier place.
