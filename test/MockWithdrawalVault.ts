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
  let attacker: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let feeReceiver: SignerWithAddress

  beforeEach(async function () {
    ;[deployer, newOwner, attacker, user1, user2, feeReceiver] = await ethers.getSigners()

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

    const feeRate = 100
    await vETH2.mint(deployer.address, ethers.utils.parseEther('1'))
    await slpDeposit.initialize(depositContract.address)
    await mevVault.initialize(depositContract.address)
    await mockWithdrawalVault.initialize(slpDeposit.address)
    await slpCore.initialize(
      vETH1.address,
      vETH2.address,
      slpDeposit.address,
      mevVault.address,
      mockWithdrawalVault.address,
      feeReceiver.address,
      feeRate
    )
    await vETH2.setOperator(slpCore.address)
    await mevVault.setSLPCore(slpCore.address)
    await mockWithdrawalVault.setSLPCore(slpCore.address)
  })

  it('basic check', async function () {
    expect(await mockWithdrawalVault.slpDeposit()).to.equal(slpDeposit.address)
    expect(await mockWithdrawalVault.slpCore()).to.equal(slpCore.address)
    expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
    expect(await mockWithdrawalVault.totalWithdrawalAmount()).to.equal(0)
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

    it('increaseWithdrawalNode should be ok', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('32'),
      })
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      await mockWithdrawalVault.increaseWithdrawalNode(1)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)

      await mockWithdrawalVault.withdrawWithdrawals(ethers.utils.parseEther('32'))

      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('320'),
      })
      await mockWithdrawalVault.increaseWithdrawalNode(10)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(11)

      await mockWithdrawalVault.withdrawWithdrawals(ethers.utils.parseEther('32').mul(10))
    })

    it('increaseWithdrawalNode exceed total ETH should revert', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('31.99999'),
      })
      await expect(mockWithdrawalVault.increaseWithdrawalNode(1)).to.revertedWith('Exceed total ETH')

      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('320'),
      })
      await mockWithdrawalVault.increaseWithdrawalNode(10)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(10)
      await expect(mockWithdrawalVault.increaseWithdrawalNode(1)).to.revertedWith('Exceed total ETH')
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
      await mockWithdrawalVault.increaseWithdrawalNode(1)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)

      await mockWithdrawalVault.addReward(ethers.utils.parseEther('0.5'))
    })

    it('addReward exceed total ETH should revert', async function () {
      await deployer.sendTransaction({
        to: mockWithdrawalVault.address,
        value: ethers.utils.parseEther('32.5'),
      })
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(0)
      await mockWithdrawalVault.increaseWithdrawalNode(1)
      expect(await mockWithdrawalVault.withdrawalNodeNumber()).to.equal(1)

      await expect(mockWithdrawalVault.addReward(ethers.utils.parseEther('0.51'))).to.revertedWith('Exceed total ETH')
    })

    it('removeReward should be ok', async function () {
      await mockWithdrawalVault.removeReward(ethers.utils.parseEther('0.5'))
    })
  })
})
