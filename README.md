# Kadai Khata (prototype)

A voice ledger for small shops that sell on credit (udhaar). Built for the India Runs on Voice hackathon (Scaler x Wispr Flow), Round 2, theme: livelihoods and small business.

The shopkeeper says one sentence, for example "Ravi took rice, 200 rupees on credit". The app turns it into a draft entry (customer, item, amount, type), reads it back, and saves only after a spoken or tapped yes. "Ravi's balance" reads out what Ravi owes.

## Run

    docker compose up --build
    # open http://localhost:3000

No API keys are needed. Without Docker: `node server.js` (Node 18 or newer, no dependencies). Tests: `node test.js`.

## How it works

- `public/app.js`: the browser speech recognition (Web Speech API) and speech synthesis. The microphone button needs a browser that supports it (Chrome on Android or desktop). If the browser has none, the page says so and typing works through the same flow.
- `parser.js`: turns a transcript into a draft entry. It handles digits and some number words, credit, payment and sale wording, and balance questions. This is simple keyword logic, not a language model.
- `server.js`, `store.js`: a small HTTP server and a JSON file for storage.

## Limits, stated plainly

- Speech recognition comes from the browser. Language availability depends on the browser and device. The app offers English (India) only, because that is the only language the parser has been tested with. Adding a language means adding it to `LANGS` in `public/app.js` and testing the parser with it.
- The parser was tested on English phrases (a few romanised Hindi words such as udhaar and hisab are recognised). Hindi script, Malayalam and Tamil sentences are not supported or tested.
- Data is stored in one JSON file, with no login, no backup and no payments.
- Not tested with real shopkeepers.

## Authorship

This prototype was written with an AI assistant, as the hackathon FAQ permits (any editor or AI tool). It was written during the hackathon.
