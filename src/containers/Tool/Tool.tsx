import React, {useState, useEffect} from 'react';
import {RPC} from 'ckb-js-toolkit';
import {tryAcquire, E_ALREADY_LOCKED} from 'async-mutex';
import {AddressPrefix, privateKeyToAddress} from '@nervosnetwork/ckb-sdk-utils';
import {AddressTranslator, IAddressTranslatorConfig} from 'nervos-godwoken-integration';
import {chunk as _chunk} from 'lodash';
import PWCore, {Address, AddressType, Amount, AmountUnit, ChainID, Transaction, RawProvider} from '@lay2/pw-core';
import {SegmentedControlWithoutStyles as SegmentedControl} from 'segmented-control';
import {toast} from 'react-toastify';

import Config from '../../config.js';
import AirdropBuilder from '../../builders/AirdropBuilder';
import BasicCollector from '../../collectors/BasicCollector';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import {ChainType, State} from '../../common/ts/Types';
import type {RecipientsPaidInfo, TransactionInfo} from '.';
import type {ChainTypeString} from '../../common/ts/Types';
import NullCollector from '../../collectors/NullCollector';
import NullProvider from '../../providers/NullProvider';
import {sleep} from '../../common/ts/Utils';
import './Tool.scss';

async function generateDestinationAddress(address: string, chainType: ChainType, recipientAddressType: AddressType)
{
	const addressTranslatorConfig: IAddressTranslatorConfig = (chainType === ChainType.mainnet) ? Config.mainnet.addressTranslatorConfig : Config.testnet.addressTranslatorConfig;

	if(recipientAddressType === AddressType.ckb)
		return new Address(address, AddressType.ckb);
	else if(recipientAddressType === AddressType.eth)
		return await new AddressTranslator(addressTranslatorConfig).getLayer2DepositAddress(address);
	else
		throw new Error('Invalid address type.');	
}

async function generateDestinationAddresses(recipients: string[], recipientsPerTx: number, currentChunk: number, chainType: ChainType, recipientAddressType: AddressType)
{
	const outputAddresses = [];
	const addressChunk = _chunk(recipients, recipientsPerTx)[currentChunk];

	for(const address of addressChunk)
	{
		outputAddresses.push(await generateDestinationAddress(address, chainType, recipientAddressType));
	}

	return outputAddresses;
}

function generateRecipientsPaidHtml(recipientsPaid: RecipientsPaidInfo[])
{
	const html = [];

	for(const [i, record] of recipientsPaid.entries())
	{
		if(record.addressType === AddressType.ckb)
		{
			const ckbAddress = record.ckbAddress!;
			const chainType = record.chainType;

			const explorerUrl = Config[ChainType[chainType] as ChainTypeString].ckbExplorerUrl + 'address/' + ckbAddress;
			const ckbAddressLabel = (ckbAddress.length <= 66) ? ckbAddress : `${ckbAddress.substring(0, 33)}...${ckbAddress.substring(ckbAddress.length-33)}`; 

			const line =
			(
				<p key={i}>
					<a href={explorerUrl} target="_blank" rel="noreferrer">{ckbAddressLabel}</a>
				</p>
			);
			html.push(line);
		}
		else if(record.addressType === AddressType.eth)
		{
			const ckbAddress = record.ckbAddress!;
			const ethAddress = record.ethAddress!;
			const chainType = record.chainType;

			const ckbExplorerUrl = Config[ChainType[chainType] as ChainTypeString].ckbExplorerUrl + 'address/' + ckbAddress;
			const ethExplorerUrl = Config[ChainType[chainType] as ChainTypeString].godwokenExplorerUrl + 'account/' + ethAddress;
			const ckbAddressLabel = (ckbAddress.length <= 66) ? ckbAddress : `${ckbAddress.substring(0, 33)}...${ckbAddress.substring(ckbAddress.length-33)}`; 

			const line =
			(
				<p key={i}>
					<a href={ckbExplorerUrl} target="_blank" rel="noreferrer">{ckbAddressLabel}</a>
					{" 🡒 "}
					<a href={ethExplorerUrl} target="_blank" rel="noreferrer">{ethAddress}</a>
				</p>
			);
			html.push(line);
		}
		else
			throw new Error('An unhandled address type was specified.');
	}

	return html;
}

