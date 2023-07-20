import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('MockWithdrawalVault', function () {
  let depositContract: Contract
  let slpDeposit: Contract
  let mevVault: Contract
  let mockWithdrawalVault: Contract
  let slpCore: Contract
  let vETH1: Contract
  let vETH2: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let operator: SignerWithAddress
  let attacker: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let feeReceiver: SignerWithAddress

  beforeEach(async function () {
    ;[deployer, newOwner, operator, attacker, user1, user2, feeReceiver] = await ethers.getSigners()

    const DepositContract = await ethers.getContractFactory('DepositContract')
    const VETH1 = await ethers.getContractFactory('vETH1')
    const VETH2 = await ethers.getContractFactory('vETH2')
    const SLPDeposit = await ethers.getContractFactory('SLPDeposit')
    const MevVault = await ethers.getContractFactory('MevVault')
    const MockWithdrawalVault = await ethers.getContractFactory('MockWithdrawalVault')
    const SLPCore = await ethers.getContractFactory('MockSLPCore')

    depositContract = await DepositContract.deploy()
    vETH1 = await VETH1.deploy()
    vETH2 = await VETH2.deploy()
    slpDeposit = await SLPDeposit.deploy()
    mevVault = await MevVault.deploy()
    mockWithdrawalVault = await MockWithdrawalVault.deploy()
    slpCore = await SLPCore.deploy()

    const feeRate = ethers.utils.parseEther('0.05') // 5%
    await vETH2.setSLPCore(deployer.address)
    await vETH2.mint(deployer.address, ethers.utils.parseEther('1'))
    await slpDeposit.initialize(depositContract.address)
    await mevVault.initialize(depositContract.address, operator.address)
    const rewardNumerator = ethers.utils.parseEther('0.05') // 5%
    await mockWithdrawalVault.initialize(slpDeposit.address, operator.address, rewardNumerator)
    await slpCore.initialize(
      vETH1.address,
      vETH2.address,
      slpDeposit.address,
      mevVault.address,
      mockWithdrawalVault.address,
      feeReceiver.address,
      feeRate
    )
    await vETH2.setSLPCore(slpCore.address)
    await mevVault.setSLPCore(slpCore.address)
    await mockWithdrawalVault.setSLPCore(slpCore.address)
    await slpDeposit.setWithdrawVault(mockWithdrawalVault.address)
  })

  it('basic check', async function () {
    expect(await mockWithdrawalVault.slpDeposit()).to.equal(slpDeposit.address)
    expect(await mockWithdrawalVault.slpCore()).to.equal(slpCore.address)
    expect(await mockWithdrawalVault.operator()).to.equal(operator.address)
    expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
    expect(await mockWithdrawalVault.rewardNumerator()).to.equal(ethers.utils.parseEther('0.05'))
  })

  it('transfer owner should be ok', async function () {
    await mockWithdrawalVault.transferOwnership(newOwner.address)
    expect(await mockWithdrawalVault.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(mockWithdrawalVault.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  describe('withdrawal', function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther('32')
      await expect(slpCore.connect(user1).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('32'))

      await expect(slpCore.connect(user2).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user2.address, amount, amount)
      expect(await vETH2.balanceOf(user2.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('64'))
    })

    it('increaseWithdrawalNode should be ok', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('32'),
      })
      expect(await ethers.provider.getBalance(mockWithdrawalVault.address)).to.equal(ethers.utils.parseEther('32'))
      expect(await ethers.provider.getBalance(slpCore.address)).to.equal(0)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      expect(await mockWithdrawalVault.connect(operator).increaseWithdrawalNode(1))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 1)
      expect(await ethers.provider.getBalance(mockWithdrawalVault.address)).to.equal(0)
      expect(await ethers.provider.getBalance(slpCore.address)).to.equal(ethers.utils.parseEther('32'))
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)

      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('320'),
      })
      expect(await ethers.provider.getBalance(mockWithdrawalVault.address)).to.equal(ethers.utils.parseEther('320'))
      expect(await mockWithdrawalVault.connect(operator).increaseWithdrawalNode(10))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 10)
      expect(await ethers.provider.getBalance(mockWithdrawalVault.address)).to.equal(0)
      expect(await ethers.provider.getBalance(slpCore.address)).to.equal(ethers.utils.parseEther('352'))
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(11)
    })

    it('flashIncreaseWithdrawalNode should be ok', async function () {
      expect(await ethers.provider.getBalance(slpCore.address)).to.equal(0)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      expect(await mockWithdrawalVault.flashWithdrawalNodeNumber()).to.equal(0)
      await expect(mockWithdrawalVault.connect(operator).flashWithdrawalNode(1))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 1)
        .to.emit(mockWithdrawalVault, 'FlashWithdrawalNodeIncreased')
        .withArgs(operator.address, 1)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('32'))
      expect(await ethers.provider.getBalance(mockWithdrawalVault.address)).to.equal(0)
      expect(await ethers.provider.getBalance(slpCore.address)).to.equal(ethers.utils.parseEther('32'))
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)
      expect(await mockWithdrawalVault.flashWithdrawalNodeNumber()).to.equal(1)
    })

    it('increaseWithdrawalNode exceed total ETH should revert', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('31.99999'),
      })
      await expect(mockWithdrawalVault.connect(operator).increaseWithdrawalNode(1)).to.revertedWith('Not enough ETH')

      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('320'),
      })
      expect(await mockWithdrawalVault.connect(operator).increaseWithdrawalNode(10))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 10)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(10)
      await expect(mockWithdrawalVault.connect(operator).increaseWithdrawalNode(1)).to.revertedWith('Not enough ETH')
    })

    it('flashIncreaseWithdrawalNode exceed total ETH should revert', async function () {
      await expect(mockWithdrawalVault.connect(operator).flashWithdrawalNode(2))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 2)
        .to.emit(mockWithdrawalVault, 'FlashWithdrawalNodeIncreased')
        .withArgs(operator.address, 2)
      await expect(mockWithdrawalVault.connect(operator).flashWithdrawalNode(1)).to.revertedWith('Not enough ETH')
    })
  })

  describe('add/remove reward', function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('1'))

      await expect(slpCore.connect(user2).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user2.address, amount, amount)
      expect(await vETH2.balanceOf(user2.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('2'))
    })

    it('addReward should be ok', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('32.5'),
      })
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      expect(await mockWithdrawalVault.connect(operator).increaseWithdrawalNode(1))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 1)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)

      expect(await mockWithdrawalVault.connect(operator).addReward(ethers.utils.parseEther('0.15')))
        .to.emit(mockWithdrawalVault, 'RewardAdded')
        .withArgs(operator.address, ethers.utils.parseEther('0.15'))
    })

    it('addReward exceed total ETH should revert', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('32.04'),
      })
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      expect(await mockWithdrawalVault.connect(operator).increaseWithdrawalNode(1))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 1)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)
      await expect(mockWithdrawalVault.connect(operator).addReward(ethers.utils.parseEther('0.05'))).to.revertedWith(
        'Not enough ETH'
      )
    })

    it('addReward too large should revert', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('32.151'),
      })
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      expect(await mockWithdrawalVault.connect(operator).increaseWithdrawalNode(1))
        .to.emit(mockWithdrawalVault, 'WithdrawalNodeIncreased')
        .withArgs(operator.address, 1)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)
      await expect(mockWithdrawalVault.connect(operator).addReward(ethers.utils.parseEther('0.151'))).to.revertedWith(
        'Reward variation too large'
      )
    })

    it('removeReward should be ok', async function () {
      expect(await mockWithdrawalVault.connect(operator).removeReward(ethers.utils.parseEther('0.15')))
        .to.emit(mockWithdrawalVault, 'RewardRemoved')
        .withArgs(operator.address, ethers.utils.parseEther('0.15'))
    })

    it('removeReward too large should revert', async function () {
      expect(await slpCore.tokenPool()).to.equal(ethers.utils.parseEther('3'))
      await expect(mockWithdrawalVault.connect(operator).removeReward(ethers.utils.parseEther('0.151'))).revertedWith(
        'Reward variation too large'
      )
    })
  })
})
