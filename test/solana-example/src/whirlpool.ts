import {
    type RequestOptions,
    type SolanaQueryOptions,
    type FieldSelection,
    Instruction,
    InstructionRequest,
    Block,
    getInstructionDescriptor,
} from '@subsquid/solana-stream'
import {project} from '@subsquid/solana-stream/lib/schema'
import {weakMemo, type Base58, type Select, type Selector, type Simplify, type Trues} from '@subsquid/util-internal'
import type {RangeRequest} from '@subsquid/util-internal-range'
import * as whirlpool from './abi/whirlpool'
import * as tokenProgram from './abi/tokenProgram'
import {ANY, array, B58, BIG_NAT, cast, NAT, object} from '@subsquid/util-internal-validation'
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