function generateTransactionsHtml(transactions: TransactionInfo[])
{
	const html = [];

	for(const [i, transaction] of transactions.entries())
	{
		const explorerUrl = Config[ChainType[transaction.chainType] as ChainTypeString].ckbExplorerUrl;
		const line =
		(
			<p key={i}>
				<a href={explorerUrl+'transaction/'+transaction.txId} target="_blank" rel="noreferrer">{transaction.txId}</a>
			</p>
		);
		html.push(line);
	}

	return html;
}

function handleSetAddressType(setRecipientAddressType: React.Dispatch<any>, recipientAddressType: AddressType)
{
	setRecipientAddressType(recipientAddressType);
}

function handleSetChainType(chainType: ChainType, setChainType: React.Dispatch<any>, value: ChainType)
{
	if(value !== chainType)
	{
		setChainType(value);
	}
}

function handleSetCkbAddress(setCkbAddress: React.Dispatch<any>, chainType: ChainType, privateKey: string)
{
	if(privateKey !== null && isPrivateKeyValid(privateKey))
	{
		initPwCore(chainType)
		.then(()=>
		{
			const addressPrefix = (chainType === ChainType.mainnet) ? AddressPrefix.Mainnet : AddressPrefix.Testnet;
			setCkbAddress(privateKeyToAddress(privateKey, {prefix: addressPrefix}));
		});
	}
	else
		setCkbAddress('');
}

async function handleUpdateCkbAddressBalance(setCkbAddressBalance: React.Dispatch<any>, ckbAddress: string, chainType: ChainType)
{
	await initPwCore(chainType);

	if(ckbAddress.length > 0)
	{
		const address = new Address(ckbAddress, AddressType.ckb);

		if(address.valid())
		{
			const collector = new BasicCollector(Config[ChainType[chainType] as ChainTypeString].ckbIndexerUrl);
			const capacity = await collector.getBalance(address);
		
			setCkbAddressBalance(String(capacity));
		}
	}
	else
		setCkbAddressBalance('');
}

function handleSetPrivateKey(setPrivateKey: React.Dispatch<any>, privateKey: string)
{
	if(isPrivateKeyValid(privateKey))
		setPrivateKey(privateKey);
	else
		setPrivateKey(null);
}

function handleSetRecipients(setRecipients: React.Dispatch<any>, newRecipients: string)
{
	const recipients = newRecipients
		.replace(/\r/g, '')
		.split('\n')
		.map((e)=>e.trim())
		.filter((e)=>e.length>0);

	setRecipients(recipients);
}

function handleStartClick(setState: React.Dispatch<any>)
{
	setState(State.Active);
}

function handleStopClick(setState: React.Dispatch<any>, setTick: React.Dispatch<any>)
{
	setState(State.Stopped);
	setTick(new Date().getTime()); // Send a final tick.
}

function handleUpdateTicker(setTicker: React.Dispatch<any>, ticker: NodeJS.Timer|null, state: State, setTick: React.Dispatch<any>)
{
	if(state === State.Stopped && ticker !== null)
	{
		clearInterval(ticker);
		setTicker(null);
	}
	else if (state === State.Active && ticker === null)
	{
		const newTicker = setInterval(()=>{setTick(new Date().getTime())}, Config.tickDelay);
		setTicker(newTicker);
	}
}

function isPrivateKeyValid(privateKey: string)
{
	const regex = /^0x[a-f0-9]{64}$/gi;
	const valid = regex.test(privateKey);

	return valid;
}

async function initPwCore(chain: ChainType, rawProvider?: RawProvider)
{
	const provider = (rawProvider) ? rawProvider : new NullProvider();
	const collector = new NullCollector();
	const chainId = (chain === ChainType.mainnet) ? ChainID.ckb : ChainID.ckb_testnet;
	const pwCore = await new PWCore(Config[ChainType[chain] as 'mainnet'|'testnet'].ckbRpcUrl).init(provider, collector, chainId);

	return pwCore;
}

