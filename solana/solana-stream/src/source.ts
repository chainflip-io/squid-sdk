import {DataSource, type DataSourceStream, type DataSourceStreamData} from '@subsquid/data-source'
import {PortalClient, type PortalClientOptions, type PortalStreamData} from '@subsquid/portal-client'
import {type MergeSelection, mergeSelection} from '@subsquid/util-internal'
import {applyRangeBound, mergeRangeRequests, type Range, type RangeRequest} from '@subsquid/util-internal-range'
import {cast} from '@subsquid/util-internal-validation'
import {
    type BlockData,
    type DataRequest,
    type FieldSelection,
    mergeDataRequests,
    type SolanaQueryOptions,
} from './query'
import {getDataSchema} from './schema'

export interface SolanaPortalDataSourceOptions<Q extends SolanaQueryOptions> {
    portal: string | PortalClientOptions | PortalClient
    query: Q
}

export class SolanaPortalDataSource<
    Q extends SolanaQueryOptions,
    B extends BlockData<GetFields<Q['fields']>> = BlockData<GetFields<Q['fields']>>
> implements DataSource<B>
{
    private portal: PortalClient
    private fields: Q['fields']
    private requests: RangeRequest<DataRequest>[]

    constructor(options: SolanaPortalDataSourceOptions<Q>) {
        this.portal =
            typeof options.portal === 'string'
                ? new PortalClient({url: options.portal})
                : options.portal instanceof PortalClient
                ? options.portal
                : new PortalClient(options.portal)
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

        let {writable, readable} = new TransformStream<
            PortalStreamData<BlockData<typeof fields>>,
            DataSourceStreamData<B>
        >({
            transform: async (data, controller) => {
                let blocks = data.map((b) => {
                    let block = mapBlock(b, fields)
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
                    type: 'solana',
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

export function mapBlock<F extends FieldSelection, B extends BlockData<F> = BlockData<F>>(
    rawBlock: unknown,
    fields: F
): B {
    let validator = getDataSchema(fields)
    let block = cast(validator, rawBlock)

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
} as const satisfies FieldSelection
