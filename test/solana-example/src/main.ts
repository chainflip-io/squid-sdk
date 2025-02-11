import {
    getInstructionDescriptor,
    mergeQueries,
    SolanaPortalDataSource,
    SolanaQueryBuilder,
} from '@subsquid/solana-stream'
import * as whirlpool from './abi/whirlpool'
import {PortalClient} from '@subsquid/portal-client'
import {HttpClient} from '@subsquid/http-client'
import {DataSource} from '@subsquid/data-source'
import * as tokenProgram from './abi/tokenProgram'
import {WhirlpoolDecoder, whirlpoolDecoder, whirlpoolQuery} from './whirlpool'

async function main() {
    let portal = new PortalClient({
        url: 'https://portal.sqd.dev/datasets/solana-mainnet',
        http: new HttpClient({
            retryAttempts: Infinity,
            keepalive: true,
        }),
        minBytes: 50 * 1024 * 1024,
    })

    let whirlPoolDecoder = new WhirlpoolDecoder({
        fields: {
            swap: {
                inputAmount: true,
                inputMint: true,
                outputAmount: true,
                outputMint: true,
            },
        },
        requests: [
            {
                range: {from: 0},
                request: {
                    swaps: [{}],
                },
            },
        ],
    })

    let dataSource = new SolanaPortalDataSource({
        portal,
        query: mergeQueries(whirlPoolDecoder.query),
    })

    let from = await dataSource.getFinalizedHeight().then((h) => h - 1_000_000)

    for await (let blocks of dataSource.getBlockStream({from}, true)) {
        let swaps = whirlPoolDecoder.decode(blocks)

        for (let swap of swaps) {
            console.log(`${swap.inputMint} (${swap.inputAmount}) -> ${swap.outputMint} (${swap.outputAmount})`)
        }

        console.warn(
            `[${new Date().toISOString()}] progress: ${blocks[blocks.length - 1].header.number} / ${
                blocks[DataSource.finalizedHead]?.number ?? -1
            }` + `, blocks: ${blocks.length}, swaps: ${swaps.length}`
        )
    }
    console.log(`end`)
}

main()
