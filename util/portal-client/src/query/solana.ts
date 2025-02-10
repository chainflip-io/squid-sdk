import {Bytes, Select, Selector, Simplify, Trues} from '@subsquid/util-internal'

export type BlockHeaderFields = {
    hash: Bytes
    number: number
    height: number
    parentSlot: number
    parentHash: Bytes
    timestamp: number
}

export type TransactionFields = {
    /**
     * Transaction position in block
     */
    transactionIndex: number
    version: 'legacy' | number
    // transaction message
    accountKeys: Bytes[]
    addressTableLookups: AddressTableLookup[]
    numReadonlySignedAccounts: number
    numReadonlyUnsignedAccounts: number
    numRequiredSignatures: number
    recentBlockhash: Bytes
    signatures: Bytes[]
    // meta fields
    err: null | object
    computeUnitsConsumed: bigint
    fee: bigint
    loadedAddresses: {
        readonly: Bytes[]
        writable: Bytes[]
    }
    hasDroppedLogMessages: boolean
}

export type AddressTableLookup = {
    accountKey: Bytes
    readonlyIndexes: number[]
    writableIndexes: number[]
}

export type InstructionFields = {
    transactionIndex: number
    instructionAddress: number[]
    programId: Bytes
    accounts: Bytes[]
    data: Bytes
    // execution result extracted from logs
    computeUnitsConsumed?: bigint
    error?: string
    /**
     * `true` when transaction completed successfully, `false` otherwise
     */
    isCommitted: boolean
    hasDroppedLogMessages: boolean
}

export type LogMessageFields = {
    transactionIndex: number
    logIndex: number
    instructionAddress: number[]
    programId: Bytes
    kind: 'log' | 'data' | 'other'
    message: string
}

export type BalanceFields = {
    transactionIndex: number
    account: Bytes
    pre: bigint
    post: bigint
}

export type PreTokenBalanceFields = {
    transactionIndex: number
    account: Bytes

    preProgramId?: Bytes
    preMint: Bytes
    preDecimals: number
    preOwner?: Bytes
    preAmount: bigint

    postProgramId?: undefined
    postMint?: undefined
    postDecimals?: undefined
    postOwner?: undefined
    postAmount?: undefined
}

export type PostTokenBalanceFields = {
    transactionIndex: number
    account: Bytes

    preProgramId?: undefined
    preMint?: undefined
    preDecimals?: undefined
    preOwner?: undefined
    preAmount?: undefined

    postProgramId?: Bytes
    postMint: Bytes
    postDecimals: number
    postOwner?: Bytes
    postAmount: bigint
}

export type PrePostTokenBalanceFields = {
    transactionIndex: number
    account: Bytes
    preProgramId?: Bytes
    preMint: Bytes
    preDecimals: number
    preOwner?: Bytes
    preAmount: bigint
    postProgramId?: Bytes
    postMint: Bytes
    postDecimals: number
    postOwner?: Bytes
    postAmount: bigint
}

export type TokenBalanceFields = PreTokenBalanceFields | PostTokenBalanceFields | PrePostTokenBalanceFields

export type RewardFields = {
    pubkey: Bytes
    lamports: bigint
    postBalance: bigint
    rewardType?: string
    commission?: number
}

export type BlockHeaderFieldSelection = Selector<keyof BlockHeaderFields>
export type BlockHeader<F extends BlockHeaderFieldSelection = Trues<BlockHeaderFieldSelection>> = Select<
    BlockHeaderFields,
    F
>

export type TransactionFieldSelection = Selector<keyof TransactionFields>
export type Transaction<F extends TransactionFieldSelection = Trues<TransactionFieldSelection>> = Select<
    TransactionFields,
    F
>

export type InstructionFieldSelection = Selector<keyof InstructionFields>
export type Instruction<F extends InstructionFieldSelection = Trues<InstructionFieldSelection>> = Select<
    InstructionFields,
    F
>

