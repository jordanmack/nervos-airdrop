enum ChainType
{
	mainnet,
	testnet,
}

type ChainTypeString = 'mainnet'|'testnet';

enum State
{
	Active,
	BuildTx,
	ConfirmTx,
	SendTx,
	Stopped,
	Validate
}

export {ChainType, State};
export type {ChainTypeString};
