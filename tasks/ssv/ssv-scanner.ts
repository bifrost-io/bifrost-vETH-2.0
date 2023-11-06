import { task } from 'hardhat/config'
import { ClusterScanner, NonceScanner } from 'ssv-scanner'
import fs from 'fs'
import { CHAIN_ID, SSV_NETWORK_ADDRESS } from '../../constants/constants'

task('ssv-scanner', 'Prints SSV cluster snapshot', async (args, { ethers, network }) => {
  const accounts = await ethers.getSigners()
  const chainId = network.config.chainId as CHAIN_ID
  if (!('url' in network.config)) {
    return
  }

  // these parameters should be known in advance
  const params = {
    nodeUrl: network.config.url,
    contractAddress: SSV_NETWORK_ADDRESS[chainId], // this is the address of SSV smart contract
    ownerAddress: accounts[0].address, // this is the wallet address of the cluster owner
    operatorIds: [15, 18, 32, 35], // this is a list of operator IDs chosen by the owner for their cluster
  }

  // ClusterScanner is initialized with the given parameters
  const clusterScanner = new ClusterScanner(params)
  // and when run, it returns the Cluster Snapshot
  const result = await clusterScanner.run(params.operatorIds)
  console.log(result)

  const nonceScanner = new NonceScanner(params)
  const nextNonce = await nonceScanner.run()
  console.log('Next Nonce:', nextNonce)

  fs.writeFileSync(
    './tasks/data/ssv_cluster.json',
    JSON.stringify(
      {
        block: result.payload.Block,
        cluster_snapshot: result.cluster,
        cluster: Object.values(result.cluster),
        nonce: nextNonce,
      },
      null,
      2
    )
  )
})