function updateTimeoutTicker(timeoutTicker: ReturnType<typeof setTimeout>|null, setTimeoutTicker: React.Dispatch<any>, setState: React.Dispatch<any>, setStatus: React.Dispatch<any>, setActive: boolean, replace: boolean = false)
{
	if((!setActive || replace) && !!timeoutTicker)
	{
		clearTimeout(timeoutTicker);
		setTimeoutTicker(null);
	}

	if(setActive && (!timeoutTicker || replace))
	{
		const timeout = setTimeout(()=>
		{
			const error = 'The current transaction failed to confirm before the timeout was reached.';
			console.error(error);
			toast.error(error);
			setState(State.Stopped);
			setStatus(error);
		}, Config.transactionTimeoutDelay);
		setTimeoutTicker(timeout);
	}
}

/**
 * Validates the amount to be sent to all recipients against the balance.
 */
async function validateAmounts(recipientCount: number, recipientAddressType: AddressType, paymentAmount: number, privateKey: string, chainType: ChainType)
{
	// Initialize PWCore.
	await initPwCore(chainType);

	// Check the sending amounts.
	if(recipientAddressType === AddressType.ckb && paymentAmount < 61)
		throw new Error(`The payment amount of ${paymentAmount} is less than the minimum of 61.`);
	else if(recipientAddressType === AddressType.eth && paymentAmount < 234)
		throw new Error(`The payment amount of ${paymentAmount} is less than the minimum of 234.`);

	// Convert the private key to an Address.
	const addressPrefix = (chainType === ChainType.mainnet) ? AddressPrefix.Mainnet : AddressPrefix.Testnet;
	const addressString = privateKeyToAddress(privateKey, {prefix: addressPrefix});
	const address = new Address(addressString, AddressType.ckb);

	// Query for the balance Amount on the Address.
	const collector = new BasicCollector(Config[ChainType[chainType] as ChainTypeString].ckbIndexerUrl);
	const addressBalance = await collector.getBalance(address);

	// Calculate the cost of the transaction. (count * amount + 61 (change cell) + 1 (tx fees)
	const neededAmount = new Amount(String(recipientCount * paymentAmount + 61 + 1), AmountUnit.ckb);

	// Check if the private key address has enough CKB to cover all transactions.
	if(neededAmount.gt(addressBalance))
		throw new Error(`Not enough CKBytes are available on the current address. (${(Number(neededAmount.toString())).toLocaleString()} CKBytes required.)`);
}

async function validatePrivateKey(privateKey: string)
{
	if(!isPrivateKeyValid(privateKey))
	{
		throw new Error('The private key specified is invalid.');
	}
}

async function validateRecipients(recipients: string[], recipientAddressType: AddressType, chainType: ChainType)
{
	// Check if there are no addresses.
	if(recipients.length === 0)
		throw new Error('No addresses were provided!');

	// Check if there are any duplicate addresses.
	let addressSet = new Set();
	for(let i = 0; i < recipients.length; i++)
	{
		if(addressSet.has(recipients[i]))
			throw new Error(`A duplicate address was provided at index ${i}: "${recipients[i]}"`);
		else
			addressSet.add(recipients[i]);
	}

	// Check each address to make sure it is valid.
	await initPwCore(chainType);
	for(const [i, recipientAddress] of recipients.entries())
	{
		let valid = true;

		// Check to see if the current address matched the current address type and chain type so we can give a better error message.
		if(recipientAddressType === AddressType.ckb)
		{
			const addressPrefix = (chainType === ChainType.mainnet) ? AddressPrefix.Mainnet : AddressPrefix.Testnet;
			if(recipientAddress.startsWith('ck') && !recipientAddress.startsWith(addressPrefix))
			{
				throw new Error(`A CKB address for the wrong chain type was provided at index ${i}: "${recipientAddress}"`);
			}
		}

		// The function `address.valid()` is supposed to return a bool, but it throws an error sometimes so we have to wrap it.
		try
		{
			const address = new Address(recipientAddress, recipientAddressType);
			if(!address.valid())
				valid = false;
		}
		catch(e)
		{
			console.error(e);
			valid = false;
		}

		if(!valid)
			throw new Error(`An invalid address was provided at index ${i}: "${recipientAddress}"`);
	}
}

