# Nervos Airdrop Tool

![GitHub package.json version](https://img.shields.io/github/package-json/v/jordanmack/nervos-airdrop)
![GitHub last commit](https://img.shields.io/github/last-commit/jordanmack/nervos-airdrop)
![Travis-CI](https://img.shields.io/travis/jordanmack/nervos-airdrop)
![Requires.io](https://img.shields.io/requires/github/jordanmack/nervos-airdrop)
![GitHub Repo stars](https://img.shields.io/github/stars/jordanmack/nervos-airdrop?style=social)

<!-- ![Uptime Robot status](https://img.shields.io/uptimerobot/status/m788404415-839b32111e1dc755c52c3e33) -->
<!-- ![Uptime Robot ratio (30 days)](https://img.shields.io/uptimerobot/ratio/m788404415-839b32111e1dc755c52c3e33) -->

Nervos Airdrop Tool is a web based tool to automate the process of distributing CKBytes to a list of CKB addresses.

> This tool is designed only for internal use by the Nervos Foundation. Please do not share this tool externally.

## Usage

These instructions describe how to launch, run, and develop using Nervos Airdrop Tool code base.

<!-- If you don't need to develop and just want to use the tools, visit the [Nervos.win](https://nervos.win/) website. -->

### Prerequisites

- [Node.js 16+](https://nodejs.org/en/)

### Install Dependencies

```sh
npm i
```

### Edit the Configuration

The `src/config.js` file contains the default settings for the Nervos testnet and mainnet. The default settings should work for most people without modification.

### Start the Development Server

```sh
npm start
```

### Build for Production

```sh
npm run build
```

### Deploy to Production

Build the project, then copy the complete contents of the `build` directory to the document root of the web server, overwriting any existing files.
