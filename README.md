# Shot Caller

Shot Caller is a live MLB prediction game. Pick the outcome of the current plate
appearance, lock the call before the PA ends, and score when the official MLB
feed reports the result.

The app is a Next.js project intended for a normal GitHub repository and Vercel
deployment.

## Game Loop

- Choose a live MLB game from `/live`.
- Watch the score bug for score, inning, count, outs, and runners on base.
- Call the active PA outcome: out in play, strikeout, walk/HBP, single,
  double/triple, home run, or other reach.
- Correct calls score by rarity. Early locks add a small timing bonus.
- Close calls in the same baseball family earn partial credit.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
```

## Deployment

Push this repository to GitHub, then import the repo in Vercel as a Next.js app.
No ChatGPT Sites deployment files are required.
