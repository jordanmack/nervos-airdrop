import React, {useState, useEffect} from 'react';
import {RPC} from 'ckb-js-toolkit';
import {tryAcquire, E_ALREADY_LOCKED} from 'async-mutex';
import {AddressPrefix, privateKeyToAddress} from '@nervosnetwork/ckb-sdk-utils';
import {chunk as _chunk} from 'lodash';
import PWCore, {Address, AddressType, Amount, AmountUnit, ChainID, Transaction, RawProvider} from '@lay2/pw-core';
import {SegmentedControlWithoutStyles as SegmentedControl} from 'segmented-control';
import {toast} from 'react-toastify';

import Config from '../../config.js';
import {sleep} from '../../common/ts/Utils';
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

/**
 * Validates the amount to be sent to all recipients against the balance.
 */
async function validateAmounts(recipientCount: number, paymentAmount: number, privateKey: string, chainType: ChainType)
{
	// Initialize PWCore.
	await initPwCore(chainType);

	// Validate the private key.
	if(!isPrivateKeyValid(privateKey))
		throw new Error('The private key specified is invalid.');

	// Convert the private key to an Address.
	const addressPrefix = (chainType === ChainType.mainnet) ? AddressPrefix.Mainnet : AddressPrefix.Testnet;
	const addressString = privateKeyToAddress(privateKey, {prefix: addressPrefix});
	const address = new Address(addressString, AddressType.ckb);

	// Query for the balance Amount on the Address.
	const collector = new BasicCollector(Config[ChainType[chainType] as ChainTypeString].ckbIndexerUrl);
	const addressBalance = await collector.getBalance(address);

	// Calculate the cost of the transaction. (count * amount + 61 (change cell) + 1 (tx fees)
	const neededAmount = new Amount(String(recipientCount * paymentAmount + 61 + 1), AmountUnit.ckb);

	// check if the private key address has enough CKB to cover all transactions.
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

		// Check to see if the current address matched the current chain type.
		const addressPrefix = (chainType === ChainType.mainnet) ? AddressPrefix.Mainnet : AddressPrefix.Testnet;
		if(!recipientAddress.startsWith(addressPrefix))
		{
			throw new Error(`A CKB address for the wrong chain type was provided at index ${i}: "${recipientAddress}"`);
		}

		// The function `address.valid()` is supposed to return a bool, but it throws an error sometimes so we have to wrap it.
		try
		{
			const address = new Address(recipientAddress, AddressType.ckb);
			if(!address.valid())
				valid = false;
		}
		catch(e)
		{
			console.error(e);
			valid = false;
		}

		if(!valid)
			throw new Error(`An invalid CKB address was provided at index ${i}: "${recipientAddress}"`);
	}
}

