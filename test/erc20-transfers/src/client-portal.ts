import {PortalClient} from '@subsquid/portal-client'
import {HttpClient} from '@subsquid/http-client'
import {EvmPortalDataSource} from '@subsquid/evm-stream'
import {EvmQueryBuilder, mergeQueries} from '@subsquid/evm-stream/lib/query'
import {erc20Query} from './erc20'
import {DataSource} from '@subsquid/data-source'

async function main() {
    let portal = new PortalClient({
        url: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
        http: new HttpClient({
            retryAttempts: Infinity,
            keepalive: true,
        }),
    })

    let query = new EvmQueryBuilder()
        .setFields({
            block: {
                // number: true,
                // hash: true,
                // number: false,
            },
            transaction: {
                from: true,
                to: true,
                hash: true,
            },
        })
        .build()

    let dataSource = new EvmPortalDataSource({
        portal,
        query: mergeQueries(
            query,
            erc20Query({
                fields: {
                    transfer: {
                        from: true,
                        to: true,
                        address: true,
                        value: true,
                    },
                },
                requests: [
                    {
                        range: {from: 0},
                        request: {
                            transfers: [
                                {
                                    address: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
                                    transaction: true,
                                },
                            ],
                        },
                    },
                ],
            })
        ),
    })

    let from = await dataSource.getFinalizedHeight().then((h) => h - 100_000)

    for await (let blocks of dataSource.getBlockStream({from}, true)) {
        let a = blocks[0].header
        console.log(
            `[${new Date().toISOString()}] progress: ${blocks[blocks.length - 1].header.number} / ${
                blocks[DataSource.finalizedHead]?.number ?? -1
            }` + `, blocks: ${blocks.length}`
        )
    }
    console.log(`end`)
}

main()
