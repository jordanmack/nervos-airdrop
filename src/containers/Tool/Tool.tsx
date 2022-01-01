import React, {useState, useEffect} from 'react';
import {RPC} from 'ckb-js-toolkit';
import {tryAcquire, E_ALREADY_LOCKED} from 'async-mutex';
import {AddressPrefix, privateKeyToAddress} from '@nervosnetwork/ckb-sdk-utils';
import {chunk as _chunk} from 'lodash';
import PWCore, {Address, AddressType, Amount, AmountUnit, ChainID, Transaction, RawProvider} from '@lay2/pw-core';
import {SegmentedControlWithoutStyles as SegmentedControl} from 'segmented-control';
import {toast} from 'react-toastify';

import Config from '../../config.js';
import AirdropBuilder from '../../builders/AirdropBuilder';
import BasicCollector from '../../collectors/BasicCollector';
import {ChainType, State} from '../../common/ts/Types';
import type {ChainTypeString} from '../../common/ts/Types';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import NullCollector from '../../collectors/NullCollector';
import NullProvider from '../../providers/NullProvider';
import './Tool.scss';

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

function handleSetCkbAddress(setCkbAddress: React.Dispatch<any>, chainType: ChainType, privateKey: string|null)
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
		const newTicker = setInterval(()=>{setTick(new Date().getTime())}, Config.tickerDelay);
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

// TODO: Validate the private key.
// TODO: Validate the amounts.
// TODO: Validate for duplicates.
async function validateRecipients(recipients: string[], recipientAddressType: AddressType, chainType: ChainType)
{
	await initPwCore(chainType);

	let invalidAddressFound = false;

	if(recipients.length === 0)
	{
		const error = 'No addresses were provided!';
		console.error(error);
		toast.error(error);
		
		return false;
	}

	for(const [i, recipientAddress] of recipients.entries())
	{
		let valid = true;

		try
		{
			const address = new Address(recipientAddress, AddressType.ckb);
			if(!address.valid())
				valid = false;
		}
		catch(e)
		{
			valid = false;
		}

		if(!valid)
		{
			const error = `An invalid CKB address was provided at index ${i}: "${recipientAddress}"`;
			console.error(error);
			toast.error(error);
			invalidAddressFound = true;
			break;
		}
	}

	return !invalidAddressFound;
}