function Component()
{
	const [recipients, setRecipients] = useState<string[]>(['ckt1qyqqn3a2a3cfpt0zqxa3wn9hmpp9wu26y3ssfh8jts','ckt1qyqp2zz6wm9hhnyyet3p5mfffexw3kwvhwwq2urt46','ckt1qyqy429adudqv4w360tv5490swuhvrxrgxaqtxlsqz','ckt1qyqz5mkf65vykn3nz8l3qyypw0knf050k5uqkpnmfn','ckt1qyqvdf2dypc7zfg4c7s95hlrgstkxjz63xsqvvkrx9','ckt1qyqrrnjd5y9gt7qsz04md5gy3xc9lp00er9srl94f2','ckt1qyq8rhjp33stx2a8egc9hra7d052afmf5rnqwm6xge','ckt1qyqdk8jzckcq82tkg9r8xx6uqrd6rg9tt84qyvqcvj','ckt1qyq8u9j3mh0hgk2ke8062lrkws5pjawqqd4qs3tqfp','ckt1qyqtknuwwdp6wc7w0tv3h4gsc0pqm4ccu06sfy3clw','ckt1qyq8de4c59nyda38psx5zqj9vnqpl9tsgf4qpg2v0k','ckt1qyq8j5m4ftj7d22xfpmthxcq52qadr2pq26q426xwa','ckt1qyqdrcf9gvmcqjs2fz02h7ffqfgjkqldz0sqaep2rd','ckt1qyqp8tzh7dza53racfat8m8pdapuczvqxqkqkhrvsf','ckt1qyqr7pv8zgq9360x4n5fvrsjw4yr0p53j55qdhqu49','ckt1qyqw4dr2vcu8fkkzwxrgcxatxqzvaj3jl39qwycqrl','ckt1qyqg674d8weq4td3nam4ycqg8lmhvenwphkqr2mh2n','ckt1qyqy66le6yqntpqva93rnvly5tng6fvt9sasyg8px0','ckt1qyq8jnutu4t03jjnrxl9j5v22kahvnu6msdqk45vyc','ckt1qyq233p4cf7x5d3dtgn4tkj8m3w8vvd59f5q76fefr','ckt1qyq80e5cug943hkpxgpa7uw9ps2usjfr8lfqup3s9k','ckt1qyqxlddzv9flp0gvsrg7yytcnrds4ngu92hqgupf0v','ckt1qyqrrgu60zg30cd9pnlexkehzj7qs5j93ltqdg6gcd','ckt1qyqtxmayqqhj6kg38d4svcnrfxrumj43x2rslh5plm','ckt1qyqgjnq45hj3qryhvysq40huzjdzzdt6v4ssp9g98x','ckt1qyq9k4yu804urrhn4lldnf242yf6wavt4srs456720','ckt1qyq2fqzwednn0zvd2sehqkzn0wd5vgrccrksgcqxvs','ckt1qyq96jupzn8yj9tg9avhar0el69cdh8mp65s6dya0e','ckt1qyqz5ltafeqp43zppczavqn45vkf3f577kgqxuwklj','ckt1qyqd0w5yjrwyf8ee35gjxwm2gk0lmtqtaf7smsjl9x','ckt1qyq9a6jyhdgce3tsh48txlf5pudgsurl2l3swkqssq','ckt1qyq0h7rt2wlf23005de8mpgtmkrznnyhdfdq4mrnls','ckt1qyq90069955vrhp2ervgvdv0qxxgnp2y8tpqusr3rl','ckt1qyq8l44lqkpz69q9sh2sg0alsk9ar2uwh4ws4nwy0m','ckt1qyqwh7czsjdza5tj5ltgfp7nztgry3tcuqrs0nvenk','ckt1qyqfmzg02vymxf4y40ukum6xtzd397mj359s3nhley','ckt1qyqzntrl23vhncuwmreaj7pvsfepa89zgt9su56e8y','ckt1qyqzm6mymfpqv2tea8rq7m8qnaas46g0jr5sk3qd8t','ckt1qyq9k9tlzknqj0jwvhjp3027622xqagpjq8sgg0xy4','ckt1qyqd7zxl7vrz2nnd6zmafesxl7jq3p7mrx0qvml0rf','ckt1qyq8c9cv0zca3m82nuzgc9nxt60v60wpv24qgd7hu3','ckt1qyqxgdg4vk2mfm3kgpn70fygwfm9qs67mktszg94p8','ckt1qyqd87cg2qdzkt6qhhtjzt9j57g6rm8vazxqt4djn2','ckt1qyqv5m7rsxp9z75r8r0wujehdq66dteqxxasyt9ht5','ckt1qyqyt7xke2knd6pfdwdq3p99fenm8pkgxhlqju0kfu','ckt1qyqxxenl32ydflazjhvdp0heuuxzjmx437csrged5p','ckt1qyq9z33dm9rt59w9lcg440jur6ht9z7vuj9q9fkptm','ckt1qyq0xdc5ds5theyhyw9yryt5hsdyg9qmv4nqkc24ew','ckt1qyqyk0yl8qx7j42mhgc6kxtjdkktk8qly6asngvheq','ckt1qyqzngah5teqpt7err93qzp2eg7g94act58sd4vvdd','ckt1qyqwspm3qjfhggqjxswt3kwstmufpzspnq9s37367f','ckt1qyqdt7yhxyuvfhzjpvl4kj667sve94qtxcuqv7kpyv','ckt1qyq0vgltcxe4n273k6ezwcztncqwfzsx89msstjuqz','ckt1qyqrhqwzu20r98e2wf6dgr4s4et5k90jk5jqp6n9tl','ckt1qyq2sxw6w5ksgt68msnzl3d3j7vvg5sdrrrste5jv9','ckt1qyqvkv9dmzw3s0l8tjxf7exl0dmdkcfezhzq9s8c2p','ckt1qyqfh55rzm0j89qdg8engrdu7c5uxh3r5rfsdce3dm','ckt1qyqrzdvk88r4feq8ck8t2k577nwhu5s8e7lsh90srk','ckt1qyqqtajkgrqj0p5zaqnyf4p4lj38qam9ckqq0ekyjy','ckt1qyqgyvwz08rlrgpcr3jvmu67yq0zx22h433sl6nf2m','ckt1qyqdh068ej5qdj95p6s076s2gza8dmuuk7rsmaswru','ckt1qyqr5mjy2mey5yhsff3cg3nnzyqlweegcx5q0zen7u','ckt1qyq8f4ar6qfngk8khrp7ztr2rtlx8ktz3szsgh0aqn','ckt1qyqrjeknus2azyl9x08c2mqtj5r275nyxj5qs4mylw','ckt1qyqt5suusf6k9vnzgs3gc0ux503crw0ugk0q8ajzr9','ckt1qyqxmg4qpfwmvja9m9ugem50vwkmjzk7dl3qn3pn8u','ckt1qyqrw5cwu4x6t5vpx4mnk99hpg4pv8pmzywqgn0ue7','ckt1qyqx98ty5t4hzuyyp9hc0efgjr9g54ujaccswx08td','ckt1qyqf49zj0cv5g3pwj9pch8ga8p2mkjgm5dpqkx03v8','ckt1qyq262flya3j077cfmkg444ga2vl7n0h485sqref5v','ckt1qyqqygfpkgc6u3763pm39f0lxm5k8m3mq0msdd5x36','ckt1qyqve30ce98wcde9esusjweke3rreg8ycdgs4zx23a','ckt1qyqvlkzn56k879d2984uduu4rvf2fmnptslsjukgfm','ckt1qyq8nv3vgv6hgvahellk7hjvtrmkugsw69jszx8n6k','ckt1qyqfflfgh2rsdxhf9tec8pfewudc6zuk8yfqhkn25j','ckt1qyqdlsrkh3k6mrj7ass7j65kq02jwcmarm6stppwkp','ckt1qyq0znkagxhdheqksldpl2k4utvfyh9wvadsgz4d3d','ckt1qyq9q0rwuexqaz3xv5y0m7llza9cgdul9pqske0svz','ckt1qyqdynlmcr7hhhyf5vtqlel3r58awjp27jcqhn68jw','ckt1qyqfszgxjwcyn0a6u0cmya8qzcv9hzs4qezs2qxng0','ckt1qyqr83fu0ft5glv3xj73af39cra7unhtsf2sn858c4','ckt1qyq998y773vv6lengrxzsxpyywqdxx88eyls3srhae','ckt1qyqyjkp7nzalwte30azuhlvgjm90jv5l6j3qsvkkje','ckt1qyqp67fvkm43hqpxkk2pyuu70w8zum59gr9q75ydc5','ckt1qyqtdj40t2eytfpwwszg2xh3v56unmsxyghqujgxw6','ckt1qyqyjv39vfd3vy0a2337kmuuq9hj0vzzxzgskzgh6l','ckt1qyqyhsj0j550qxf7vf52havc4n74vm95rtes92m4yn','ckt1qyq2zycny4swsc47aftdwxjpjpalaquy9ddqgwsmf0','ckt1qyqyqj0j2t8hsry66rzw2grz6hy5f7w05jdqcuq83q','ckt1qyqwzftxr68x03ep4ngclc3lp3s4fwq5x8aqrlv2yy','ckt1qyq2v9p5zhdxd5yvyu4x0x0mahw4p9ljpa9qkejrvn','ckt1qyqqcly0ap5p06q8tqvz584kzxlyl5mqa2as6sk9n6','ckt1qyqq4dlq77jdmnyjmy4cjzkypzxwy4puv4jsc8mans','ckt1qyqgw3n7dynywplq4qlte6ycc04ypnzkt2csp5etlm','ckt1qyq04xcu22qwejuhnrfergvdp5tppngjcd4qv5wrja','ckt1qyqx9qc8kj7g67h0fn5s0wl4jf6fmseu36usw4k9wu','ckt1qyq0luwg4kt862f9nqqxed36ajgrs7xx4fqqpcq05z','ckt1qyqvt63xrwf0373k24qmn9xca8wm0mw3ah5qsjpdm0','ckt1qyqdwtam66uutjtwaxnxkknl6r4mf385ftesm2nmnv','ckt1qyqy9gru3qspr80ec46k3sf50pmp0ugc48sslxl7v3','ckt1qyqg9mvluuey3dgla3mcyhywlm6a3c3t29yqk2w34g','ckt1qyqdfu8rwa9vxjluywqvvqvuu99pcq0pw9vs9mql2r','ckt1qyqqaqpxltfdlzr96gznlq60z4dgdczqklvsr5teex','ckt1qyq92cgkmfgjkq6hak5hkzr6tr2wepv6ypvqe9xjky','ckt1qyqvnx4cy5g3nsuwgj3np0a88qfr95553s8s6s6vur','ckt1qyqwyd6alcx34wnfvufjhgmtdfx7c5vxux9slureh6','ckt1qyqgdwtang79z6r2jc6m228mllrwc2vg7wcsu3kf6t','ckt1qyqx2vymslqhcqv4nfk6rrpndysrs6dnk23qrndan3','ckt1qyq0gw5p4t2w3fsgjy9ecmpzzxwhuakvwl2q65ec6n','ckt1qyqd644zldav2k0kt5sg2lhseqz2klv8kgxq3lwahj','ckt1qyqxhqjf3g3j0q23kvhdsv8800txcgxm5lxsdh7cf9','ckt1qyqd67sjwrgq6np8j6gael20aw0vqteq8w3q43cm4w','ckt1qyqt2n008umcevz0wvda0vcz9d8hcklc344qqzphyg','ckt1qyq92nx9p4v74pw8lxh7gdkmxenju2zm79ys5myyyp','ckt1qyqtswylhx7s7sws79paf5h8f9u2e0l90pusxnw0a2','ckt1qyqxsssayxdcw4lnllar0zv5hkc5atrafehqcx9v6z','ckt1qyq9avujzncqdkse2za0g56v8cx3e83lg04qv20wvq','ckt1qyqgwp0g3jy0xs4quw337ym3e79kvegd2a7qmqxvqf','ckt1qyqqyp2ddtejfq5p2tqtz2xrs8h5nd6u822sdmwsq4','ckt1qyqzju8pevdhkn5jleguw2ftrun80e23zypsv0k9xp','ckt1qyqz9awytjtc3ggr76hvdh99569t9xds7qrqp4g2yc','ckt1qyqwun60zd8c9tqr2h8td3xcwpcss89s89qq63ju5y','ckt1qyqvyvx8rm4ythtcka98u6mrgus4whk45u7qawuvda','ckt1qyqf497sumj7v0a5cemv3v7strjhgnayy98qsk9kwc','ckt1qyqyzgxek4w9g8necw7xep48w0xcf6th7djq38fh3x','ckt1qyqgdyl96vkw07ucpdfcs0058aaf3w09dcjs7scrs2','ckt1qyq2mnuhvl86453ggpk2lagchq38836cdafq76u55u','ckt1qyq9scfephukhzmje5shfmefkdgz4uhllslqzuzd7p','ckt1qyqzcfgv3llnspel9hue4ggrsd60fdnthlzsdtf4p6','ckt1qyqgpfaxl3w9qmszsdz4kt4tyhqmq76xldes34raza','ckt1qyqy4wz363j3hmplee55ntulhnhtn4etf9jspv8mu2','ckt1qyq2q7v5ylr33rqs9g370mnj0ppwrex2rpuqulykhe','ckt1qyqqlhhyhvxcrkyw4aaslzclp9042rm22qusletjrc','ckt1qyqdv5aytq8sjgmfde5n7wn2n05k5wdttlqqlrjz8y','ckt1qyq809ghqt0f4enk5tnqvksdn2ctn8q90pusjvm8la','ckt1qyqrk5mu3mws8x8gfpd2unqt48jzq6ctc0cq8xuyzv','ckt1qyq2tdsgxt4ghp3q826sk4eu7tu3q9vuvw2qnh84f9','ckt1qyqv8zl9jfax4jz2rju5p5l8xycd4j60ngjqwwwhep','ckt1qyqdlcnm6rs32dttcwj3n5aez36jdg34q6vqxspkzh','ckt1qyqzn9cf285spf2nyydw3067nz398ehzlwkqkd82d8','ckt1qyq2avwz03lsctxaxeu4a8plmuj4nfkl3c9qgzqq8w','ckt1qyqv4y5etwajaaxeff6fdehss852njdthh5ssuvmzh','ckt1qyq8zqrv5d67rvg7mqv46fdsw3hr7jxvjy8shk0ufu','ckt1qyqrwasveylt4ffwy9p95yesm3w9kqu5yjasnttprs','ckt1qyq9wrer6dwnqwpncyzywvsk95wewnn643hsf6t77l','ckt1qyqtykhujtp4qvs0grxlk29cc73qtrx74ecsp9lu3r','ckt1qyqggm6pmwdpczppfc83673ew2xt9q6xv5lsrj8lvv','ckt1qyq8scqhcgksykewxyu5dqfuxtdqv9ayq82qtly4gu','ckt1qyqr6dplqwht5xud2fy0uvj6dnkk7rlzrq7qsjkxue','ckt1qyqrp2ucpe0lylp5lfxf7duczf9twzxhfm3qqw2p34']);
	const [recipientsPaid, setRecipientsPaid] = useState<string[]>([]);
	const [recipientAddressType, setRecipientAddressType] = useState(AddressType.ckb);
	const [recipientAmount, setRecipientAmount] = useState(61);
	const [recipientsPerTx, setRecipientsPerTx] = useState(10);
	const [chainType, setChainType] = useState(ChainType.testnet);
	const [ckbAddress, setCkbAddress] = useState('');
	const [ckbAddressBalance, setCkbAddressBalance] = useState('');
	const [currentChunk, setCurrentChunk] = useState(0);
	const [loading] = useState(false);
	const [privateKey, setPrivateKey] = useState<string>('');
	const [state, setState] = useState(State.Stopped);
	const [status, setStatus] = useState('Stopped');
	const [ticker, setTicker] = useState<ReturnType<typeof setInterval>|null>(null);
	const [tick, setTick] = useState(0);
	const [timeoutTicker, setTimeoutTicker] = useState<ReturnType<typeof setTimeout>|null>(null);
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
		const newPrivateKey = '0x4289da0b4ca3ee5c461c2d3ee157ce2103c3bdcfe7a136d58c3fa2b0affabd79';
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
				setStatus('Validating data.');
	
				const promises =
				[
					validatePrivateKey(privateKey),
					validateRecipients(recipients, recipientAddressType, chainType),
					validateAmounts(recipients.length, recipientAmount, privateKey, chainType)
				];
				Promise.all(promises)
				.then(()=>
				{
					setState(State.BuildTx);
				})
				.catch((error)=>
				{
					setState(State.Stopped);
					setStatus('An error occurred during address validation.');
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
			}
			else if(state===State.ConfirmTx)
			{
				// Update the status bar.
				const transactionCount = Math.ceil(recipients.length / recipientsPerTx);
				setStatus(`Confirming transaction ${currentChunk+1}/${transactionCount}.`);

				// Set the timeout ticker.
				if(timeoutTicker === null)
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
						if(!!timeoutTicker)
						{
							clearTimeout(timeoutTicker);
							setTimeoutTicker(null);
						}
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
									{label: 'Mainnet', value: ChainType.mainnet, disabled: state!==State.Stopped},
									{label: 'Testnet', value: ChainType.testnet, default: true, disabled: state!==State.Stopped},
								]
							}
						/>
					</label>
					<label>
						Private Key
						<input type="text" className="private-key" onChange={handleSetPrivateKeyWrapper} placeholder="Enter a 256-bit (32 byte) private key in hex format." defaultValue="0x4289da0b4ca3ee5c461c2d3ee157ce2103c3bdcfe7a136d58c3fa2b0affabd79" pattern="^0x[a-fA-F0-9]{64}$" maxLength={66} readOnly={state!==State.Stopped} />
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
						<input type="text" className="status" readOnly={true} value={status} />
					</label>
					<label>
						Paid Addresses {`(${recipientsPaid.length})`}
						<div className="paid-addresses">
							{recipientsPaid.map((a, i)=><p key={i}><a href={Config[ChainType[chainType] as ChainTypeString].ckbExplorerUrl+'address/'+a} target="_blank" rel="noreferrer">{a}</a></p>)}
						</div>
					</label>
					<label>
						Transactions {`(${transactions.length})`}
						<div className="transactions">
							{transactions.map((t, i)=><p key={i}><a href={Config[ChainType[chainType] as ChainTypeString].ckbExplorerUrl+'transaction/'+t} target="_blank" rel="noreferrer">{t}</a></p>)}
						</div>
					</label>
				</fieldset>
			</form>
			{loading && <LoadingSpinner /> }
		</main>
	);
	return html;
}

export default Component;
