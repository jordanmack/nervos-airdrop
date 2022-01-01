import PWCore, {Address, Amount, AmountUnit, Builder, Cell, ChainID, RawTransaction, Transaction} from "@lay2/pw-core";
import BasicCollector from "../collectors/BasicCollector";

export default class AirdropBuilder extends Builder
{
	issuerAddress: Address;
	destinationAddresses: Address[];
	amount: Amount;
	collector: BasicCollector;
	fee: Amount;

	constructor(issuerAddress: Address, destinationAddresses: Address[], amount: Amount, collector: BasicCollector, fee: Amount)
	{
		super();

		this.issuerAddress = issuerAddress;
		this.destinationAddresses = destinationAddresses;
		this.amount = amount;
		this.collector = collector;
		this.fee = fee;
	}

	async build(): Promise<Transaction>
	{
		// Aliases
		const issuerAddress = this.issuerAddress;
		const destinationAddresses = this.destinationAddresses;
		const amount = this.amount;
		const collector = this.collector;
		const fee = this.fee;

		// Arrays for our input cells, output cells, and cell deps, which will be used in the final transaction.
		const inputCells = [];
		const outputCells = [];
		const cellDeps = [];

		// Create the output cells.
		for(const destinationAddress of destinationAddresses)
		{
			const lockScript = destinationAddress.toLockScript();
			const outputCell = new Cell(amount, lockScript);
			outputCells.push(outputCell);
		}

		// Calculate the required capacity. (Output cell amount * quantity + change cell minimum (61) + fee)
		const neededAmount = new Amount(String(BigInt(amount.toString()) * BigInt(outputCells.length)), AmountUnit.ckb).add(new Amount("61", AmountUnit.ckb)).add(fee);

		// Add necessary capacity.
		const capacityCells = await collector.collectCapacity(issuerAddress, neededAmount);
		for(const cell of capacityCells)
			inputCells.push(cell);

		// Calculate the input capacity and change cell amounts.
		const inputCapacity = inputCells.reduce((a, c)=>a.add(c.capacity), Amount.ZERO);
		const changeCapacity = inputCapacity.sub(neededAmount.sub(new Amount("61", AmountUnit.ckb)));

		// Add the change cell.
		const changeLockScript = issuerAddress.toLockScript()
		const changeCell = new Cell(changeCapacity, changeLockScript);
		outputCells.push(changeCell);

		// Add the required cell deps.
		cellDeps.push(PWCore.config.defaultLock.cellDep);
		cellDeps.push(PWCore.config.pwLock.cellDep);
		// cellDeps.push(PWCore.config.sudtType.cellDep);

		// Generate a transaction and calculate the fee. (The second argument for witness args is needed for more accurate fee calculation.)
		// const witnessArgs = (PWCore.chainId === ChainID.ckb) ? Builder.WITNESS_ARGS.RawSecp256k1 : Builder.WITNESS_ARGS.Secp256k1;
		// const tx = new Transaction(new RawTransaction(inputCells, outputCells, cellDeps), [witnessArgs]);
		const tx = new Transaction(new RawTransaction(inputCells, outputCells, cellDeps), [Builder.WITNESS_ARGS.RawSecp256k1]);
		this.fee = Builder.calcFee(tx);

		// Throw error if the fee is too low.
		if(this.fee.gt(fee))
			throw new Error(`Fee of ${fee} is below the calculated fee requirements of ${this.fee}.`);

		// Return our unsigned and non-broadcasted transaction.
		return tx;
	}
}
