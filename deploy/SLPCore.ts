import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { CHAIN_ID, SLP_FEE_RECEIVER_ADDRESS, VETH1_ADDRESS } from '../constants/constants'

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
  network,
}: HardhatRuntimeEnvironment) {
  console.log('Running SLPCore deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const chainId = network.config.chainId as CHAIN_ID
  const vETH1 = VETH1_ADDRESS[chainId]
  const vETH2 = (await deployments.get('vETH2')).address
  const SLPDeposit = (await deployments.get('SLPDeposit')).address
  const feeReceiver = SLP_FEE_RECEIVER_ADDRESS[chainId]
  // 500/10000 = 5%
  const feeRate = 500

  const { address } = await deploy('SLPCore', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [vETH1, vETH2, SLPDeposit, feeReceiver, feeRate],
        },
      },
    },
  })

  console.log('SLPCore deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['vETH2', 'SLPDeposit', 'vETH2Claim']

deployFunction.tags = ['SLPCore']
