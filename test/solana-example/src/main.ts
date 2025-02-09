import {mergeQueries, SolanaPortalDataSource, SolanaQueryBuilder} from '@subsquid/solana-stream'
import * as whirlpool from './abi/whirlpool'
import {PortalClient} from '@subsquid/portal-client'
import {HttpClient} from '../../../util/http-client/lib'
import {DataSource} from '../../../util/data-source/lib'

const query = new SolanaQueryBuilder()
    // Currently only blocks from 240_000_000 and above are stored in Subsquid Network.
    // When we specify it, we must also limit the range of requested blocks.
    //
    // Same applies to RPC endpoint of a node that cleanups its history.
    //
    // NOTE, that block ranges are specified in heights, not in slots !!!
    //
    .setRange({from: 240_000_000})
    //
    // Block data returned by the data source has the following structure:
    //
    // interface Block {
    //     header: BlockHeader
    //     transactions: Transaction[]
    //     instructions: Instruction[]
    //     logs: LogMessage[]
    //     balances: Balance[]
    //     tokenBalances: TokenBalance[]
    //     rewards: Reward[]
    // }
    //
    // For each block item we can specify a set of fields we want to fetch via `.setFields()` method.
    // Think about it as of SQL projection.
    //
    // Accurate selection of only required fields can have a notable positive impact
    // on performance when data is sourced from Subsquid Network.
    //
    // We do it below only for illustration as all fields we've selected
    // are fetched by default.
    //
    // It is possible to override default selection by setting undesired fields to `false`.
    .setFields({
        block: {
            // block header fields
            timestamp: true,
        },
        transaction: {
            // transaction fields
            signatures: true,
        },
        instruction: {
            // instruction fields
            programId: true,
            accounts: true,
            data: true,
        },
        tokenBalance: {
            // token balance record fields
            preAmount: true,
            postAmount: true,
            preOwner: true,
            postOwner: true,
        },
    })
    // By default, block can be skipped if it doesn't contain explicitly requested items.
    //
    // We request items via `.addXxx()` methods.
    //
    // Each `.addXxx()` method accepts item selection criteria
    // and also allows to request related items.
    //
    .addInstruction({
        request: {
            programId: [whirlpool.programId], // where executed by Whirlpool program
            d8: [whirlpool.instructions.swap.d8], // have first 8 bytes of .data equal to swap descriptor
            isCommitted: true, // where successfully committed
            innerInstructions: true, // inner instructions
            transaction: true, // transaction, that executed the given instruction
            transactionTokenBalances: true, // all token balance records of executed transaction
        },
    })
    .build()

async function main() {
    let portal = new PortalClient({
        url: 'https://portal.sqd.dev/datasets/solana-mainnet',
        http: new HttpClient({
            retryAttempts: Infinity,
            keepalive: true,
        }),
        minBytes: 50 * 1024 * 1024,
    })

    let dataSource = new SolanaPortalDataSource({
        portal,
        query: mergeQueries(query),
    })

    let from = await dataSource.getFinalizedHeight().then((h) => h - 1_000_000)

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