import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running WithdrawalVault deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const SLPCore = (await deployments.get('SLPCore')).address
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
          args: [SLPCore, SLPDeposit],
        },
      },
    },
  })

  console.log('WithdrawalVault deployed at', address)

  const slpCore = await ethers.getContractAt('SLPCore', SLPCore)
  const tx = await slpCore.setWithdrawalVault(address)
  console.log(`Call slpCore.setWithdrawalVault: ${tx.hash}`)
}

export default deployFunction

deployFunction.dependencies = ['SLPDeposit', 'SLPCore']

deployFunction.tags = ['WithdrawalVault']
