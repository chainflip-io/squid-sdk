import {applyRangeBound, mergeRangeRequests, Range, RangeRequest} from '@subsquid/util-internal-range'
import type {Solana} from '@subsquid/portal-client'
import type {MergeSelection, MergeSelectionAll, Selection} from '@subsquid/util-internal'

export * from '@subsquid/portal-client/lib/query/solana'

export type RequestOptions<R> = {range?: Range; request: R}
export type LogRequestOptions = RequestOptions<Solana.LogRequest>
export type TransactionRequestOptions = RequestOptions<Solana.TransactionRequest>
export type InstructionRequestOptions = RequestOptions<Solana.InstructionRequest>
export type TokenBalanceRequestOptions = RequestOptions<Solana.TokenBalanceRequest>
export type BalanceRequestOptions = RequestOptions<Solana.BalanceRequest>
export type RewardRequestOptions = RequestOptions<Solana.RewardRequest>

export type SolanaQueryOptions<F extends Solana.FieldSelection = Solana.FieldSelection> = {
    fields: F
    requests: RangeRequest<Solana.DataRequest>[]
}

export class SolanaQueryBuilder<F extends Solana.FieldSelection = {block: {number: true; hash: true}}> {
    private range: Range = {from: 0}
    private requests: RangeRequest<Solana.DataRequest>[] = []
    private fields: F = {
        block: {number: true, hash: true},
    } as F

    addLog(options: LogRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                logs: [mapRequest(options)],
            },
        })
        return this
    }

    addTransaction(options: TransactionRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                transactions: [mapRequest(options)],
            },
        })
        return this
    }

    addReward(options: RewardRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                rewards: [mapRequest(options)],
            },
        })
        return this
    }

    addBalance(options: BalanceRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                balances: [mapRequest(options)],
            },
        })
        return this
    }

    addTokenBalance(options: TokenBalanceRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                tokenBalances: [mapRequest(options)],
            },
        })
        return this
    }

    addInstruction(options: InstructionRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                instructions: [mapRequest(options)],
            },
        })
        return this
    }

    setRange(range: Range): this {
        this.range = range
        return this
    }

    setFields<F extends Solana.FieldSelection>(fields: F): SolanaQueryBuilder<F> {
        this.fields = fields as any
        return this as any
    }

    build(): SolanaQueryOptions<F> {
        let requests = mergeRangeRequests(this.requests, mergeDataRequests)

        return {
            fields: this.fields,
            requests: applyRangeBound(requests, this.range),
        }
    }
}

export function mergeDataRequests(...requests: Solana.DataRequest[]): Solana.DataRequest {
    let res: Solana.DataRequest = {}

    for (let req of requests) {
        res.transactions = concatRequestLists(res.transactions, req.transactions)
        res.logs = concatRequestLists(res.logs, req.logs)
        res.balances = concatRequestLists(res.balances, req.balances)
        res.tokenBalances = concatRequestLists(res.tokenBalances, req.tokenBalances)
        res.rewards = concatRequestLists(res.rewards, req.rewards)
        res.instructions = concatRequestLists(res.instructions, req.instructions)
        if (res.includeAllBlocks || req.includeAllBlocks) {
            res.includeAllBlocks = true
        }
    }

    return res
}

// NOTE: without condition creates ugly type for some reason
export type MergeQueryOptions<T extends SolanaQueryOptions, U extends SolanaQueryOptions> = SolanaQueryOptions<
    MergeSelection<T['fields'], U['fields']>
> extends infer R
    ? R
    : never

export type MergeQueryOptionsAll<T extends readonly SolanaQueryOptions[]> = T extends readonly [infer F, ...infer R]
    ? F extends SolanaQueryOptions
        ? R extends [SolanaQueryOptions, ...SolanaQueryOptions[]]
            ? MergeQueryOptions<F, MergeQueryOptionsAll<R>>
            : F
        : never
    : never

export function mergeRequests(...requests: RangeRequest<Solana.DataRequest>[]): RangeRequest<Solana.DataRequest>[] {
    return mergeRangeRequests(requests, mergeDataRequests)
}
export function mergeQueries<T extends SolanaQueryOptions, U extends SolanaQueryOptions>(
    a: T,
    b: U
): MergeQueryOptions<T, U>
export function mergeQueries<T extends readonly SolanaQueryOptions[]>(...queries: T): MergeQueryOptionsAll<T>
export function mergeQueries<T extends readonly SolanaQueryOptions[]>(...queries: T) {
    return {
        fields: mergeSelection(...queries.map((q) => q.fields)),
        requests: mergeRequests(...queries.flatMap((q) => q.requests)),
    }
}

function concatRequestLists<T extends object>(a?: T[], b?: T[]): T[] | undefined {
    let result: T[] = []
    if (a) {
        result.push(...a)
    }
    if (b) {
        result.push(...b)
    }
    return result.length == 0 ? undefined : result
}

function mapRequest<T>(options: RequestOptions<T>): T {
    let req = {...options.request}
    for (let key in req) {
        let val = (req as any)[key]
    }
    return req
}

export function mergeSelection<T extends Selection, U extends Selection>(a: T, b: U): MergeSelection<T, U>
export function mergeSelection<T extends readonly Selection[]>(...selections: T): MergeSelectionAll<T>
export function mergeSelection<T extends readonly Selection[]>(...selections: T) {
    let res: Selection = {}

    for (let selection of selections) {
        for (let key in selection) {
            if (res[key] == null) {
                res[key] = selection[key]
            } else if (res[key] === true || selection[key] === true) {
                res[key] === true
            } else if (typeof res[key] === 'object' && typeof selection[key] === 'object') {
                res[key] = mergeSelection(res[key], selection[key])
            }
        }
    }

    return res
}
