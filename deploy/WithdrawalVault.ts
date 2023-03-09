import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running WithdrawalVault deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const SLPDeposit = (await deployments.get('SLPDeposit')).address

  const { address } = await deploy('WithdrawalVault', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [SLPDeposit],
        },
      },
    },
  })

  console.log('WithdrawalVault deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['SLPDeposit']

deployFunction.tags = ['WithdrawalVault']
