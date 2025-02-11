import {
    type RequestOptions,
    type LogRequest,
    type SolanaQueryOptions,
    type FieldSelection,
    SolanaQueryBuilder,
    Instruction,
    InstructionRequest,
    BlockData,
    getInstructionDescriptor,
} from '@subsquid/solana-stream'
import {project} from '@subsquid/solana-stream/lib/schema'
import {
    weakMemo,
    type Base58,
    type Bytes20,
    type ConditionalPick,
    type Select,
    type Selector,
    type Simplify,
    type Trues,
} from '@subsquid/util-internal'
import type {RangeRequest} from '@subsquid/util-internal-range'
import * as whirlpool from './abi/whirlpool'
import * as tokenProgram from './abi/tokenProgram'
import {ANY, array, B58, BIG_NAT, cast, NAT, object, option} from '@subsquid/util-internal-validation'
import assert from 'assert'

export type SwapFields = Simplify<
    {
        inputMint: Base58
        inputVault: Base58
        inputAmount: bigint
        outputMint: Base58
        outputVault: Base58
        outputAmount: bigint
    } & Pick<Instruction, 'transactionIndex' | 'instructionAddress'>
>
export type SwapFieldSelection = Selector<keyof SwapFields>
export type Swap<F extends SwapFieldSelection = Trues<SwapFieldSelection>> = Select<SwapFields, F>

export type WhirlpoolFieldSelection = {
    swap?: SwapFieldSelection
}

export type SwapRequest = Simplify<
    {
        // inputMint?: Base58[]
        // inputVault?: Base58[]
        // outputMint?: Base58[]
        // outputVault?: Base58[]
    } & Pick<
        InstructionRequest,
        | 'transaction'
        | 'logs'
        | 'transactionBalances'
        | 'transactionInstructions'
        | 'transactionTokenBalances'
        | 'innerInstructions'
    >
>

export type SwapRequestOptions = RequestOptions<SwapRequest>

export type WhirlpoolDataRequest = {
    swaps?: SwapRequest[]
}

export type WhirlpoolQueryOptions<F extends WhirlpoolFieldSelection = WhirlpoolFieldSelection> = {
    fields: F
    requests: RangeRequest<WhirlpoolDataRequest>[]
}

export type ConvertFieldSelection<F extends WhirlpoolFieldSelection> = typeof WHIRLPOOL_REQUIRED_FIELDS

export type ConvertWhirlpoolQeury<T extends WhirlpoolQueryOptions> = SolanaQueryOptions<
    ConvertFieldSelection<T['fields']>
>

export class WhirlpoolDecoder<Q extends WhirlpoolQueryOptions> {
    readonly query: ConvertWhirlpoolQeury<Q>

    constructor(private options: Q) {
        this.query = whirlpoolQuery(this.options)
    }

    decode(blocks: BlockData<this['query']['fields']>[]): Swap<Q['fields']['swap'] & {}>[] {
        let validator = getDataSchema(this.options.fields)
        return whirlpoolDecoder(blocks).map((s) => cast(validator, s) as any)
    }
}

export function whirlpoolQuery<T extends WhirlpoolQueryOptions>(options: T): ConvertWhirlpoolQeury<T> {
    let {fields, requests} = options

    return {
        fields: convertFieldSelection(fields),
        requests: requests.map(({range, request}) => ({
            range,
            request: {
                instructions: request.swaps?.map((s) => ({
                    programId: [whirlpool.programId], // where executed by Whirlpool program
                    d8: [whirlpool.instructions.swap.d8], // have first 8 bytes of .data equal to swap descriptor
                    isCommitted: true, // where successfully committed
                    innerInstructions: true, // inner instructions
                    transaction: true, // transaction, that executed the given instruction
                    transactionTokenBalances: true, // all token balance records of executed transactionб
                })),
            },
        })),
    }
}

export function whirlpoolDecoder(blocks: BlockData<typeof WHIRLPOOL_REQUIRED_FIELDS>[]) {
    let swaps: Swap[] = []

    for (let block of blocks) {
        if (block.instructions == null) continue

        for (let ins of block.instructions) {
            let descriptor = getInstructionDescriptor(ins)
            if (ins.programId === whirlpool.programId && descriptor == whirlpool.instructions.swap.d8) {
                let inner = block.instructions.filter(
                    (i) =>
                        i.transactionIndex === ins.transactionIndex &&
                        i.instructionAddress.length === ins.instructionAddress.length + 1 &&
                        ins.instructionAddress.every((a, j) => a === i.instructionAddress[j])
                )
                let tokenBalances =
                    block.tokenBalances?.filter((tb) => tb.transactionIndex === ins.transactionIndex) || []

                let swap = whirlpool.instructions.swap.decode(ins)

                let srcTransfer = tokenProgram.instructions.transfer.decode(inner[0])
                let destTransfer = tokenProgram.instructions.transfer.decode(inner[1])

                let inputMint = tokenBalances.find((tb) => tb.account === srcTransfer.accounts.destination)?.preMint
                assert(inputMint != null)
                let inputAmount = srcTransfer.data.amount

                let outputMint = tokenBalances.find((tb) => tb.account === destTransfer.accounts.source)?.preMint
                assert(outputMint != null)
                let outputAmount = destTransfer.data.amount

                let [inputVault, outputVault] = swap.data.aToB
                    ? [swap.accounts.tokenVaultA, swap.accounts.tokenVaultB]
                    : [swap.accounts.tokenVaultB, swap.accounts.tokenVaultA]

                swaps.push({
                    inputAmount,
                    inputMint,
                    inputVault,
                    outputAmount: outputAmount,
                    outputMint,
                    outputVault,
                    transactionIndex: ins.transactionIndex,
                    instructionAddress: ins.instructionAddress,
                })
            }
        }
    }

    return swaps
}

function convertFieldSelection<F extends WhirlpoolFieldSelection>(fields: F): ConvertFieldSelection<F> {
    let {swap} = fields

    return (swap
        ? {
              instruction: {
                  transactionIndex: true,
                  data: true,
                  instructionAddress: true,
                  programId: true,
                  accounts: true,
              },
              tokenBalance: {
                  transactionIndex: true,
                  account: true,
                  preMint: true,
                  postMint: true,
              },
          }
        : {}) satisfies FieldSelection as any
}

export const getDataSchema = weakMemo((fields: WhirlpoolFieldSelection) => {
    return object({
        ...project(fields.swap, {
            // FIXME: should be bigint
            inputAmount: ANY,
            inputMint: B58,
            inputVault: B58,
            instructionAddress: array(NAT),
            // FIXME: should be bigint
            outputAmount: ANY,
            outputMint: B58,
            outputVault: B58,
            transactionIndex: BIG_NAT,
        }),
    })
})

const WHIRLPOOL_REQUIRED_FIELDS = {
    instruction: {
        transactionIndex: true,
        data: true,
        instructionAddress: true,
        programId: true,
        accounts: true,
    },
    tokenBalance: {transactionIndex: true, account: true, preMint: true, postMint: true},
} as const
