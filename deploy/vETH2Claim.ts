import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { CHAIN_ID, VETH2_CLAIM_MERKLE_ROOT } from '../constants/constants'

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
  network,
}: HardhatRuntimeEnvironment) {
  console.log('Running vETH2Claim deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const vETH2 = (await deployments.get('vETH2')).address
  const chainId = network.config.chainId as CHAIN_ID
  const merkleRoot = VETH2_CLAIM_MERKLE_ROOT[chainId]

  const { address } = await deploy('vETH2Claim', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [vETH2, merkleRoot],
        },
      },
    },
  })

  console.log('vETH2Claim deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['vETH2']

deployFunction.tags = ['vETH2Claim']