export type LogMessageFieldSelection = Selector<keyof LogMessageFields>
export type LogMessage<F extends LogMessageFieldSelection = Trues<LogMessageFieldSelection>> = Select<
    LogMessageFields,
    F
>

export type BalanceFieldSelection = Selector<keyof BalanceFields>
export type Balance<F extends BalanceFieldSelection = Trues<BalanceFieldSelection>> = Select<BalanceFields, F>

export type TokenBalanceFieldSelection = Selector<keyof TokenBalanceFields>
export type TokenBalance<F extends TokenBalanceFieldSelection = Trues<TokenBalanceFieldSelection>> = Select<
    TokenBalanceFields,
    F
>

export type RewardFieldSelection = Selector<keyof RewardFields>
export type Reward<F extends RewardFieldSelection = Trues<RewardFieldSelection>> = Select<RewardFields, F>

export type FieldSelection = {
    block?: BlockHeaderFieldSelection
    transaction?: TransactionFieldSelection
    instruction?: InstructionFieldSelection
    log?: LogMessageFieldSelection
    balance?: BalanceFieldSelection
    tokenBalance?: TokenBalanceFieldSelection
    reward?: RewardFieldSelection
}

export type DataRequest = {
    fields?: FieldSelection
    includeAllBlocks?: boolean
    transactions?: TransactionRequest[]
    instructions?: InstructionRequest[]
    logs?: LogRequest[]
    balances?: BalanceRequest[]
    tokenBalances?: TokenBalanceRequest[]
    rewards?: RewardRequest[]
}

export type TransactionRequest = {
    feePayer?: Bytes[]

    instructions?: boolean
    logs?: boolean
}

/**
 * Hex encoded prefix of instruction data
 */
export type Discriminator = string & {}

export type InstructionRequest = {
    programId?: Bytes[]
    d1?: Discriminator[]
    d2?: Discriminator[]
    d3?: Discriminator[]
    d4?: Discriminator[]
    d8?: Discriminator[]
    a0?: Bytes[]
    a1?: Bytes[]
    a2?: Bytes[]
    a3?: Bytes[]
    a4?: Bytes[]
    a5?: Bytes[]
    a6?: Bytes[]
    a7?: Bytes[]
    a8?: Bytes[]
    a9?: Bytes[]
    isCommitted?: boolean

    transaction?: boolean
    transactionBalances?: boolean
    transactionTokenBalances?: boolean
    transactionInstructions?: boolean
    logs?: boolean
    innerInstructions?: boolean
}

export type LogRequest = {
    programId?: Bytes[]
    kind?: LogMessageFields['kind'][]

    transaction?: boolean
    instruction?: boolean
}

export type BalanceRequest = {
    account?: Bytes[]

    transaction?: boolean
    transactionInstructions?: boolean
}

export type TokenBalanceRequest = {
    account?: Bytes[]
    preProgramId?: Bytes[]
    postProgramId?: Bytes[]
    preMint?: Bytes[]
    postMint?: Bytes[]
    preOwner?: Bytes[]
    postOwner?: Bytes[]

    transaction?: boolean
    transactionInstructions?: boolean
}

export type RewardRequest = {
    pubkey?: Bytes[]
}

export type FinalizedQuery = Simplify<
    {
        type: 'solana'
        fromBlock?: number
        toBlock?: number
        fields: FieldSelection
    } & DataRequest
>

export type BlockData<F extends FieldSelection> = {
    header: BlockHeader<F['block'] & {}>
    transactions?: Transaction<F['transaction'] & {}>[]
    instructions?: Instruction<F['instruction'] & {}>[]
    logs?: LogMessage<F['log'] & {}>[]
    balances?: Balance<F['balance'] & {}>[]
    tokenBalances?: TokenBalance<F['tokenBalance'] & {}>[]
    rewards?: Reward<F['reward'] & {}>[]
}

export type Response<Q extends FinalizedQuery> = BlockData<Q['fields']>
