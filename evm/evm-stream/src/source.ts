import {applyRangeBound, mergeRangeRequests, Range, RangeRequest} from '@subsquid/util-internal-range'
import {PortalClient, PortalStreamData} from '@subsquid/portal-client'
import {weakMemo} from '@subsquid/util-internal'
import {array, BYTES, cast, NAT, object, STRING, taggedUnion, withDefault} from '@subsquid/util-internal-validation'
import {
    getBlockHeaderProps,
    getTxProps,
    getTxReceiptProps,
    getLogProps,
    getTraceFrameValidator,
    project,
} from './schema'
import {
    BlockData,
    DataRequest,
    EvmQueryOptions,
    FieldSelection,
    mergeDataRequests,
    mergeSelection,
    Response,
} from './query'
import {MergeSelection} from '@subsquid/util-types'
import {DataSource, DataSourceStream, DataSourceStreamData} from '@subsquid/data-source'

export interface EvmPortalDataSourceOptions<Q extends EvmQueryOptions> {
    portal: string | PortalClient
    query: Q
}

export class EvmPortalDataSource<
    Q extends EvmQueryOptions,
    B extends BlockData<GetFields<Q['fields']>> = BlockData<GetFields<Q['fields']>>
> implements DataSource<B>
{
    private portal: PortalClient
    private fields: Q['fields']
    private requests: RangeRequest<DataRequest>[]

    constructor(options: EvmPortalDataSourceOptions<Q>) {
        this.portal = typeof options.portal === 'string' ? new PortalClient({url: options.portal}) : options.portal
        this.fields = options.query.fields
        this.requests = mergeRangeRequests(options.query.requests, mergeDataRequests)
    }

    getHeight(): Promise<number> {
        return this.portal.getFinalizedHeight()
    }

    getFinalizedHeight(): Promise<number> {
        return this.portal.getFinalizedHeight()
    }

    getBlockStream(range?: Range, stopOnHead?: boolean): DataSourceStream<B> {
        let fields = getFields(this.fields)
        let requests = applyRangeBound(this.requests, range)

        // FIXME: remove any
        let {writable, readable} = new TransformStream<
            PortalStreamData<BlockData<any>>,
            DataSourceStreamData<B>
        >({
            transform: async (data, controller) => {
                let blocks = data.map((b) => {
                    // FIXME: remove any
                    let block = mapBlock(b, fields) as any
                    Object.defineProperty(block, DataSource.blockRef, {
                        value: {hash: block.header.hash, number: block.header.number},
                    })
                    return block
                })

                Object.defineProperty(blocks, DataSource.finalizedHead, {
                    value: data[PortalClient.finalizedHead],
                })

                controller.enqueue(blocks as DataSourceStreamData<B>)
            },
        })

        const ingest = async () => {
            for (let request of requests) {
                let query = {
                    type: 'evm',
                    fromBlock: request.range.from,
                    toBlock: request.range.to,
                    fields,
                    ...request.request,
                }

                await this.portal.getFinalizedStream(query, {stopOnHead}).pipeTo(writable, {
                    preventClose: true,
                })
            }
        }

        ingest()
            .then(
                () => writable.close(),
                (reason) => writable.abort(reason)
            )
            .catch(() => {})

        return readable
    }
}

export const getBlockValidator = weakMemo(<F extends FieldSelection>(fields: F) => {
    let BlockHeader = object(getBlockHeaderProps(fields.block, true))

    let Transaction = object({
        hash: fields.transaction?.hash ? BYTES : undefined,
        ...getTxProps(fields.transaction, true),
        sighash: fields.transaction?.sighash ? withDefault('0x', BYTES) : undefined,
        ...getTxReceiptProps(fields.transaction, true),
    })

    let Log = object(getLogProps(fields.log, true))

    let Trace = getTraceFrameValidator(fields.trace, true)

    let stateDiffBase = {
        transactionIndex: NAT,
        address: BYTES,
        key: STRING,
    }

    let StateDiff = taggedUnion('kind', {
        ['=']: object({...stateDiffBase}),
        ['+']: object({...stateDiffBase, ...project(fields.stateDiff, {next: BYTES})}),
        ['*']: object({...stateDiffBase, ...project(fields.stateDiff, {prev: BYTES, next: BYTES})}),
        ['-']: object({...stateDiffBase, ...project(fields.stateDiff, {prev: BYTES})}),
    })

    return object({
        header: BlockHeader,
        transactions: withDefault([], array(Transaction)),
        logs: withDefault([], array(Log)),
        traces: withDefault([], array(Trace)),
        stateDiffs: withDefault([], array(StateDiff)),
    })
})

