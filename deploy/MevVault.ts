import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { CHAIN_ID, OPERATOR_ADDRESS } from '../constants/constants'

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
  network,
}: HardhatRuntimeEnvironment) {
  console.log('Running MevVault deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const slpDeposit = (await deployments.get('SLPDeposit')).address
  const chainId = network.config.chainId as CHAIN_ID
  const operator = OPERATOR_ADDRESS[chainId]

  const { address } = await deploy('MevVault', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [slpDeposit, operator],
        },
      },
    },
  })

  console.log('MevVault deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['SLPDeposit']

deployFunction.tags = ['MevVault']
