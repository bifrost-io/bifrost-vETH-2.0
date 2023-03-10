import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running MevVault deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const slpDeposit = (await deployments.get('SLPDeposit')).address
  const operator = deployer

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