export function mapBlock<F extends FieldSelection, B extends BlockData<F> = BlockData<F>>(
    rawBlock: unknown,
    fields: F
): B {
    let validator = getBlockValidator(fields)
    let block = cast(validator, rawBlock)

    // let {number, hash, parentHash, ...hdr} = src.header
    // if (hdr.timestamp) {
    //     hdr.timestamp = hdr.timestamp * 1000 // convert to ms
    // }

    // let header = new BlockHeader(number, hash, parentHash)
    // Object.assign(header, hdr)

    // let block = new Block(header)

    // if (src.transactions) {
    //     for (let {transactionIndex, ...props} of src.transactions) {
    //         let tx = new Transaction(header, transactionIndex)
    //         Object.assign(tx, props)
    //         block.transactions.push(tx)
    //     }
    // }

    // if (src.logs) {
    //     for (let {logIndex, transactionIndex, ...props} of src.logs) {
    //         let log = new Log(header, logIndex, transactionIndex)
    //         Object.assign(log, props)
    //         block.logs.push(log)
    //     }
    // }

    // if (src.traces) {
    //     for (let {transactionIndex, traceAddress, type, ...props} of src.traces) {
    //         transactionIndex = assertNotNull(transactionIndex)
    //         let trace: Trace
    //         switch (type) {
    //             case 'create':
    //                 trace = new TraceCreate(header, transactionIndex, traceAddress)
    //                 break
    //             case 'call':
    //                 trace = new TraceCall(header, transactionIndex, traceAddress)
    //                 break
    //             case 'suicide':
    //                 trace = new TraceSuicide(header, transactionIndex, traceAddress)
    //                 break
    //             case 'reward':
    //                 trace = new TraceReward(header, transactionIndex, traceAddress)
    //                 break
    //             default:
    //                 throw unexpectedCase()
    //         }
    //         Object.assign(trace, props)
    //         block.traces.push(trace)
    //     }
    // }

    // if (src.stateDiffs) {
    //     for (let {transactionIndex, address, key, kind, ...props} of src.stateDiffs) {
    //         let diff: StateDiff
    //         switch (kind) {
    //             case '=':
    //                 diff = new StateDiffNoChange(header, transactionIndex, address, key)
    //                 break
    //             case '+':
    //                 diff = new StateDiffAdd(header, transactionIndex, address, key)
    //                 break
    //             case '*':
    //                 diff = new StateDiffChange(header, transactionIndex, address, key)
    //                 break
    //             case '-':
    //                 diff = new StateDiffDelete(header, transactionIndex, address, key)
    //                 break
    //             default:
    //                 throw unexpectedCase()
    //         }
    //         Object.assign(diff, props)
    //         block.stateDiffs.push(diff)
    //     }
    // }

    // setUpRelations(block)

    return block as unknown as B
}

function getFields<T extends FieldSelection>(fields: T): GetFields<T> {
    return mergeSelection(REQUIRED_FIELDS, fields)
}

type GetFields<F extends FieldSelection> = MergeSelection<ReqiredFieldSelection, F>

type ReqiredFieldSelection = typeof REQUIRED_FIELDS

const REQUIRED_FIELDS = {
    block: {
        number: true,
        hash: true,
        parentHash: true,
    },
    // transaction: {
    //     transactionIndex: true,
    // },
    // log: {
    //     logIndex: true,
    //     transactionIndex: true,
    // },
    // trace: {
    //     transactionIndex: true,
    //     traceAddress: true,
    //     type: true,
    // },
    // stateDiff: {
    //     transactionIndex: true,
    //     address: true,
    //     key: true,
    // },
} as const satisfies FieldSelection
