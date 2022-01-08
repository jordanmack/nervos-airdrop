import {Mutex} from 'async-mutex';

const config =
{
	testnet:
	{
		ckbRpcUrl: '//rpc-testnet.ckb.tools',
		ckbIndexerUrl: '//indexer-testnet.ckb.tools',
		ckbExplorerUrl: '//explorer.nervos.org/aggron/',
		faucetUrl: 'https://faucet.nervos.org/',
	},

	mainnet:
	{
		ckbRpcUrl: '//rpc.ckb.tools',
		ckbIndexerUrl: '//indexer.ckb.tools',
		ckbExplorerUrl: '//explorer.nervos.org/',
	},

	tickDelay: 200, // Delay in milliseconds between state ticks.
	tickMutex: new Mutex(), // A mutex to prevent two ticks from executing at the same time.
	tickPostDelay: 1000, // Delay in milliseconds at the end of a tick before releasing the mutex.
	transactionTimeoutDelay: 5 * 60 * 1000, // Delay in milliseconds before a confirming transaction will time out.
	transactionFee: 100_000, // Amount in Shannons to be paid as the transaction fee.
};

export default config;
