# 🌲 Douglas - The OET Ethos Guardian 🕵️‍♂️

Meet Douglas. He's our diligent, Puppeteer-based guardian for the [Online Everything Tool (OET)](https://github.com/Online-Everything-Tool/oet) project. Douglas may seem unassuming, but he has a very important job: ensuring all new OET contributions strictly adhere to our sacred client-side ethos.

He's got a keen eye (and a network interceptor) for any unauthorized external network calls a proposed tool might try to make. If a tool tries to phone home when it shouldn't, Douglas will know. 📞🚫

## 🎯 Purpose

The Online Everything Tool is built on the principle that core tool functionality runs *entirely* within the user's browser. No sneaky server-side processing for the main event! This is where Douglas steps in. During our CI/CD process for new tool PRs, Douglas will:

1.  Spin up a local, static version of the proposed OET tool.
2.  Launch a headless browser (thanks, Puppeteer!) and navigate to the tool's page.
3.  Carefully intercept and scrutinize every network request the page attempts.
4.  Flag any requests made to domains not on his *very short* approved list (basically, just itself and maybe a CDN or two if we're feeling generous).
5.  Generate a report card (a Markdown summary) and a school photo (a screenshot) of the tool in action.
6.  Let us know if the tool is playing by the rules or trying to call "Mr. Netlify" for help when it shouldn't. 😉

## 🛠️ Prerequisites (for local mischief with Douglas)

- Node.js (he prefers a mature vintage, like v20+)
- npm (his favorite snack dispenser)

## 🚀 Setup (If you want to see Douglas work his magic locally)

1.  Clone Douglas (he doesn't mind, he's quite public):
    ```bash
    git clone https://github.com/Online-Everything-Tool/douglas.git
    cd douglas
    ```
2.  Give him his snacks:
    ```bash
    npm install
    ```

## 📜 How to Summon Douglas (Usage of `check-tool.js`)

His main incantation is `check-tool.js` (or `.ts` if he's feeling fancy).

```bash
node check-tool.js <targetUrl> --outputSummaryFile <path_to_summary.md> --screenshotPath <path_to_screenshot.png> [--allowedOrigins <origin1,origin2,...>]