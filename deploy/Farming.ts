import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running Farming deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const { address } = await deploy('Farming', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [],
        },
      },
    },
  })

  console.log('Farming deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['SLPDeposit']

deployFunction.tags = ['Farming']
