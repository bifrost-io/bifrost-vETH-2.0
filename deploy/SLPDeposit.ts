import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import { CHAIN_ID, DEPOSIT_CONTRACT, SLP_DEPOSIT_MERKLE_ROOT } from '../constants/constants'

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
  network,
}: HardhatRuntimeEnvironment) {
  console.log('Running SLPDeposit deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const chainId = network.config.chainId as CHAIN_ID
  const depositContract = DEPOSIT_CONTRACT[chainId]

  const { address } = await deploy('SLPDeposit', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [depositContract],
        },
      },
    },
  })

  const slpDeposit = await ethers.getContractAt('SLPDeposit', address)
  const batchId = 0
  if ((await slpDeposit.merkleRoots(batchId)) === ethers.constants.HashZero) {
    const merkleRoot = SLP_DEPOSIT_MERKLE_ROOT[chainId]
    await slpDeposit.setMerkleRoot(batchId, merkleRoot)
    console.log('\x1b[32m%s\x1b[0m', `Merkle root at batchId 0 is ${await slpDeposit.merkleRoots(batchId)}`)
  }

  console.log('SLPDeposit deployed at', address)
}

export default deployFunction

deployFunction.dependencies = []

deployFunction.tags = ['SLPDeposit']