function Component()
{
	const [recipients, setRecipients] = useState<string[]>(['ckt1qyqz5ekzfs07qj3ey4cnj368al3hwets5h3q50csfk','ckt1qyqq2txzjj6y32p6j7se3lxfkw7vn4syq0sqd3ny8q','ckt1qyqd956w8ntjs5uh4w98f43dg4unqy9utf0qh5jdle','ckt1qyqyvvanq53y7jgdk02392whncml75jfwq7qenra7h','ckt1qyqz8wt42cg7g9hgwymd9xtvexr9lpwdyaaq452sv0','ckt1qyqf733wnlkdgvme0gqvsqsus4pu5st0aezqg30psk','ckt1qyq8ttvs5cg9x3z8yy9h4xpehvt05cspvk5sffe6xh','ckt1qyqpt4sr98aftqjc8s9kq0z5g3yhmj63mumqtqra67','ckt1qyq2afuhpuy7cgu7ydghzxn85jlsgh5599vs2xs5h6','ckt1qyqt934e0w6ds0saz05hm2dkr8dsjwzfwlvs44yew4']);
	const [recipientsPaid, setRecipientsPaid] = useState<string[]>([]);
	const [recipientAddressType, setRecipientAddressType] = useState(AddressType.ckb);
	const [recipientAmount, setRecipientAmount] = useState(61);
	const [recipientsPerTx, setRecipientsPerTx] = useState(2);
	const [chainType, setChainType] = useState(ChainType.testnet);
	const [ckbAddress, setCkbAddress] = useState('');
	const [ckbAddressBalance, setCkbAddressBalance] = useState('');
	const [loading] = useState(false);
	const [privateKey, setPrivateKey] = useState<string|null>(null);
	const [state, setState] = useState(State.Stopped);
	const [status, setStatus] = useState('Stopped');
	const [ticker, setTicker] = useState<NodeJS.Timer|null>(null);
	const [tick, setTick] = useState(0);
	const [currentChunk, setCurrentChunk] = useState(0);
	const [transaction, setTransaction] = useState<Transaction|null>(null);
	const [transactions, setTransactions] = useState<string[]>([]);
	const [txId, setTxId]= useState<string|null>(null);

	const handleSetRecipientsWrapper = (e: React.ChangeEvent<HTMLTextAreaElement>) => { handleSetRecipients(setRecipients, e.currentTarget.value); };
	const handleSetAddressTypeWrapper = (newAddressType: AddressType) => { handleSetAddressType(setRecipientAddressType, newAddressType); };
	const handleSetChainTypeWrapper = (newChainType: ChainType) => { handleSetChainType(chainType, setChainType, newChainType); };
	const handleSetPrivateKeyWrapper = (e: React.ChangeEvent<HTMLInputElement>) => { handleSetPrivateKey(setPrivateKey, e.currentTarget.value); handleSetCkbAddress(setCkbAddress, chainType, e.currentTarget.value); };
	const handleSetRecipientAmountWrapper = (e: React.ChangeEvent<HTMLInputElement>)=>{setRecipientAmount(parseInt(e.currentTarget.value));}
	const handleSetRecipientsPerTxWrapper = (e: React.ChangeEvent<HTMLInputElement>)=>{setRecipientsPerTx(parseInt(e.currentTarget.value));}
	const handleStartClickWrapper = (e: React.MouseEvent<HTMLButtonElement>) => { handleStartClick(setState); };
	const handleStopClickWrapper = (e: React.MouseEvent<HTMLButtonElement>) => { handleStopClick(setState, setTick); };

	/* eslint-disable react-hooks/exhaustive-deps */
	// This effect is for debugging purposes only.
	useEffect(()=>
	{
		const newPrivateKey = '0xece37052405f4ec36103ca0f7c1cddc797a476608f18a0fd0a21e87a8d4b09c7';
		handleSetPrivateKey(setPrivateKey, newPrivateKey);
		handleSetCkbAddress(setCkbAddress, chainType, newPrivateKey);
	}, [true]);
	useEffect(()=>{handleSetCkbAddress(setCkbAddress, chainType, privateKey);}, [chainType, privateKey]); // Update the Sender CKB address.
	useEffect(()=>{handleUpdateCkbAddressBalance(setCkbAddressBalance, ckbAddress, chainType);}, [ckbAddress]); // Update the Sender CKB balance.
	useEffect(()=>{handleUpdateTicker(setTicker, ticker, state, setTick);}, [state]); // Update the ticker based on the state.
	useEffect(()=> // Handle actions for the current tick. (This login needs to be in scope to get updated vars.)
	{
		tryAcquire(Config.tickMutex)
		.runExclusive(async ()=>
		{
			if(state===State.Active)
			{
				setCurrentChunk(0);
				setRecipientsPaid([]);
				setState(State.Validate);
				setStatus('Active.');
			}
			else if(state===State.Stopped)
			{
				setStatus('Stopped.');
			}
			else if(state===State.Validate)
			{
				setStatus('Validating addresses.');
	
				validateRecipients(recipients, recipientAddressType, chainType)
				.then((valid)=>
				{
					if(!valid)
					{
						setState(State.Stopped);
						setStatus('An error occurred during address validation.');
					}
					else
						setState(State.BuildTx);
				});
			}
			else if(state===State.BuildTx)
			{
				const transactionCount = Math.ceil(recipients.length / recipientsPerTx);
				setStatus(`Building transaction ${currentChunk+1}/${transactionCount}.`);
	
				await initPwCore(chainType);

				const collector = new BasicCollector(Config[ChainType[chainType] as ChainTypeString].ckbIndexerUrl);
				const fee = new Amount(String(Config.transactionFee), AmountUnit.shannon);
				const destinationAddresses = _chunk(recipients, recipientsPerTx)[currentChunk].map((a)=>new Address(a, AddressType.ckb));
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

					setTransactions(transactions.concat([txId]));
					setTxId(txId);

					const destinationAddresses = _chunk(recipients, recipientsPerTx)[currentChunk];
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

				setState(State.ConfirmTx);
			}
			else if(state===State.ConfirmTx)
			{
				const transactionCount = Math.ceil(recipients.length / recipientsPerTx);
				setStatus(`Confirming transaction ${currentChunk+1}/${transactionCount}.`);
	
				// Try and catch is used here to suppress errors because status updates are a non-essential background process.
				try
				{
					// Retrieve the status from the RPC.
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
					// console.log(txData);
					const hashes = txData['objects'].map((o: any)=>o.tx_hash); // TODO: Verify this is safe.

					// Check if status is committed.
					if(hashes.includes(txId))
					{
						if(currentChunk+1 >= transactionCount)
						{
							setState(State.Stopped);
							setStatus('Airdrop Completed.');
						}
						else
						{
							setCurrentChunk(currentChunk+1);
							setState(State.BuildTx);
						}
					}

					// TODO: There needs to be a process timeout and detection of failed TXs.
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
		})
		.catch((e)=>
		{
			if(e === E_ALREADY_LOCKED)
			{
				// console.debug(`Tick received but mutex is already locked.`);
			}
		});
	}, [tick]);
	/* eslint-enable react-hooks/exhaustive-deps */

	const html =
	(
		<main className="tool">
			<p>
				The Nervos Airdrop Tool is designed to help send CKBytes to a large number of addresses easily. This tool is designed only for internal use by the Nervos Foundation. <strong>Please do not share this tool externally.</strong>
			</p>
			<form>
				<fieldset>
					<legend>Sender</legend>
					<label>
						Chain Type
						<SegmentedControl name="chain-type" setValue={handleSetChainTypeWrapper} options=
							{
								[
									{label: 'Mainnet', value: ChainType.mainnet},
									{label: 'Testnet', value: ChainType.testnet, default: true},
								]
							}
						/>
					</label>
					<label>
						Private Key
						<input type="text" className="private-key" onChange={handleSetPrivateKeyWrapper} placeholder="Enter a 256-bit (32 byte) private key in hex format." defaultValue="0xece37052405f4ec36103ca0f7c1cddc797a476608f18a0fd0a21e87a8d4b09c7" pattern="^0x[a-fA-F0-9]{64}$" maxLength={66} />
					</label>
					<div className="grid-2">
						<label>
							CKB Address
							<input type="text" className="ckb-address" disabled={true} value={ckbAddress} />
						</label>
						<label>
							CKB Address Balance
							<input type="text" className="ckb-address-balance" disabled={true} value={ckbAddressBalance && `${Number(ckbAddressBalance).toLocaleString()} CKBytes`} />
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
									{label: 'CKB (L1)', value: AddressType.ckb, default: true},
									{label: 'ETH (Godwoken L2)', value: AddressType.eth},
								]
							}
						/>
					</label>
					<label>
						Recipient Addresses - One Per Line {`(${recipients.length})`}
						{/* <textarea className="recipient-addresses" onChange={handleSetRecipientsWrapper} readOnly={state!==State.Stopped}></textarea> */}
						<textarea className="recipient-addresses" onChange={handleSetRecipientsWrapper} defaultValue={recipients.join('\r\n')} />
					</label>
					<div className="grid-2">
						<label>
							Amount of CKB to Send to Each Address
							<input type="number" className="ckb-amount" defaultValue={String(recipientAmount)} onChange={handleSetRecipientAmountWrapper} disabled={state!==State.Stopped} />
						</label>
						<label>
							Recipients Per Transaction
							<input type="number" className="recipients-per-tx" defaultValue={String(recipientsPerTx)} min="1" max="100" onChange={handleSetRecipientsPerTxWrapper} disabled={state!==State.Stopped} />
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
						<input type="text" className="status" disabled={true} value={status} />
					</label>
					<label>
						Paid Addresses {`(${recipientsPaid.length})`}
						<textarea className="recipient-addresses" readOnly={true} value={recipientsPaid.join('\r\n')} />
					</label>
					<label>
						Transactions {`(${transactions.length})`}
						<textarea className="recipient-addresses" readOnly={true} value={transactions.join('\r\n')} />
					</label>
				</fieldset>
			</form>
			{loading && <LoadingSpinner /> }
		</main>
	);
	return html;
}

export default Component;