function Component()
{
	const [recipients, setRecipients] = useState<string[]>([]);
	const [recipientsPaid, setRecipientsPaid] = useState<RecipientsPaidInfo[]>([]);
	const [recipientAddressType, setRecipientAddressType] = useState(AddressType.ckb);
	const [recipientAmount, setRecipientAmount] = useState(61);
	const [recipientsPerTx, setRecipientsPerTx] = useState(10);
	const [chainType, setChainType] = useState(ChainType.testnet);
	const [ckbAddress, setCkbAddress] = useState('');
	const [ckbAddressBalance, setCkbAddressBalance] = useState('');
	const [currentChunk, setCurrentChunk] = useState(0);
	const [loading, setLoading] = useState(false);
	const [privateKey, setPrivateKey] = useState<string>('');
	const [state, setState] = useState(State.Stopped);
	const [status, setStatus] = useState('Stopped');
	const [ticker, setTicker] = useState<ReturnType<typeof setInterval>|null>(null);
	const [tick, setTick] = useState(0);
	const [timeoutTicker, setTimeoutTicker] = useState<ReturnType<typeof setTimeout>|null>(null);
	const [transaction, setTransaction] = useState<Transaction|null>(null);
	const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
	const [txId, setTxId]= useState<string|null>(null);

	const handleSetRecipientsWrapper = (e: React.ChangeEvent<HTMLTextAreaElement>) => { handleSetRecipients(setRecipients, e.currentTarget.value); };
	const handleSetAddressTypeWrapper = (newAddressType: AddressType) => { handleSetAddressType(setRecipientAddressType, newAddressType); };
	const handleSetChainTypeWrapper = (newChainType: ChainType) => { handleSetChainType(chainType, setChainType, newChainType); };
	const handleSetPrivateKeyWrapper = (e: React.ChangeEvent<HTMLInputElement>) => { handleSetPrivateKey(setPrivateKey, e.currentTarget.value); handleSetCkbAddress(setCkbAddress, chainType, e.currentTarget.value); };
	const handleSetRecipientAmountWrapper = (e: React.ChangeEvent<HTMLInputElement>)=>{setRecipientAmount(parseInt(e.currentTarget.value));}
	const handleSetRecipientsPerTxWrapper = (e: React.ChangeEvent<HTMLInputElement>)=>{setRecipientsPerTx(parseInt(e.currentTarget.value));}
	const handleStartClickWrapper = (e: React.MouseEvent<HTMLButtonElement>) => { handleStartClick(setState); };
	const handleStopClickWrapper = (e: React.MouseEvent<HTMLButtonElement>) => { handleStopClick(setState, setTick); };
	const handleClearRecipientsPaid = (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); setRecipientsPaid([]); };
	const handleClearTransactions = (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); setTransactions([]); };

	/* eslint-disable react-hooks/exhaustive-deps */
	useEffect(()=>{handleSetCkbAddress(setCkbAddress, chainType, privateKey);}, [chainType, privateKey]); // Update the Sender CKB address.
	useEffect(()=>{handleUpdateCkbAddressBalance(setCkbAddressBalance, ckbAddress, chainType);}, [ckbAddress]); // Update the Sender CKB balance.
	useEffect(()=>{handleUpdateTicker(setTicker, ticker, state, setTick);setLoading(state!==State.Stopped)}, [state]); // Update the ticker based on the state.
	useEffect(()=> // Handle actions for the current tick. (This login needs to be in scope to get updated vars.)
	{
		tryAcquire(Config.tickMutex)
		.runExclusive(async ()=>
		{
			if(state===State.Active)
			{
				setCurrentChunk(0);
				setState(State.Validate);
				setStatus('Active.');
			}
			else if(state===State.Stopped)
			{
				setStatus('Stopped.');
			}
			else if(state===State.Validate)
			{
				setStatus('Validating data.');
	
				const promises =
				[
					validatePrivateKey(privateKey),
					validateRecipients(recipients, recipientAddressType, chainType),
					validateAmounts(recipients.length, recipientAddressType, recipientAmount, privateKey, chainType)
				];
				Promise.all(promises)
				.then(()=>
				{
					setState(State.BuildTx);
				})
				.catch((error)=>
				{
					setState(State.Stopped);
					setStatus('An error occurred during validation.');
					console.error(error);
					toast.error(String(error));
				});
			}
			else if(state===State.BuildTx)
			{
				const transactionCount = Math.ceil(recipients.length / recipientsPerTx);
				setStatus(`Building transaction ${currentChunk+1}/${transactionCount}.`);
	
				await initPwCore(chainType);

				const collector = new BasicCollector(Config[ChainType[chainType] as ChainTypeString].ckbIndexerUrl);
				const fee = new Amount(String(Config.transactionFee), AmountUnit.shannon);
				const destinationAddresses = await generateDestinationAddresses(recipients, recipientsPerTx, currentChunk, chainType, recipientAddressType);
				const builder = new AirdropBuilder(new Address(ckbAddress, AddressType.ckb), destinationAddresses, new Amount(String(recipientAmount), AmountUnit.ckb), collector, fee);
				const transaction = await builder.build();
				console.info(transaction);

				setTransaction(transaction);
				setState(State.SendTx);
			}
			else if(state===State.SendTx)
			{
				const transactionCount = Math.ceil(recipients.length / recipientsPerTx);
				setStatus(`Sending transaction ${currentChunk+1}/${transactionCount}.`);

				const pwCore = await initPwCore(chainType, new RawProvider(privateKey!));
				try
				{
					const txId = await pwCore.sendTransaction(transaction!);
					console.log(`Transaction submitted: ${txId}`);

					setTransactions(transactions.concat([{chainType, txId}]));
					setTxId(txId);

					const destinationAddresses = [];
					for(const [i, address] of _chunk(recipients, recipientsPerTx)[currentChunk].entries())
					{
						const record: RecipientsPaidInfo = {addressType: recipientAddressType, chainType};
						if(recipientAddressType === AddressType.ckb)
						{
							record.ckbAddress = address;
						}
						if(recipientAddressType === AddressType.eth)
						{
							record.ckbAddress = (await generateDestinationAddress(address, chainType, recipientAddressType)).toCKBAddress();
							record.ethAddress = address;
						}
						destinationAddresses[i] = record;
					}
					setRecipientsPaid(recipientsPaid.concat(destinationAddresses));

					setState(State.ConfirmTx);
				}
				catch(e)
				{
					console.error(e);
					const error = `An error occurred while sending a transaction.`;
					console.error(error);
					toast.error(error);
					setState(State.Stopped);
					setStatus(error);
				}
			}
			else if(state===State.ConfirmTx)
			{
				// Update the status bar.
				const transactionCount = Math.ceil(recipients.length / recipientsPerTx);
				setStatus(`Confirming transaction ${currentChunk+1}/${transactionCount}.`);

				// Set the timeout ticker.
				updateTimeoutTicker(timeoutTicker, setTimeoutTicker, setState, setStatus, true);

				// Try and catch is used here to suppress errors because status updates are a non-essential background process.
				try
				{
					// Retrieve the recently confirmed transaction IDs from the Indexer RPC.
					const rpc = new RPC(Config[ChainType[chainType] as 'mainnet'|'testnet'].ckbIndexerUrl);
					const lockScript = new Address(ckbAddress, AddressType.ckb).toLockScript();
					const params =
					{
						"script":
						{
							"code_hash": lockScript.codeHash,
							"hash_type": lockScript.hashType,
							"args": lockScript.args
						},
						"script_type": "lock"
					};
					const txData: any = await rpc.get_transactions(params, 'desc', '0x64');
					const txIds = txData?.objects?.map((o: any)=>o.tx_hash);

					// Check if the current TX ID is committed.
					if(!!txIds && txIds.includes(txId))
					{
						// Check if all chunks have processed.
						if(currentChunk+1 >= transactionCount)
						{
							// Airdrop is a success. Stop processing.
							const status = 'Airdrop completed successfully.';
							setStatus(status);
							toast.success(status);
							setState(State.Stopped);
						}
						else
						{
							// More chunks need to process. Continue with next chunk.
							setCurrentChunk(currentChunk+1);
							setState(State.BuildTx);
						}

						// Disable the current transaction timeout.
						updateTimeoutTicker(timeoutTicker, setTimeoutTicker, setState, setStatus, false);
					}
				}
				catch(e)
				{
					console.error(e);
					const error = `An error occurred while confirming a transaction.`;
					console.error(error);
					toast.error(error);
					setState(State.Stopped);
					setStatus(error);
					updateTimeoutTicker(timeoutTicker, setTimeoutTicker, setState, setStatus, false);
				}
			}
		
			await sleep(Config.tickPostDelay);
		})
		.catch((e)=>
		{
			if(e === E_ALREADY_LOCKED)
			{
				// console.debug(`Tick received but mutex is already locked.`);
			}
			else
			{
				console.error(e);
				const error = `An error occurred during processing.`;
				console.error(error);
				toast.error(error);
				setState(State.Stopped);
				setStatus(error);
				updateTimeoutTicker(timeoutTicker, setTimeoutTicker, setState, setStatus, false);
			}
		});
	}, [tick]);
	/* eslint-enable react-hooks/exhaustive-deps */

	const html =
	(
		<main className="tool">
			<p>
				The Nervos Airdrop Tool is designed to help send CKBytes to a large number of addresses easily.
				This tool is intended only for internal use by the Nervos Foundation.
				<strong>Please do not share this tool externally.</strong>
			</p>
			<form>
				<fieldset>
					<legend>Sender</legend>
					<label>
						Chain Type
						<SegmentedControl name="chain-type" setValue={handleSetChainTypeWrapper} options=
							{
								[
									{label: 'Mainnet', value: ChainType.mainnet, disabled: state!==State.Stopped},
									{label: 'Testnet', value: ChainType.testnet, default: true, disabled: state!==State.Stopped},
								]
							}
						/>
					</label>
					<label>
						Private Key
						<input type="text" className="private-key" onChange={handleSetPrivateKeyWrapper} placeholder="Enter a 256-bit (32 byte) private key in hex format." pattern="^0x[a-fA-F0-9]{64}$" maxLength={66} readOnly={state!==State.Stopped} />
					</label>
					<div className="grid-2">
						<label>
							CKB Address
							<input type="text" className="ckb-address" readOnly={true} value={ckbAddress} />
						</label>
						<label>
							CKB Address Balance
							<input type="text" className="ckb-address-balance" readOnly={true} value={ckbAddressBalance && `${Number(ckbAddressBalance).toLocaleString()} CKBytes`} />
						</label>
					</div>
				</fieldset>
				<fieldset>
					<legend>Recipients</legend>
					<label>
						Recipient Address Type
						<SegmentedControl name="address-type" setValue={handleSetAddressTypeWrapper} options=
							{
								[
									{label: 'CKB (L1)', value: AddressType.ckb, default: true, disabled: state!==State.Stopped},
									{label: 'ETH (Godwoken L2)', value: AddressType.eth, disabled: state!==State.Stopped},
								]
							}
						/>
					</label>
					<label>
						Recipient Addresses - One Per Line {`(${recipients.length})`}
						<textarea className="recipient-addresses" onChange={handleSetRecipientsWrapper} defaultValue={recipients.join('\r\n')} readOnly={state!==State.Stopped} />
					</label>
					<div className="grid-2">
						<label>
							Amount of CKB to Send to Each Address
							<input type="number" className="ckb-amount" defaultValue={String(recipientAmount)} onChange={handleSetRecipientAmountWrapper} readOnly={state!==State.Stopped} />
						</label>
						<label>
							Recipients Per Transaction
							<input type="number" className="recipients-per-tx" defaultValue={String(recipientsPerTx)} min="1" max="100" onChange={handleSetRecipientsPerTxWrapper} readOnly={state!==State.Stopped} />
						</label>
					</div>
					<div className="action-buttons grid-2">
						<button disabled={state!==State.Stopped} onClick={handleStartClickWrapper}>Start</button>
						<button disabled={state===State.Stopped} onClick={handleStopClickWrapper}>Stop</button>
					</div>
				</fieldset>
				<fieldset>
					<legend>Status</legend>
					<label>
						Status
						<input type="text" className="status" readOnly={true} value={status} />
					</label>
					<label>
						Addresses Paid {`(${recipientsPaid.length})`}
						<span className="action-bar">[<a href="#ClearAddressesPaid" onClick={handleClearRecipientsPaid}>clear</a>]</span>
						<div className="paid-addresses">
							{generateRecipientsPaidHtml(recipientsPaid)}
						</div>
					</label>
					<label>
						Transactions {`(${transactions.length})`}
						<span className="action-bar">[<a href="#ClearTransactions" onClick={handleClearTransactions}>clear</a>]</span>
						<div className="transactions">
							{generateTransactionsHtml(transactions)}
						</div>
					</label>
				</fieldset>
			</form>
			{loading && <LoadingSpinner />}
		</main>
	);
	return html;
}

export default Component;
