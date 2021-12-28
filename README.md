# Nervos Airdrop

Nervos Airdrop is a web based tool for distributing Nervos CKBytes to a list of CKB addresses.

> This tool is intended for internal testing purposes only and should not be used in production environments.

## Developing

These instructions describe how to launch, run, and develop using the CKB.tools code base.

If you don't need to develop and just want to use the tools, visit the [CKB.tools](https://ckb.tools/) website.

### Prerequisites

- [Node.js 16+](https://nodejs.org/en/)

### Install Dependencies

```sh
npm i --force
```

You will also need to delete the following file due to a problem in the NPM package.

```sh
rm -f node_modules/hookrouter/dist/index.d.ts
```

### Configure

Edit the `src/config.js` file.

### Start the Development Server

```sh
npm start
```

### Building

```sh
npm run build
```

### Deploying

Build the project, then copy the complete contents of the `build` directory to the document root of the web server.
