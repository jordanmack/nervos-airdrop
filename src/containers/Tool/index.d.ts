import {AddressType} from '@lay2/pw-core';
import {ChainType} from '../../common/ts/Types';

type RecipientsPaidInfo =
{
	addressType: AddressType,
	chainType: ChainType,
	ckbAddress?: string,
	ethAddress?: string,
};

type TransactionInfo =
{
	chainType: ChainType,
	txId: string,
};

export type {RecipientsPaidInfo, TransactionInfo};
