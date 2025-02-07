import {applyRangeBound, mergeRangeRequests, Range, RangeRequest} from '@subsquid/util-internal-range'
import type {Evm} from '@subsquid/portal-client'
import type {MergeSelection, MergeSelectionAll, Selection} from '@subsquid/util-types'

export * from '@subsquid/portal-client/lib/query/evm'

export type RequestOptions<R> = {range?: Range; request: R}
export type LogRequestOptions = RequestOptions<Evm.LogRequest>
export type TransactionRequestOptions = RequestOptions<Evm.TransactionRequest>
export type TraceRequestOptions = RequestOptions<Evm.TraceRequest>
export type StateDiffRequestOptions = RequestOptions<Evm.StateDiffRequest>

export type EvmQueryOptions<F extends Evm.FieldSelection = Evm.FieldSelection> = {
    fields: F
    requests: RangeRequest<Evm.DataRequest>[]
}

export class EvmQueryBuilder<F extends Evm.FieldSelection = {block: {number: true; hash: true}}> {
    private range: Range = {from: 0}
    private requests: RangeRequest<Evm.DataRequest>[] = []
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

    addTrace(options: TraceRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                traces: [mapRequest(options)],
            },
        })
        return this
    }

    addStateDiff(options: StateDiffRequestOptions): this {
        this.requests.push({
            range: options.range ?? {from: 0},
            request: {
                stateDiffs: [mapRequest(options)],
            },
        })
        return this
    }

    setRange(range: Range): this {
        this.range = range
        return this
    }

    setFields<F extends Evm.FieldSelection>(fields: F): EvmQueryBuilder<F> {
        this.fields = fields as any
        return this as any
    }

    build(): EvmQueryOptions<F> {
        let requests = mergeRangeRequests(this.requests, mergeDataRequests)

        return {
            fields: this.fields,
            requests: applyRangeBound(requests, this.range),
        }
    }
}

export function mergeDataRequests(...requests: Evm.DataRequest[]): Evm.DataRequest {
    let res: Evm.DataRequest = {}

    for (let req of requests) {
        res.transactions = concatRequestLists(res.transactions, req.transactions)
        res.logs = concatRequestLists(res.logs, req.logs)
        res.traces = concatRequestLists(res.traces, req.traces)
        res.stateDiffs = concatRequestLists(res.stateDiffs, req.stateDiffs)
        if (res.includeAllBlocks || req.includeAllBlocks) {
            res.includeAllBlocks = true
        }
    }

    return res
}

// NOTE: without condition creates ugly type for some reason
export type MergeQueryOptions<T extends EvmQueryOptions, U extends EvmQueryOptions> = EvmQueryOptions<
    MergeSelection<T['fields'], U['fields']>
> extends infer R
    ? R
    : never

export type MergeQueryOptionsAll<T extends readonly EvmQueryOptions[]> = T extends readonly [infer F, ...infer R]
    ? F extends EvmQueryOptions
        ? R extends [EvmQueryOptions, ...EvmQueryOptions[]]
            ? MergeQueryOptions<F, MergeQueryOptionsAll<R>>
            : F
        : never
    : never

type Test = MergeQueryOptionsAll<
    [
        EvmQueryOptions<{
            block: {number: true; hash: true}
            transaction: {from: true; to: true; hash: true}
        }>,
        EvmQueryOptions<{block: {number: true; hash: true; difficulty: true}}>,
        EvmQueryOptions<{block: {number: true; hash: true; nonce: true}}>
    ]
>

export function mergeRequests(...requests: RangeRequest<Evm.DataRequest>[]): RangeRequest<Evm.DataRequest>[] {
    return mergeRangeRequests(requests, mergeDataRequests)
}

export function mergeQueries<T extends readonly EvmQueryOptions[]>(...queries: T): MergeQueryOptionsAll<T> {
    return {
        fields: mergeSelection(...queries.map((q) => q.fields)),
        requests: mergeRequests(...queries.flatMap((q) => q.requests)),
    } as any
}

let test = mergeQueries(
    {} as EvmQueryOptions<{
        block: {number: true; hash: true}
        transaction: {from: true; to: true; hash: true}
    }>,
    {} as EvmQueryOptions<{
        transaction: {from: true}
        block: {number: true; hash: true; difficulty: true}
    }>,
    {} as EvmQueryOptions<{block: {number: true; hash: true; nonce: true}}>
)

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
        if (Array.isArray(val)) {
            ;(req as any)[key] = val.map((s) => {
                return typeof s == 'string' ? s.toLowerCase() : s
            })
        }
    }
    return req
}

function mergeSelection<T extends readonly Selection[]>(...selections: T): MergeSelectionAll<T> {
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

    return res as any
}
