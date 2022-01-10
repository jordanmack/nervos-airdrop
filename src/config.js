import {Mutex} from 'async-mutex';

const config =
{
	testnet:
	{
		ckbRpcUrl: '//rpc-testnet.ckb.tools',
		ckbIndexerUrl: '//indexer-testnet.ckb.tools',
		ckbExplorerUrl: '//explorer.nervos.org/aggron/',
		godwokenExplorerUrl: '//aggron.layerview.io/',
		faucetUrl: 'https://faucet.nervos.org/',

		addressTranslatorConfig:
		{
			CKB_URL: '//rpc-testnet.ckb.tools',
			INDEXER_URL: '//indexer-testnet.ckb.tools',
			RPC_URL: '//godwoken-testnet-web3-rpc.ckbapp.dev',
			deposit_lock_script_type_hash: '0x5a2506bb68d81a11dcadad4cb7eae62a17c43c619fe47ac8037bc8ce2dd90360',
			eth_account_lock_script_type_hash: '0xdeec13a7b8e100579541384ccaf4b5223733e4a5483c3aec95ddc4c1d5ea5b22',
			portal_wallet_lock_hash: '0x58c5f491aba6d61678b7cf7edf4910b1f5e00ec0cde2f42e0abb4fd9aff25a63',
			rollup_type_hash: '0x4cc2e6526204ae6a2e8fcf12f7ad472f41a1606d5b9624beebd215d780809f6a',
			rollup_type_script:
			{
				code_hash: "0x5c365147bb6c40e817a2a53e0dec3661f7390cc77f0c02db138303177b12e9fb",
				hash_type: "type",
				args: "0x213743d13048e9f36728c547ab736023a7426e15a3d7d1c82f43ec3b5f266df2"
			}
		}
	},

	mainnet:
	{
		ckbRpcUrl: '//rpc.ckb.tools',
		ckbIndexerUrl: '//indexer.ckb.tools',
		ckbExplorerUrl: '//explorer.nervos.org/',
		godwokenExplorerUrl: '//www.layerview.io/',

		addressTranslatorConfig:
		{
			CKB_URL: '//rpc.ckb.tools',
			INDEXER_URL: '//indexer.ckb.tools',
			RPC_URL: '//mainnet.godwoken.io/rpc',
			deposit_lock_script_type_hash: '0xe24164e2204f998b088920405dece3dcfd5c1fbcb23aecfce4b3d3edf1488897',
			eth_account_lock_script_type_hash: '0x1563080d175bf8ddd44a48e850cecf0c0b4575835756eb5ffd53ad830931b9f9',
			portal_wallet_lock_hash: '0xbf43c3602455798c1a61a596e0d95278864c552fafe231c063b3fabf97a8febc',
			rollup_type_hash: '0x40d73f0d3c561fcaae330eabc030d8d96a9d0af36d0c5114883658a350cb9e3b',
			rollup_type_script:
			{
				code_hash: '0xa9267ff5a16f38aa9382608eb9022883a78e6a40855107bb59f8406cce00e981',
				hash_type: 'type',
				args: '0x2d8d67c8d73453c1a6d6d600e491b303910802e0cc90a709da9b15d26c5c48b3'
			}
		}
	},

	tickDelay: 200, // Delay in milliseconds between state ticks.
	tickMutex: new Mutex(), // A mutex to prevent two ticks from executing at the same time.
	tickPostDelay: 1000, // Delay in milliseconds at the end of a tick before releasing the mutex.
	transactionTimeoutDelay: 10 * 60 * 1000, // Delay in milliseconds before a confirming transaction will time out.
	transactionFee: 100_000, // Amount in Shannons to be paid as the transaction fee.
};

export default config;
